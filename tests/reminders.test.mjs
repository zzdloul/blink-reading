import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReminderDeck, themes } from '../reminders.js';

test('each topic has twenty distinct reminders and the mixed deck has sixty', () => {
  for (const lines of Object.values(themes)) assert.equal(lines.length, 20);
  assert.equal(new Set(Object.values(themes).flat()).size, 60);
});

for (const [topic, lines] of Object.entries({ ...themes, all: Object.values(themes).flat() })) {
  test(topic + ' covers its complete sentences once per round without a boundary repeat', () => {
    const draw = createReminderDeck(topic, () => 0.5);
    const round = Array.from({ length: lines.length }, draw);
    assert.deepEqual([...round].sort(), [...lines].sort());
    assert.equal(new Set(round).size, lines.length);
    assert.ok(round.every(line => line.endsWith('。')));
    assert.notEqual(draw(), round.at(-1));
  });
}
