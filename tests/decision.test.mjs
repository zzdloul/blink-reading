import assert from 'node:assert/strict';
import test from 'node:test';
import { BLANK_MS, createDecisionStream, DECISION_MODES, DECISION_PRESETS, sanitizeSeconds } from '../decision.js';

function makeRng(seed = 109) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

test('sanitizeSeconds and presets keep clean timing bounds', () => {
  assert.equal(BLANK_MS, 200);
  assert.equal(sanitizeSeconds(1.5, 2), 1.5);
  assert.equal(sanitizeSeconds('0.5', 2), 0.5);
  assert.equal(sanitizeSeconds(60, 2), 60);
  assert.equal(sanitizeSeconds(0.2, 1.5), 1.5);
  assert.equal(sanitizeSeconds(61, 1.5), 1.5);
  assert.equal(sanitizeSeconds('bad', 1.0), 1.0);
  assert.equal(sanitizeSeconds(1.256, 2), 1.26);
  assert.deepEqual(Object.keys(DECISION_PRESETS), ['calm', 'standard', 'fast']);
});

test('mixed decision stream rotates across all four visual modes without adjacent mode repeats', () => {
  const next = createDecisionStream('all', makeRng(2026));
  const counts = new Map();
  let lastKind = '';

  for (let i = 0; i < 400; i++) {
    const trial = next();
    assert.ok(trial.kind in DECISION_MODES);
    assert.equal(trial.kindLabel, DECISION_MODES[trial.kind]);
    assert.notEqual(trial.kind, lastKind);
    lastKind = trial.kind;
    counts.set(trial.kind, (counts.get(trial.kind) ?? 0) + 1);
  }

  for (const kind of Object.keys(DECISION_MODES)) {
    assert.equal(counts.get(kind), 100);
  }
});

test('all four visual modes yield valid answers, conflict variations, and both rule directions', () => {
  const rng = makeRng(77);

  const figNext = createDecisionStream('figures', rng);
  const figRules = new Set();
  const figAnswers = new Set();
  for (let i = 0; i < 80; i++) {
    const t = figNext();
    assert.equal(t.kind, 'figures');
    figRules.add(t.rule);
    figAnswers.add(t.answer);
    const expectedSame = t.rule === 'color' ? t.color[0] === t.color[1] : t.shape[0] === t.shape[1];
    assert.equal(t.match, expectedSame);
    assert.equal(t.answer, expectedSame ? '相同' : '不同');
  }
  assert.deepEqual(figRules, new Set(['color', 'shape']));
  assert.deepEqual(figAnswers, new Set(['相同', '不同']));

  const stroopNext = createDecisionStream('stroop', rng);
  const stroopRules = new Set();
  const stroopConflicts = new Set();
  for (let i = 0; i < 80; i++) {
    const t = stroopNext();
    assert.equal(t.kind, 'stroop');
    stroopRules.add(t.rule);
    stroopConflicts.add(t.conflict);
    assert.equal(t.answer, t.rule === 'word' ? `「${t.word}」` : `${t.inkName}色`);
  }
  assert.deepEqual(stroopRules, new Set(['word', 'ink']));
  assert.deepEqual(stroopConflicts, new Set([true, false]));

  const magNext = createDecisionStream('magnitude', rng);
  const magRules = new Set();
  const magWinners = new Set();
  const magConflicts = new Set();
  for (let i = 0; i < 80; i++) {
    const t = magNext();
    assert.equal(t.kind, 'magnitude');
    assert.notEqual(t.values[0], t.values[1]);
    assert.notEqual(t.sizes[0], t.sizes[1]);
    magRules.add(t.rule);
    magWinners.add(t.winner);
    magConflicts.add(t.conflict);
    const expectedWinner = t.rule === 'size'
      ? (t.sizes[0] === 'large' ? 0 : 1)
      : (t.values[0] > t.values[1] ? 0 : 1);
    assert.equal(t.winner, expectedWinner);
    assert.equal(t.answer, expectedWinner === 0 ? '左边' : '右边');
  }
  assert.deepEqual(magRules, new Set(['value', 'size']));
  assert.deepEqual(magWinners, new Set([0, 1]));
  assert.deepEqual(magConflicts, new Set([true, false]));

  const arrowNext = createDecisionStream('arrows', rng);
  const arrowRules = new Set();
  const arrowDirs = new Set();
  const arrowConflicts = new Set();
  for (let i = 0; i < 80; i++) {
    const t = arrowNext();
    assert.equal(t.kind, 'arrows');
    arrowRules.add(t.rule);
    arrowDirs.add(t.targetDir);
    arrowConflicts.add(t.conflict);
    assert.equal(t.conflict, t.centerDir !== t.outerDir);
    assert.equal(t.targetDir, t.rule === 'center' ? t.centerDir : t.outerDir);
  }
  assert.deepEqual(arrowRules, new Set(['center', 'outer']));
  assert.deepEqual(arrowDirs, new Set(['left', 'right', 'up', 'down']));
  assert.deepEqual(arrowConflicts, new Set([true, false]));

  assert.throws(() => createDecisionStream('unknown'));
});
