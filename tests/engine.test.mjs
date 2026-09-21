import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, sanitizeSettings, adjustSpeed, Session } from '../engine.js';
import { createGenerator, validateCustom, parseCustom } from '../content.js';
import { loadSettings, loadHistory, writeData } from '../storage.js';

function makeSession(overrides = {}) {
  let i = 0;
  const session = new Session({ ...DEFAULTS, ...overrides }, () => ({text:String(++i), category:'numbers'}));
  session.start(0);
  return session;
}
test('default is unlimited with independent tiny font support', () => {
  assert.equal(DEFAULTS.duration, 0);
  assert.equal(sanitizeSettings({fontSize:6}).fontSize, 6);
  assert.equal(sanitizeSettings({fontSize:500}).fontSize, 200);
  assert.equal(sanitizeSettings({fontSize:'bad'}).fontSize, 132);
  assert.equal(sanitizeSettings({exposure:1,gap:9999,duration:-1}).exposure,100);
  assert.equal(sanitizeSettings({exposure:1,gap:9999,duration:-1}).gap,2000);
});
test('countdown, exposure, blank interval and item count follow requested times', () => {
  const s = makeSession();
  s.tick(1999); assert.equal(s.status,'countdown'); assert.equal(s.count,0);
  s.tick(2000); assert.equal(s.status,'running'); assert.equal(s.count,1);
  s.tick(2599); assert.equal(s.phase,'show');
  s.tick(2600); assert.equal(s.phase,'gap');
  s.tick(2999); assert.equal(s.count,1);
  s.tick(3000); assert.equal(s.phase,'show'); assert.equal(s.count,2);
});
test('unlimited session keeps running after a day until paused', () => {
  const s = makeSession(); s.tick(2000);
  s.tick(86_402_000); assert.equal(s.status,'running'); assert.equal(s.elapsed,86_400_000);
  s.pause(86_402_000); assert.equal(s.status,'paused');
});
test('pause excludes time away and resume does not duplicate a partial item', () => {
  const s = makeSession(); s.tick(2000); s.pause(2300);
  assert.equal(s.elapsed,300); s.tick(90000); assert.equal(s.elapsed,300);
  s.resume(100000); s.tick(100599); assert.equal(s.phase,'show'); assert.equal(s.count,1);
  s.tick(100600); assert.equal(s.phase,'gap'); assert.equal(s.elapsed,900);
});
test('countdown can pause and resume without starting the activity clock', () => {
  const s = makeSession(); s.pause(1000); s.resume(5000); s.tick(5999);
  assert.equal(s.status,'countdown'); assert.equal(s.elapsed,0);
  s.tick(6000); assert.equal(s.status,'running'); assert.equal(s.elapsed,0);
});
test('timed session finishes exactly and a delayed frame never invents unseen items', () => {
  const s = makeSession({duration:60}); s.tick(2000); s.tick(32000);
  assert.equal(s.count,1); s.tick(62001); assert.equal(s.status,'completed');
  assert.equal(s.elapsed,60000); assert.equal(s.reason,'complete');
  s.tick(70000); assert.equal(s.elapsed,60000);
});
test('speed changes apply to future phases and stay within bounds', () => {
  const s = makeSession(); s.tick(2000); s.setTiming(200,100);
  s.tick(2200); assert.equal(s.phase,'show'); s.tick(2600); assert.equal(s.phase,'gap');
  s.tick(2700); assert.equal(s.count,2); s.tick(2900); assert.equal(s.phase,'gap');
  assert.deepEqual(adjustSpeed({exposure:100,gap:100},'faster'),{exposure:100,gap:100});
  assert.deepEqual(adjustSpeed({exposure:2000,gap:2000},'slower'),{exposure:2000,gap:2000});
});
test('number generation has exact lengths and no adjacent repeats, even for constant RNG', () => {
  for (const [difficulty, digits] of [['easy',2],['standard',4],['challenge',6]]) {
    const next = createGenerator({...DEFAULTS,category:'numbers',difficulty},()=>0);
    let previous = '';
    for (let i=0;i<100;i++) { const item = next(); assert.equal(item.text.length,digits); assert.notEqual(item.text,previous); previous=item.text; }
  }
});
test('mixed content balances categories and word bags prevent repeats across refills', () => {
  const mixed = createGenerator(DEFAULTS);
  for (let i=0;i<100;i++) assert.deepEqual(new Set([mixed().category,mixed().category,mixed().category]),new Set(['numbers','chinese','english']));
  for (const category of ['chinese','english','custom']) {
    const next = createGenerator({...DEFAULTS,category,custom:'alpha\nbeta'},()=>0);
    let previous='';
    for (let i=0;i<300;i++) { const current=next().text; assert.notEqual(current,previous); previous=current; }
  }
});
test('all built-in word lengths match the selected level', () => {
  for (const difficulty of ['easy','standard','challenge']) {
    for (const category of ['english','chinese']) {
      const next = createGenerator({...DEFAULTS, category, difficulty});
      for (let i=0;i<200;i++) {
        const n=next().text.length;
        if (category==='chinese') assert.equal(n,difficulty==='challenge'?4:2);
        else if(difficulty==='easy') assert.ok(n>=2&&n<=4);
        else if(difficulty==='standard') assert.ok(n>=5&&n<=7);
        else assert.ok(n>=8);
      }
    }
  }
});
test('custom parsing preserves phrases, removes duplicates and rejects invalid libraries', () => {
  assert.deepEqual(parseCustom(' a,b，清风\n清风;hello world；2048'),['a','b','清风','hello world','2048']);
  assert.ok(validateCustom('a\na'));
  assert.ok(validateCustom('a\n'+'x'.repeat(25)));
  assert.equal(validateCustom('a\nb'),'');
});
test('storage failures and corrupted persisted data do not prevent use', () => {
  const blocked = {getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  assert.deepEqual(loadSettings(blocked),DEFAULTS);
  assert.deepEqual(loadHistory(blocked),[]);
  assert.equal(writeData(blocked,'history',[]),false);
  assert.deepEqual(loadHistory({getItem:()=>'{bad json'}),[]);
  assert.deepEqual(loadHistory({getItem:()=>JSON.stringify([null,{at:'bad'}])}),[]);
});
