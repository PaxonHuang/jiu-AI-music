import assert from 'node:assert/strict';
import test from 'node:test';
import { signRequest } from './sign.ts';
import {
  VOLC_HOST,
  VOLC_REGION,
  VOLC_SERVICE,
  VOLC_VERSION,
  submitGenBGMForTime,
  submitGenSongForTime,
  querySong,
  pollSongUntilDone,
  STATUS_SUCCESS,
  VolcApiError,
} from './gensong.ts';

const fakeCredentials = {
  accessKeyId: 'AKLT_TEST',
  secretAccessKey: 'SECRET',
};

test('VOLC constants are pinned to the verified working values', () => {
  assert.equal(VOLC_HOST, 'open.volcengineapi.com');
  assert.equal(VOLC_REGION, 'cn-beijing');
  assert.equal(VOLC_SERVICE, 'imagination');
  assert.equal(VOLC_VERSION, '2024-08-12');
});

test('signRequest signs with the same inputs as the upload we observed', () => {
  const result = signRequest({
    method: 'POST',
    uri: '/',
    query: { Action: 'GenBGMForTime', Version: VOLC_VERSION },
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Text: '测试' }),
    region: VOLC_REGION,
    serviceName: VOLC_SERVICE,
    accessKeyId: fakeCredentials.accessKeyId,
    secretAccessKey: fakeCredentials.secretAccessKey,
    host: VOLC_HOST,
  });
  // The Authorization header must mention the service name and region.
  assert.match(
    result.authorization,
    new RegExp(`^HMAC-SHA256 Credential=AKLT_TEST/\\d{8}/${VOLC_REGION}/${VOLC_SERVICE}/request, SignedHeaders=host;x-content-sha256;x-date, Signature=[a-f0-9]{64}$`),
  );
});

test('submitGenSongForTime requires Lyrics or Prompt', () => {
  assert.throws(() => submitGenSongForTime({}, fakeCredentials), /requires either Lyrics or Prompt/);
});

test('VolcApiError carries actionable fields', () => {
  const err = new VolcApiError(450000, 'fail', 'GenBGMForTime', 'req-1');
  assert.equal(err.code, 450000);
  assert.equal(err.action, 'GenBGMForTime');
  assert.equal(err.requestId, 'req-1');
  assert.match(err.message, /GenBGMForTime/);
});

