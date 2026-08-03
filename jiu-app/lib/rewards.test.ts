import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS } from './constants.ts';

test('academy stages award their matching fragment type', () => {
  const rewardTypes = [1, 2, 3].map((stageId) => {
    const stageRewards = new Set(
      LEVELS
        .filter((level) => level.stageId === stageId)
        .map((level) => level.rewardType),
    );

    assert.equal(stageRewards.size, 1);
    return [...stageRewards][0];
  });

  assert.deepEqual(rewardTypes, ['绒羽', '怪羽', '暗羽']);
});
