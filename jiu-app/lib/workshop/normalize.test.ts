import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeStoredPublishedWorks, normalizeStoredDraft } from './normalize.ts';

// The shape app/community/page.tsx has been reading out of
// localStorage['jiu_workshop_works'] since before any of this existed. If the
// normalizer ever rejects it, previously saved songs silently vanish from the
// community tab — so this is the regression that matters most.
const LEGACY_WORK = {
  id: 1723000000000,
  title: '我的小猫',
  genre: 'pop',
  mood: 'happy',
  status: 'published',
  audio: '/api/music/audio/202608436498118849069057',
  caption: '送给我的猫',
  emoji: '🐱',
  instruments: ['piano', 'guitar'],
  taskId: '202608436498118849069057',
};

test('legacy stored works survive normalization', () => {
  const works = normalizeStoredPublishedWorks(JSON.stringify([LEGACY_WORK]));
  assert.ok(works);
  assert.equal(works.length, 1);
  const work = works[0];
  assert.equal(work.id, LEGACY_WORK.id);
  assert.equal(work.title, '我的小猫');
  assert.equal(work.audio, LEGACY_WORK.audio);
  assert.equal(work.taskId, LEGACY_WORK.taskId);
  assert.deepEqual(work.instruments, ['piano', 'guitar']);
});

test('createdAt is backfilled for records saved before the field existed', () => {
  const works = normalizeStoredPublishedWorks(JSON.stringify([LEGACY_WORK]));
  assert.ok(works?.[0].createdAt);
  assert.equal(Number.isNaN(Date.parse(works[0].createdAt)), false);
});

test('fields the legacy shape never had come back undefined, not null', () => {
  const [work] = normalizeStoredPublishedWorks(JSON.stringify([LEGACY_WORK])) ?? [];
  assert.equal(work.authorId, undefined);
  assert.equal(work.sourceProvider, undefined);
  assert.equal(work.lyrics, undefined);
});

test('malformed entries are dropped without discarding the good ones', () => {
  const works = normalizeStoredPublishedWorks(
    JSON.stringify([LEGACY_WORK, { id: 'not-a-number' }, null, 42, { ...LEGACY_WORK, id: 2 }]),
  );
  assert.equal(works?.length, 2);
});

test('a record missing a required field is dropped rather than half-built', () => {
  const { audio, ...noAudio } = LEGACY_WORK;
  void audio;
  assert.deepEqual(normalizeStoredPublishedWorks(JSON.stringify([noAudio])), []);
});

test('unparseable or non-array payloads yield null, not a throw', () => {
  assert.equal(normalizeStoredPublishedWorks('{not json'), null);
  assert.equal(normalizeStoredPublishedWorks(null), null);
  assert.equal(normalizeStoredPublishedWorks('{"a":1}'), null);
});

test('collaborator-shaped records with the extra fields round-trip intact', () => {
  const collaboratorWork = {
    ...LEGACY_WORK,
    createdAt: '2026-08-01T00:00:00.000Z',
    authorId: 'device-uuid',
    sourceProvider: 'upstream',
    lyrics: '喵喵喵',
  };
  const [work] = normalizeStoredPublishedWorks(JSON.stringify([collaboratorWork])) ?? [];
  assert.equal(work.createdAt, '2026-08-01T00:00:00.000Z');
  assert.equal(work.authorId, 'device-uuid');
  assert.equal(work.sourceProvider, 'upstream');
  assert.equal(work.lyrics, '喵喵喵');
});

test('draft normalization rejects records with an unusable mode or voice', () => {
  assert.equal(normalizeStoredDraft(JSON.stringify({ lyricsMode: 'nope', voice: 'female' })), null);
  assert.equal(normalizeStoredDraft(JSON.stringify({ lyricsMode: 'ai', voice: 'robot' })), null);
});

test('draft normalization fills defaults that match lib/constants ids', () => {
  const draft = normalizeStoredDraft(JSON.stringify({ lyricsMode: 'ai', voice: 'female' }));
  assert.ok(draft);
  assert.equal(draft.genre, 'pop');
  assert.equal(draft.mood, 'happy');
  assert.deepEqual(draft.instruments, ['piano']);
});
