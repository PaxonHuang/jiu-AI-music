import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isR2Binding, persistAudioToR2 } from './r2.ts';

function fakeBucket(existing: boolean) {
  const puts: string[] = [];
  return {
    puts,
    binding: {
      async get() {
        return existing ? { body: undefined, httpMetadata: {} } : null;
      },
      async put(key: string) {
        puts.push(key);
        return undefined;
      },
    },
  };
}

test('passes through when no bucket is bound', async () => {
  const result = await persistAudioToR2(null, 'https://vendor.example/song.wav', 'task-1');
  assert.deepEqual(result, { url: 'https://vendor.example/song.wav', persisted: false });
});

// Regression: the mock provider returns an app-local path, and fetch() rejects
// a relative URL — this used to surface as `Invalid URL: /audio/sample-song.mp3`
// from the status route the moment a mock task succeeded.
test('passes through app-local paths instead of trying to fetch them', async () => {
  const { binding, puts } = fakeBucket(false);
  const result = await persistAudioToR2(binding, '/audio/sample-song.mp3', 'mock-1');
  assert.deepEqual(result, { url: '/audio/sample-song.mp3', persisted: false });
  assert.deepEqual(puts, [], 'must not write a local path into R2');
});

test('reuses an already-persisted object without re-downloading', async () => {
  const { binding, puts } = fakeBucket(true);
  const result = await persistAudioToR2(binding, 'https://vendor.example/song.wav', 'task-2');
  assert.equal(result.persisted, true);
  assert.equal(result.url, '/api/music/audio/task-2');
  assert.deepEqual(puts, [], 'existing object must not be overwritten');
});

test('isR2Binding distinguishes an R2 binding from a D1 database', () => {
  assert.equal(isR2Binding({ get: () => {}, put: () => {} }), true);
  assert.equal(isR2Binding({ prepare: () => {}, batch: () => {} }), false);
  assert.equal(isR2Binding(null), false);
});