test('submitGenBGMForTime POSTs the verified payload shape', async () => {
  const original = globalThis.fetch;
  let captured: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    captured = { url: String(url), init: init ?? {} };
    return new Response(
      JSON.stringify({
        Code: 0,
        Message: 'success',
        Result: { TaskID: 'task-1', PredictedWaitTime: 0 },
        ResponseMetadata: {
          RequestId: 'req-1',
          Action: 'GenBGMForTime',
          Version: VOLC_VERSION,
          Service: VOLC_SERVICE,
          Region: VOLC_REGION,
          Error: null,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const result = await submitGenBGMForTime({ text: '欢快的鸟鸣' }, fakeCredentials);
    assert.equal(result.taskId, 'task-1');
    assert.ok(captured);
    assert.match(captured.url, /Action=GenBGMForTime/);
    const body = JSON.parse(String(captured.init.body));
    assert.equal(body.Text, '欢快的鸟鸣');
    assert.equal(body.Version, 'v5.0');
  } finally {
    globalThis.fetch = original;
  }
});

test('querySong surfaces VolcApiError on non-zero Code', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        Code: 50000001,
        Message: 'copyright',
        Result: null,
        ResponseMetadata: {
          RequestId: 'r',
          Action: 'QuerySong',
          Version: VOLC_VERSION,
          Service: VOLC_SERVICE,
          Region: VOLC_REGION,
          Error: { Code: '50000001', Message: 'copyright' },
        },
      }),
      { status: 200 },
    )) as typeof fetch;
  try {
    await assert.rejects(() => querySong('task-1', fakeCredentials), (err: unknown) => {
      return err instanceof VolcApiError && err.code === 50000001;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('submitGenSongForTime appends a Chinese instrument directive to Prompt', async () => {
  const original = globalThis.fetch;
  let captured: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    captured = { url: String(url), init: init ?? {} };
    return new Response(
      JSON.stringify({
        Code: 0,
        Message: 'success',
        Result: { TaskID: 'task-2', PredictedWaitTime: 0 },
        ResponseMetadata: {
          RequestId: 'r-2',
          Action: 'GenSongForTime',
          Version: VOLC_VERSION,
          Service: VOLC_SERVICE,
          Region: VOLC_REGION,
          Error: null,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    await submitGenSongForTime(
      {
        lyrics: '主歌歌词',
        prompt: '温暖的童歌',
        genre: '流行',
        mood: '开心',
        instruments: ['钢琴', '吉他'],
      },
      fakeCredentials,
    );
    assert.ok(captured);
    const body = JSON.parse(String(captured.init.body));
    assert.equal(body.Lyrics, '主歌歌词');
    assert.equal(body.Prompt, undefined);
    assert.equal(body.Genre, '流行');
    assert.equal(body.Mood, '开心');
  } finally {
    globalThis.fetch = original;
  }
});

test('submitGenSongForTime leaves Prompt untouched when instruments is empty', async () => {
  const original = globalThis.fetch;
  let captured: { init: RequestInit } | null = null;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    captured = { init: init ?? {} };
    return new Response(
      JSON.stringify({
        Code: 0,
        Message: 'success',
        Result: { TaskID: 'task-3', PredictedWaitTime: 0 },
        ResponseMetadata: {
          RequestId: 'r-3',
          Action: 'GenSongForTime',
          Version: VOLC_VERSION,
          Service: VOLC_SERVICE,
          Region: VOLC_REGION,
          Error: null,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    await submitGenSongForTime(
      { prompt: '安静的摇篮曲', instruments: [] },
      fakeCredentials,
    );
    assert.ok(captured);
    const body = JSON.parse(String(captured.init.body));
    assert.equal(body.Prompt, '安静的摇篮曲');
  } finally {
    globalThis.fetch = original;
  }
});

test('submitGenBGMForTime appends an instrument directive to Text', async () => {
  const original = globalThis.fetch;
  let captured: { init: RequestInit } | null = null;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    captured = { init: init ?? {} };
    return new Response(
      JSON.stringify({
        Code: 0,
        Message: 'success',
        Result: { TaskID: 'task-4', PredictedWaitTime: 0 },
        ResponseMetadata: {
          RequestId: 'r-4',
          Action: 'GenBGMForTime',
          Version: VOLC_VERSION,
          Service: VOLC_SERVICE,
          Region: VOLC_REGION,
          Error: null,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    await submitGenBGMForTime(
      { text: '森林清晨', instruments: ['长笛', '钢琴'] },
      fakeCredentials,
    );
    assert.ok(captured);
    const body = JSON.parse(String(captured.init.body));
    assert.equal(body.Text, '森林清晨，主乐器：长笛、钢琴');
  } finally {
    globalThis.fetch = original;
  }
});

test('pollSongUntilDone resolves on SUCCESS and exits on FAILED', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  const mockFetch: typeof fetch = async () => {
    calls += 1;
    const status = calls === 1 ? 1 : STATUS_SUCCESS;
    const body = JSON.stringify({
      Code: 0,
      Message: 'success',
      Result: {
        TaskID: 'task-1',
        Status: status,
        Progress: 100,
        FailureReason: null,
        SongDetail: { AudioUrl: 'https://example/audio.wav' },
      },
      ResponseMetadata: {
        RequestId: 'r',
        Action: 'QuerySong',
        Version: VOLC_VERSION,
        Service: VOLC_SERVICE,
        Region: VOLC_REGION,
        Error: null,
      },
    });
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  globalThis.fetch = mockFetch;

  try {
    const result = await pollSongUntilDone('task-1', fakeCredentials, {
      intervalMs: 1,
      timeoutMs: 5000,
    });
    assert.equal(result.status, STATUS_SUCCESS);
    assert.equal(result.audioUrl, 'https://example/audio.wav');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
