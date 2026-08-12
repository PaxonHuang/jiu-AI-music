import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMockProvider, MOCK_PROVIDER_NAME } from './mock-provider.ts';
import {
  resolveProviderName,
  resetMusicProviderCache,
  selectMusicProvider,
  VOLCENGINE_PROVIDER_NAME,
} from './provider.ts';
import { MusicProviderError } from './types.ts';

// --- selection ------------------------------------------------------------

test('explicit MUSIC_PROVIDER wins over credential detection', () => {
  assert.equal(
    resolveProviderName({ MUSIC_PROVIDER: 'mock', VOLC_ACCESS_KEY: 'a', VOLC_SECRET_KEY: 'b' }),
    MOCK_PROVIDER_NAME,
  );
  assert.equal(
    resolveProviderName({ MUSIC_PROVIDER: 'volcengine' }),
    VOLCENGINE_PROVIDER_NAME,
  );
});

test('MUSIC_PROVIDER is matched case-insensitively and trimmed', () => {
  assert.equal(resolveProviderName({ MUSIC_PROVIDER: '  MOCK ' }), MOCK_PROVIDER_NAME);
});

test('unknown MUSIC_PROVIDER is rejected rather than silently defaulted', () => {
  assert.throws(() => resolveProviderName({ MUSIC_PROVIDER: 'suno' }), /Unknown MUSIC_PROVIDER/);
});

test('credentials select volcengine when MUSIC_PROVIDER is unset', () => {
  assert.equal(
    resolveProviderName({ VOLC_ACCESS_KEY: 'a', VOLC_SECRET_KEY: 'b' }),
    VOLCENGINE_PROVIDER_NAME,
  );
});

test('missing credentials fall back to mock outside production', () => {
  assert.equal(resolveProviderName({ NODE_ENV: 'development' }), MOCK_PROVIDER_NAME);
  assert.equal(resolveProviderName({}), MOCK_PROVIDER_NAME);
});

test('missing credentials are a hard error in production, never silent mock audio', () => {
  assert.throws(
    () => resolveProviderName({ NODE_ENV: 'production' }),
    /required in production/,
  );
});

test('a partial credential pair does not count as configured', () => {
  assert.equal(resolveProviderName({ VOLC_ACCESS_KEY: 'a' }), MOCK_PROVIDER_NAME);
  assert.equal(resolveProviderName({ VOLC_SECRET_KEY: 'b' }), MOCK_PROVIDER_NAME);
});

test('selectMusicProvider memoises so mock task state survives polling', () => {
  resetMusicProviderCache();
  const first = selectMusicProvider({ MUSIC_PROVIDER: 'mock' });
  const second = selectMusicProvider({ MUSIC_PROVIDER: 'mock' });
  assert.equal(first, second);
  resetMusicProviderCache();
  assert.notEqual(selectMusicProvider({ MUSIC_PROVIDER: 'mock' }), first);
});

// --- mock provider behaviour ---------------------------------------------

test('mock task advances pending -> running -> success on the injected clock', async () => {
  let clock = 1000;
  const provider = createMockProvider({ durationMs: 1000, now: () => clock });

  const { taskId, predictedWaitTime } = await provider.createTask({
    track: 'vocal',
    lyrics: '小鸟在唱歌',
  });
  assert.equal(predictedWaitTime, 1);

  assert.equal((await provider.getTask(taskId)).status, 'pending');

  clock = 1500;
  const midway = await provider.getTask(taskId);
  assert.equal(midway.status, 'running');
  assert.equal(midway.progress, 50);
  assert.equal(midway.audioUrl, undefined);

  clock = 2000;
  const done = await provider.getTask(taskId);
  assert.equal(done.status, 'success');
  assert.equal(done.progress, 100);
  assert.equal(done.audioUrl, '/audio/sample-song.mp3');
  assert.equal(done.lyrics, '小鸟在唱歌');
  assert.equal(done.failure, null);
});

test('mock uses the prompt as lyrics when only a prompt was given', async () => {
  const provider = createMockProvider({ durationMs: 0 });
  const { taskId } = await provider.createTask({ track: 'vocal', prompt: '关于春天' });
  assert.equal((await provider.getTask(taskId)).lyrics, '关于春天');
});

test('mock issues distinct ids for concurrent tasks', async () => {
  const provider = createMockProvider({ now: () => 42 });
  const a = await provider.createTask({ track: 'vocal', lyrics: 'a' });
  const b = await provider.createTask({ track: 'vocal', lyrics: 'b' });
  assert.notEqual(a.taskId, b.taskId);
});

test('mock task ids satisfy the status route taskId pattern', async () => {
  const provider = createMockProvider();
  const { taskId } = await provider.createTask({ track: 'instrumental', text: '森林' });
  assert.match(taskId, /^[A-Za-z0-9_-]{6,128}$/);
});

test('unknown mock task raises MusicProviderError, not a bare Error', async () => {
  const provider = createMockProvider();
  await assert.rejects(
    () => provider.getTask('mock-does-not-exist'),
    (err: unknown) => {
      assert.ok(err instanceof MusicProviderError);
      assert.equal(err.provider, MOCK_PROVIDER_NAME);
      assert.equal(err.code, 404);
      return true;
    },
  );
});
