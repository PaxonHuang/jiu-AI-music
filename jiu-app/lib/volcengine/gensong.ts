// Volcengine Imagination service client: GenBGMForTime / GenSongForTime / QuerySong.
// Wraps the low-level signRequest from ./sign.ts with typed method calls.

import { signRequest, type LoadedCredentials } from './sign.ts';

export const VOLC_HOST = 'open.volcengineapi.com';
export const VOLC_REGION = 'cn-beijing';
export const VOLC_SERVICE = 'imagination';
export const VOLC_VERSION = '2024-08-12';

export type SongStatus = 0 | 1 | 2 | 3;
export const STATUS_PENDING = 0 as const;
export const STATUS_RUNNING = 1 as const;
export const STATUS_SUCCESS = 2 as const;
export const STATUS_FAILED = 3 as const;

export interface GenBGMForTimeParams {
  text: string;
  duration?: number;
  version?: string;
  callbackUrl?: string;
  enableInputRewrite?: boolean;
}

export interface GenSongForTimeParams {
  lyrics?: string;
  prompt?: string;
  modelVersion?: 'v4.0' | 'v4.3' | 'v5.0';
  genre?: string;
  mood?: string;
  gender?: 'Female' | 'Male';
  timbre?: string;
  duration?: number;
  callbackUrl?: string;
  lang?: string;
  vodFormat?: 'wav' | 'mp3';
}

export interface SubmitResponse {
  taskId: string;
  predictedWaitTime: number;
}

interface VolcSubmitPayload {
  TaskID: string;
  PredictedWaitTime: number;
}

function normalizeSubmit(payload: VolcSubmitPayload): SubmitResponse {
  return {
    taskId: payload.TaskID,
    predictedWaitTime: payload.PredictedWaitTime,
  };
}

export interface QuerySongResult {
  /** Server-side TaskID, normalized to camelCase for the rest of the app. */
  taskId: string;
  status: SongStatus;
  progress: number;
  failureReason: { code: number; msg: string } | null;
  audioUrl?: string;
  lyrics?: string;
  duration?: number;
  styleInfo?: string;
}

interface VolcQuerySongPayload {
  TaskID: string;
  Status: SongStatus;
  Progress: number;
  FailureReason: { Code: number; Msg: string } | null;
  SongDetail?: {
    AudioUrl?: string;
    Captions?: string;
    Lyrics?: string;
    Duration?: number;
    Genre?: string;
    Mood?: string;
    Gender?: string;
    Timbre?: string;
    Prompt?: string;
    StyleInfo?: string;
  };
}

function normalizeQuerySong(payload: VolcQuerySongPayload): QuerySongResult {
  const detail = payload.SongDetail;
  return {
    taskId: payload.TaskID,
    status: payload.Status,
    progress: payload.Progress,
    failureReason: payload.FailureReason
      ? { code: payload.FailureReason.Code, msg: payload.FailureReason.Msg }
      : null,
    audioUrl: detail?.AudioUrl,
    lyrics: detail?.Lyrics,
    duration: detail?.Duration,
    styleInfo: detail?.StyleInfo,
  };
}

interface VolcResponse<T> {
  Code: number;
  Message: string;
  Result: T;
  ResponseMetadata: {
    RequestId: string;
    Action: string;
    Version: string;
    Service: string;
    Region: string;
    Error: unknown;
  };
}

export class VolcApiError extends Error {
  readonly code: number;
  readonly action: string;
  readonly requestId: string;

  constructor(code: number, message: string, action: string, requestId: string) {
    super(`[Volcengine ${action}] ${code} ${message}`);
    this.name = 'VolcApiError';
    this.code = code;
    this.action = action;
    this.requestId = requestId;
  }
}

async function call<T>({
  action,
  body,
  credentials,
  signal,
}: {
  action: string;
  body: unknown;
  credentials: LoadedCredentials;
  signal?: AbortSignal;
}): Promise<T> {
  const bodyString = JSON.stringify(body);
  const { headers } = signRequest({
    method: 'POST',
    uri: '/',
    query: { Action: action, Version: VOLC_VERSION },
    headers: { 'Content-Type': 'application/json' },
    body: bodyString,
    region: VOLC_REGION,
    serviceName: VOLC_SERVICE,
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken,
    host: VOLC_HOST,
  });

  const url = `https://${VOLC_HOST}?Action=${action}&Version=${VOLC_VERSION}`;
  const resp = await fetch(url, { method: 'POST', headers, body: bodyString, signal });
  const text = await resp.text();
  const json = JSON.parse(text) as VolcResponse<T>;

  if (json.Code !== 0) {
    throw new VolcApiError(json.Code, json.Message, action, json.ResponseMetadata.RequestId);
  }
  return json.Result;
}

export function submitGenBGMForTime(
  params: GenBGMForTimeParams,
  credentials: LoadedCredentials,
): Promise<SubmitResponse> {
  const body = {
    Text: params.text,
    Duration: params.duration,
    Version: params.version ?? 'v5.0',
    CallbackURL: params.callbackUrl ?? '',
    EnableInputRewrite: params.enableInputRewrite ?? false,
  };
  return call<VolcSubmitPayload>({
    action: 'GenBGMForTime',
    body,
    credentials,
  }).then(normalizeSubmit);
}

export function submitGenSongForTime(
  params: GenSongForTimeParams,
  credentials: LoadedCredentials,
): Promise<SubmitResponse> {
  if (!params.lyrics && !params.prompt) {
    throw new Error('GenSongForTime requires either Lyrics or Prompt');
  }
  const body = {
    Lyrics: params.lyrics ?? '',
    Prompt: params.prompt ?? '',
    ModelVersion: params.modelVersion ?? 'v4.0',
    Genre: params.genre ?? '',
    Mood: params.mood ?? '',
    Gender: params.gender ?? '',
    Timbre: params.timbre ?? '',
    Duration: params.duration ?? 0,
    CallbackURL: params.callbackUrl ?? '',
    Lang: params.lang ?? 'Chinese',
    VodFormat: params.vodFormat ?? 'wav',
  };
  return call<VolcSubmitPayload>({
    action: 'GenSongForTime',
    body,
    credentials,
  }).then(normalizeSubmit);
}

export function querySong(
  taskId: string,
  credentials: LoadedCredentials,
  signal?: AbortSignal,
): Promise<QuerySongResult> {
  return call<VolcQuerySongPayload>({
    action: 'QuerySong',
    body: { TaskID: taskId },
    credentials,
    signal,
  }).then(normalizeQuerySong);
}

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (result: QuerySongResult) => void;
}

export async function pollSongUntilDone(
  taskId: string,
  credentials: LoadedCredentials,
  options: PollOptions = {},
): Promise<QuerySongResult> {
  const intervalMs = options.intervalMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const startedAt = Date.now();

  while (true) {
    if (options.signal?.aborted) {
      throw new Error('Polling aborted');
    }
    const result = await querySong(taskId, credentials, options.signal);
    options.onProgress?.(result);

    if (result.status === STATUS_SUCCESS || result.status === STATUS_FAILED) {
      return result;
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Polling timed out after ${timeoutMs}ms; last status=${result.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
