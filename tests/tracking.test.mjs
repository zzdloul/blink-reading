import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, TRACKING_DEFAULTS, sanitizeTrackingSettings, sanitizeTrackingHistory, createTrajectory, TrackingSession } from '../tracking-engine.js';

function session(options = {}) {
  const settings = { ...TRACKING_DEFAULTS, ...options };
  const s = new TrackingSession(settings, createTrajectory(settings.path, 320, 300, settings.range));
  s.start(0); return s;
}
function advance(s, duration, step = 20) {
  const end = s.lastTime + duration;
  while (s.lastTime < end && ['countdown','running'].includes(s.status)) s.tick(Math.min(end, s.lastTime + step));
}
const distance = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);

test('tracking defaults preserve manual unlimited practice and clamp saved input', () => {
  assert.equal(TRACKING_DEFAULTS.duration,0);
  assert.deepEqual(sanitizeTrackingSettings(null),TRACKING_DEFAULTS);
  const settings=sanitizeTrackingSettings({path:'__proto__',speed:Infinity,size:1,range:9,guide:false,duration:60});
  assert.equal(settings.path,'horizontal'); assert.equal(settings.speed,0.7);
  assert.equal(settings.size,6); assert.equal(settings.range,0.7); assert.equal(settings.guide,false); assert.equal(settings.duration,60);
});
test('every trajectory remains inside target-safe bounds on phone and desktop', () => {
  for (const path of Object.keys(TRACKS)) for (const [width,height] of [[240,160],[320,450],[900,420]]) {
    const route=createTrajectory(path,width,height,0.9);
    for(let i=0;i<=2000;i++) {
      const p=route.at(i/2000*route.length);
      assert.ok(p.x>=32&&p.x<=width-32,`${path}: x ${p.x}`);
      assert.ok(p.y>=32&&p.y<=height-32,`${path}: y ${p.y}`);
    }
  }
});
test('closed paths join without jumps and adjacent frame positions remain close', () => {
  for (const path of Object.keys(TRACKS)) {
    const route=createTrajectory(path,400,300);
    assert.ok(distance(route.at(0),route.at(route.length))<1e-8);
    assert.ok(distance(route.at(route.length-0.001),route.at(0.001))<0.003);
    for(let i=0;i<1000;i++) {
      const d=i/1000*route.length;
      assert.ok(distance(route.at(d),route.at(d+1))<=1.002);
    }
  }
});
test('straight paths ease through each reversal rather than reversing at full speed', () => {
  const route=createTrajectory('horizontal',400,300);
  const end=route.length/4;
  const near=distance(route.at(end),route.at(end+0.5));
  const middle=distance(route.at(0),route.at(0.5));
  assert.ok(near < middle/100);
});
test('countdown does not move target or count time, and running starts smoothly', () => {
  const s=session(); const initial=s.position;
  advance(s,2000); assert.equal(s.status,'running'); assert.equal(s.elapsed,0); assert.deepEqual(s.position,initial);
  advance(s,100); assert.ok(s.elapsed===100); assert.ok(s.distance>0); assert.ok(s.effectiveSpeed < s.settings.speed);
});
test('pausing and resuming preserve position and exclude the rest/countdown duration', () => {
  const s=session(); advance(s,3000); s.pause(s.lastTime);
  const p=s.position, elapsed=s.elapsed;
  s.tick(100000); assert.deepEqual(s.position,p); assert.equal(s.elapsed,elapsed);
  s.resume(100000); advance(s,1200); assert.deepEqual(s.position,p); assert.equal(s.elapsed,elapsed);
  advance(s,100); assert.equal(s.elapsed,elapsed+100); assert.ok(distance(s.position,p)<10);
});
test('changing speed never teleports or instantly changes the actual speed', () => {
  const s=session({path:'eight'}); advance(s,4000);
  const p=s.position, speed=s.effectiveSpeed;
  s.setSpeed(2); assert.deepEqual(s.position,p); assert.equal(s.effectiveSpeed,speed);
  advance(s,20); assert.ok(s.effectiveSpeed>speed&&s.effectiveSpeed<2); assert.ok(distance(s.position,p)<5);
});
test('lost action is self-reported once, pauses, and remains distinct from ordinary rest', () => {
  const s=session(); advance(s,3000); s.reportLost(s.lastTime);
  assert.equal(s.lost,1); assert.equal(s.status,'paused'); assert.equal(s.pauseCause,'lost');
  s.reportLost(s.lastTime); assert.equal(s.lost,1);
  s.resume(s.lastTime); advance(s,1400); s.pause(s.lastTime); assert.equal(s.lost,1);
});
test('a stalled frame pauses without skipping across the track or counting unseen time', () => {
  const s=session(); advance(s,3000); const p=s.position, elapsed=s.elapsed;
  s.tick(s.lastTime+3000); assert.equal(s.status,'paused'); assert.equal(s.pauseCause,'interruption');
  assert.deepEqual(s.position,p); assert.equal(s.elapsed,elapsed);
});
test('unlimited keeps running and timed session stops at its duration', () => {
  const unlimited=session(); advance(unlimited,622000,100);
  assert.equal(unlimited.status,'running'); assert.equal(unlimited.elapsed,620000);
  const timed=session({duration:60}); advance(timed,63000,100);
  assert.equal(timed.status,'completed'); assert.equal(timed.elapsed,60000); assert.equal(timed.reason,'complete');
});
test('resizing preserves path fraction and explicit path changes restart at a findable point', () => {
  const s=session({path:'oval'}); advance(s,5000); s.pause(s.lastTime);
  const fraction=s.distance/s.trajectory.length;
  s.setTrajectory(createTrajectory('oval',500,400)); assert.ok(Math.abs(s.distance/s.trajectory.length-fraction)<1e-10);
  s.setTrajectory(createTrajectory('eight',500,400),true); assert.equal(s.distance,0);
  assert.deepEqual([...s.paths],['oval','eight']);
});
test('tracking history validates input and limits size without touching reading history', () => {
  const record={id:'x',at:Date.now(),seconds:12,lost:2,speed:1,paths:['oval']};
  assert.deepEqual(sanitizeTrackingHistory([null,{...record,paths:['bad']},record]),[record]);
  assert.equal(sanitizeTrackingHistory(Array(150).fill(record)).length,100);
  assert.deepEqual(sanitizeTrackingHistory({}),[]);
});
