import assert from 'node:assert/strict';
import test from 'node:test';
import { signRequest, getDateTime } from './sign.ts';

const FIXED_TS = '20240701T120000Z';

test('signRequest produces HMAC-SHA256 Authorization header', () => {
  const result = signRequest({
    method: 'POST',
    uri: '/',
    query: { Action: 'GenSongV4', Version: '2024-08-12' },
    headers: { 'Content-Type': 'application/json' },
    body: '{"lyrics":"小鸟"}',
    region: 'cn-beijing',
    serviceName: 'music',
    accessKeyId: 'AKLT_TEST',
    secretAccessKey: 'SECRET',
    host: 'open.volcengineapi.com',
    timestamp: FIXED_TS,
  });

  assert.match(
    result.authorization,
    /^HMAC-SHA256 Credential=AKLT_TEST\/20240701\/cn-beijing\/music\/request, SignedHeaders=host;x-content-sha256;x-date, Signature=[a-f0-9]{64}$/,
  );
  assert.equal(result.headers['x-date'], FIXED_TS);
  assert.equal(result.headers.host, 'open.volcengineapi.com');
  assert.equal(result.headers['content-type'], 'application/json');
  assert.equal(result.headers['x-content-sha256'].length, 64);
});

test('signRequest is deterministic for fixed timestamp', () => {
  const params = {
    method: 'POST' as const,
    uri: '/',
    query: { Action: 'GenSongV4', Version: '2024-08-12' },
    headers: { 'Content-Type': 'application/json' },
    body: '{"lyrics":"小鸟"}',
    region: 'cn-beijing',
    serviceName: 'music',
    accessKeyId: 'AKLT_TEST',
    secretAccessKey: 'SECRET',
    host: 'open.volcengineapi.com',
    timestamp: FIXED_TS,
  };

  const a = signRequest(params);
  const b = signRequest(params);
  assert.equal(a.signature, b.signature);
  assert.equal(a.authorization, b.authorization);
});

test('signRequest differs across service names', () => {
  const base = {
    method: 'POST' as const,
    uri: '/',
    query: { Action: 'GenSongV4' },
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    region: 'cn-beijing',
    accessKeyId: 'AKLT_TEST',
    secretAccessKey: 'SECRET',
    host: 'open.volcengineapi.com',
    timestamp: FIXED_TS,
  };

  const music = signRequest({ ...base, serviceName: 'music' });
  const song = signRequest({ ...base, serviceName: 'song' });
  const audio = signRequest({ ...base, serviceName: 'audio' });

  assert.notEqual(music.signature, song.signature);
  assert.notEqual(music.signature, audio.signature);
});

test('getDateTime returns YYYYMMDDTHHMMSSZ format', () => {
  const dt = getDateTime(new Date('2024-07-01T12:00:00.000Z'));
  assert.equal(dt, '20240701T120000Z');
});
