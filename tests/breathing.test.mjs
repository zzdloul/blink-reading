import test from 'node:test';
import assert from 'node:assert/strict';
import { breathAt, normalizeRhythm } from '../breathing.js';

test('breathing settings accept half seconds and recover from old or damaged data', () => {
  assert.deepEqual(normalizeRhythm(null), { inhale: 3, topUp: 1, exhale: 6, minutes: 2 });
  assert.deepEqual(normalizeRhythm({ inhale: -1, topUp: 1.49, exhale: 99, minutes: 'bad' }),
    { inhale: 1, topUp: 1.5, exhale: 15, minutes: 2 });
});

test('all three phases meet continuously and repeat at their configured boundaries', () => {
  const rhythm = { inhale: 2.5, topUp: 0.5, exhale: 4.5 };
  for (const [time, phase, size, remaining] of [[0,0,.6,3], [2.5,1,.86,1], [3,2,1,5], [7.5,0,.6,3]]) {
    const frame = breathAt(time, rhythm);
    assert.equal(frame.phase, phase);
    assert.equal(frame.remaining, remaining);
    assert.equal(frame.size, size);
    if (time) assert.ok(Math.abs(breathAt(time - .001, rhythm).size - size) < .00001);
  }
});
