import assert from 'node:assert/strict';
import test from 'node:test';
import { createEvidenceStream } from '../evidence.js';

test('all evidence templates keep generating varied cases with both answers', () => {
  let seed = 83;
  const next = createEvidenceStream(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });
  const groups = new Map();
  let previous;
  for (let i = 0; i < 600; i++) {
    const trial = next();
    assert.notEqual(trial.question, previous);
    previous = trial.question;
    const group = groups.get(trial.question) ?? { contexts: new Set(), answers: new Set() };
    groups.set(trial.question, group);
    group.contexts.add(trial.context);
    group.answers.add(trial.correct);
    const numbers = trial.context.match(/\d+/g)?.map(Number);
    if (trial.question === '能确认人数达到要求吗？') assert.equal(trial.correct, numbers[1] >= numbers[0]);
    if (trial.question === '这批记录能证明甲的比例更低吗？') {
      const [totalA, countA, totalB, countB] = numbers;
      assert.equal(trial.correct, countA * totalB < countB * totalA);
    }
    if (trial.question === '这次对比只改变了一个条件吗？') assert.equal(trial.correct, numbers[0] === numbers[1]);
  }
  assert.equal(groups.size, 6);
  for (const group of groups.values()) {
    assert.ok(group.contexts.size >= 10);
    assert.deepEqual(group.answers, new Set([true, false]));
  }
});
