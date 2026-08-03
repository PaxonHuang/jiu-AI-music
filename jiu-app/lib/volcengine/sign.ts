// Volcengine V4 request signing — pure functions, no I/O, no axios.
//
// Adapted from the algorithm published by Volcengine. The same logic is
// found in `@volcengine/sdk-core` but we re-implement it here so:
//   1. The Worker bundle stays small (no axios / openapi runtime).
//   2. We can unit-test the signing math without mocking HTTP.

import { createHash, createHmac } from 'node:crypto';

const ALGORITHM = 'HMAC-SHA256';
const V4_IDENTIFIER = 'request';
const DATE_HEADER = 'x-date';
const TOKEN_HEADER = 'x-security-token';
const CONTENT_SHA256_HEADER = 'x-content-sha256';

const UNSIGNABLE_HEADERS = new Set([
  'authorization',
  'content-type',
  'content-length',
  'user-agent',
  'presigned-expires',
  'expect',
]);

export interface SignRequestParams {
  method?: string;
  uri?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string | number | boolean | undefined>;
  body?: string | Buffer;
  region: string;
  serviceName: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  host: string;
  timestamp?: string;
}

export interface SignResult {
  headers: Record<string, string>;
  authorization: string;
  signature: string;
}

export function signRequest(params: SignRequestParams): SignResult {
  const {
    method = 'GET',
    uri = '/',
    query = {},
    headers = {},
    body,
    region,
    serviceName,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    host,
    timestamp,
  } = params;

  const datetime = timestamp ?? getDateTime();
  const date = datetime.slice(0, 8);

  const lowerCaseHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    lowerCaseHeaders[key.toLowerCase()] = String(value);
  }

  const allHeaders = addRequiredHeaders(lowerCaseHeaders, datetime, host, sessionToken, body);
  const payload = allHeaders[CONTENT_SHA256_HEADER] ?? hexEncodedBodyHash(allHeaders, body);
  const canonicalRequest = createCanonicalRequest(method, uri, query, allHeaders, payload);
  const stringToSign = createStringToSign(datetime, region, serviceName, canonicalRequest);
  const signingKey = deriveSigningKey(secretAccessKey, date, region, serviceName);
  const signature = calculateSignature(signingKey, stringToSign);
  const credentialScope = createScope(date, region, serviceName);
  const signedHeadersStr = signedHeaders(allHeaders);
  const authorization = createAuthorization(accessKeyId, credentialScope, signedHeadersStr, signature);

  return {
    headers: { ...allHeaders, Authorization: authorization },
    authorization,
    signature,
  };
}

export function getDateTime(date?: Date): string {
  const d = date ?? new Date();
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '').replace(/\.\d{3}/g, '');
}

export interface LoadedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export function loadCredentials(env: NodeJS.ProcessEnv = process.env): LoadedCredentials {
  const accessKeyId = env.VOLC_ACCESS_KEY;
  const secretAccessKey = env.VOLC_SECRET_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('VOLC_ACCESS_KEY / VOLC_SECRET_KEY are required');
  }
  return { accessKeyId, secretAccessKey, sessionToken: env.VOLC_SESSION_TOKEN };
}

// ---------- helpers (private) ----------

function calculateSHA256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function calculateHMAC(key: string | Buffer, data: string | Buffer): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function uriEscape(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function canonicalUri(path: string): string {
  if (!path) return '/';
  return path.split('/').map((segment) => uriEscape(segment)).join('/');
}

function canonicalQueryString(params: Record<string, unknown>): string {
  const keys = Object.keys(params).filter((key) => params[key] !== undefined && params[key] !== null).sort();
  const parts = keys.map((key) => {
    const value = params[key];
    if (Array.isArray(value)) {
      return `${uriEscape(key)}=${value.map(uriEscape).sort().join(`&${uriEscape(key)}=`)}`;
    }
    return `${uriEscape(key)}=${uriEscape(String(value))}`;
  });
  return parts.join('&');
}

function isSignableHeader(key: string): boolean {
  return !UNSIGNABLE_HEADERS.has(key.toLowerCase());
}

function canonicalHeaderValues(values: string): string {
  return values.replace(/\s+/g, ' ').trim();
}

function canonicalHeaders(headers: Record<string, string>): string {
  const entries = Object.entries(headers).sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()));
  const parts: string[] = [];
  for (const [key, value] of entries) {
    if (isSignableHeader(key)) {
      parts.push(`${key.toLowerCase()}:${canonicalHeaderValues(value)}`);
    }
  }
  return parts.join('\n');
}

function signedHeaders(headers: Record<string, string>): string {
  return Object.keys(headers)
    .map((key) => key.toLowerCase())
    .filter(isSignableHeader)
    .sort()
    .join(';');
}

function hexEncodedBodyHash(headers: Record<string, string>, body?: string | Buffer): string {
  if (headers[CONTENT_SHA256_HEADER]) return headers[CONTENT_SHA256_HEADER];
  if (typeof body === 'string') return calculateSHA256(body);
  if (Buffer.isBuffer(body)) return calculateSHA256(body);
  return calculateSHA256('');
}

function createCanonicalRequest(
  method: string,
  uri: string,
  query: Record<string, unknown>,
  headers: Record<string, string>,
  payload: string,
): string {
  return [
    method.toUpperCase(),
    canonicalUri(uri),
    canonicalQueryString(query),
    `${canonicalHeaders(headers)}\n`,
    signedHeaders(headers),
    payload,
  ].join('\n');
}

function createScope(date: string, region: string, serviceName: string): string {
  return [date.substring(0, 8), region, serviceName, V4_IDENTIFIER].join('/');
}

function createStringToSign(
  timestamp: string,
  region: string,
  serviceName: string,
  canonicalRequest: string,
): string {
  const date = timestamp.slice(0, 8);
  const credentialScope = createScope(date, region, serviceName);
  return [
    ALGORITHM,
    timestamp,
    credentialScope,
    calculateSHA256(canonicalRequest),
  ].join('\n');
}

function deriveSigningKey(secretAccessKey: string, date: string, region: string, service: string): Buffer {
  const kDate = calculateHMAC(secretAccessKey, date);
  const kRegion = calculateHMAC(kDate, region);
  const kService = calculateHMAC(kRegion, service);
  return calculateHMAC(kService, V4_IDENTIFIER);
}

function calculateSignature(signingKey: Buffer, stringToSign: string): string {
  return calculateHMAC(signingKey, stringToSign).toString('hex');
}

function createAuthorization(
  accessKeyId: string,
  credentialScope: string,
  signedHeadersStr: string,
  signature: string,
): string {
  return [
    `${ALGORITHM} Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeadersStr}`,
    `Signature=${signature}`,
  ].join(', ');
}

function addRequiredHeaders(
  headers: Record<string, string>,
  timestamp: string,
  host: string,
  sessionToken?: string,
  body?: string | Buffer,
): Record<string, string> {
  const updated: Record<string, string> = { ...headers };
  updated[DATE_HEADER] = timestamp;
  if (sessionToken) updated[TOKEN_HEADER] = sessionToken;
  if (!updated.host) updated.host = host;
  if (body || updated[CONTENT_SHA256_HEADER]) {
    updated[CONTENT_SHA256_HEADER] = hexEncodedBodyHash(updated, body);
  }
  return updated;
}
