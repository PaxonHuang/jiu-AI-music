import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fromSqlBool, getDb, isD1Database, nowIso, toSqlBool } from './db.ts';

test('isD1Database accepts a D1-shaped binding', () => {
  const binding = {
    prepare: () => ({}),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
  assert.equal(isD1Database(binding), true);
});

test('isD1Database rejects non-D1 values', () => {
  assert.equal(isD1Database(null), false);
  assert.equal(isD1Database(undefined), false);
  assert.equal(isD1Database({}), false);
  // An R2 binding must not be mistaken for a database.
  assert.equal(isD1Database({ get: () => {}, put: () => {} }), false);
  // prepare() alone is not enough.
  assert.equal(isD1Database({ prepare: () => ({}) }), false);
});

test('getDb returns null outside a Worker instead of throwing', async () => {
  assert.equal(await getDb(), null);
});

test('boolean helpers round-trip through SQLite 0/1 storage', () => {
  assert.equal(toSqlBool(true), 1);
  assert.equal(toSqlBool(false), 0);
  assert.equal(fromSqlBool(1), true);
  assert.equal(fromSqlBool(0), false);
  assert.equal(fromSqlBool(null), false);
  assert.equal(fromSqlBool(undefined), false);
  assert.equal(fromSqlBool(toSqlBool(true)), true);
  assert.equal(fromSqlBool(toSqlBool(false)), false);
});

test('nowIso produces an ISO-8601 timestamp the schema can store as text', () => {
  const value = nowIso();
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(Number.isNaN(Date.parse(value)), false);
});
