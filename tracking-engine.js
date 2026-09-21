export const TRACKS = Object.freeze({
  horizontal: '水平往返', vertical: '垂直往返', oval: '椭圆环绕',
  eight: '8 字环绕', wander: '自由曲线', random: '随机追踪'
});
export const TRACKING_DEFAULTS = Object.freeze({
  path: 'random', speed: 0.7, size: 24, range: 0.7, duration: 0, guide: true
});
const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function number(value, lo, hi, fallback, step = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Number((clamp(Math.round(value / step) * step, lo, hi)).toFixed(2));
}
export function sanitizeTrackingSettings(value) {
  const v = value && typeof value === 'object' ? value : {};
  return {
    path: Object.hasOwn(TRACKS, v.path) ? v.path : TRACKING_DEFAULTS.path,
    speed: number(v.speed, 0.3, 2.5, TRACKING_DEFAULTS.speed, 0.1),
    size: number(v.size, 6, 64, TRACKING_DEFAULTS.size),
    range: [0.45, 0.7, 0.9].includes(v.range) ? v.range : TRACKING_DEFAULTS.range,
    duration: [0, 60, 120, 300].includes(v.duration) ? v.duration : 0,
    guide: typeof v.guide === 'boolean' ? v.guide : true
  };
}
export function sanitizeTrackingHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(r => r && typeof r.id === 'string' && Number.isFinite(r.at) &&
    Math.abs(r.at) <= 8.64e15 && Number.isFinite(r.seconds) && r.seconds >= 0 &&
    Number.isInteger(r.lost) && r.lost >= 0 && Number.isFinite(r.speed) && r.speed >= 0.3 && r.speed <= 2.5 &&
    Array.isArray(r.paths) && r.paths.length > 0 && r.paths.length <= Object.keys(TRACKS).length && r.paths.every(p => Object.hasOwn(TRACKS, p))
  ).slice(0, 100);
}

// One closed, bounded path. Linear routes retain sinusoidal easing at their ends;
// curved routes use arc-length interpolation so narrow ellipses do not surge.
export function createTrajectory(path, width, height, range = 0.7, random = Math.random) {
  path = Object.hasOwn(TRACKS, path) ? path : 'horizontal';
  const w = Math.max(8, Number.isFinite(width) ? width : 300);
  const h = Math.max(8, Number.isFinite(height) ? height : 220);
  const extent = clamp(range, 0.1, 0.9);
  const cx = w / 2, cy = h / 2;
  const ax = Math.max(1, cx - 36) * extent;
  const ay = Math.max(1, cy - 36) * extent;
  const baseSpeed = clamp(Math.min(w, h) * 0.32, 35, 145);
  if (path === 'random') return {
    path, width: w, height: h, range: extent, baseSpeed,
    ...createRandomPath(cx, cy, ax, ay, random)
  };
  const point = t => {
    if (path === 'horizontal') return { x: cx + ax * Math.sin(t), y: cy };
    if (path === 'vertical') return { x: cx, y: cy + ay * Math.sin(t) };
    if (path === 'oval') return { x: cx + ax * Math.cos(t), y: cy + ay * Math.sin(t) };
    if (path === 'eight') return { x: cx + ax * Math.sin(t), y: cy + ay * Math.sin(2 * t) };
    return { x: cx + ax * (Math.sin(2 * t) + 0.28 * Math.sin(5 * t)) / 1.28,
      y: cy + ay * (Math.cos(3 * t) + 0.2 * Math.sin(7 * t)) / 1.2 };
  };
  const samples = Array.from({ length: 721 }, (_, i) => point(i / 720 * TAU));
  const cumulative = [0];
  for (let i = 1; i < samples.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
  }
  const linear = path === 'horizontal' || path === 'vertical';
  const amplitude = path === 'horizontal' ? ax : ay;
  const length = linear ? TAU * amplitude : cumulative.at(-1);
  const at = distance => {
    const d = ((distance % length) + length) % length;
    if (linear) return point(d / amplitude);
    let low = 0, high = cumulative.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (cumulative[mid] <= d) low = mid; else high = mid;
    }
    const fraction = (d - cumulative[low]) / (cumulative[high] - cumulative[low] || 1);
    return { x: samples[low].x + (samples[high].x - samples[low].x) * fraction,
      y: samples[low].y + (samples[high].y - samples[low].y) * fraction };
  };
  return { path, width: w, height: h, range: extent, length, at, samples,
    // Relative to the shorter side so phone motion stays in a usable range.
    baseSpeed };
}

// Quadratic spline segments stay within the convex hull of their control points.
// Neighboring segments meet at midpoints with the same tangent. Generate only
// the current segment: no finite playlist to repeat and no growing history.
function createRandomPath(cx, cy, ax, ay, random) {
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const randomPoint = () => ({ x: cx + (random() * 2 - 1) * ax, y: cy + (random() * 2 - 1) * ay });
  const angle = random() * TAU;
  let previous = { x: cx - Math.cos(angle) * ax * 0.7, y: cy - Math.sin(angle) * ay * 0.7 };
  let anchor = { x: 2 * cx - previous.x, y: 2 * cy - previous.y };
  let offset = 0, segmentLength = 0, points = [], lengths = [];
  function nextSegment() {
    let next, bestScore = -Infinity;
    const vx = (anchor.x - previous.x) / ax, vy = (anchor.y - previous.y) / ay;
    // Prefer useful travel distances and avoid a near-exact U-turn. The bounded
    // candidate count also guarantees progress with an unusual random source.
    for (let i = 0; i < 16; i++) {
      const candidate = randomPoint();
      const dx = (candidate.x - anchor.x) / ax, dy = (candidate.y - anchor.y) / ay;
      const span = Math.hypot(dx, dy);
      const alignment = (vx * dx + vy * dy) / (Math.hypot(vx, vy) * span || 1);
      const score = span + alignment;
      if (score > bestScore) { next = candidate; bestScore = score; }
      if (span > 0.65 && alignment > -0.75) { next = candidate; break; }
    }
    const start = midpoint(previous, anchor), end = midpoint(anchor, next);
    points = Array.from({ length: 97 }, (_, i) => {
      const t = i / 96, u = 1 - t;
      return { x: u * u * start.x + 2 * u * t * anchor.x + t * t * end.x,
        y: u * u * start.y + 2 * u * t * anchor.y + t * t * end.y };
    });
    lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    segmentLength = Math.max(0.001, lengths.at(-1));
    previous = anchor; anchor = next;
  }
  nextSegment();
  return {
    dynamic: true, length: Infinity, samples: [],
    at(distance) {
      while (distance > offset + segmentLength) { offset += segmentLength; nextSegment(); }
      const local = Math.max(0, distance - offset);
      let low = 0, high = lengths.length - 1;
      while (high - low > 1) {
        const mid = (low + high) >> 1;
        if (lengths[mid] <= local) low = mid; else high = mid;
      }
      const fraction = clamp((local - lengths[low]) / (lengths[high] - lengths[low] || 1), 0, 1);
      return { x: points[low].x + (points[high].x - points[low].x) * fraction,
        y: points[low].y + (points[high].y - points[low].y) * fraction };
    }
  };
}

export class TrackingSession {
  constructor(settings, trajectory) {
    this.settings = { ...settings };
    this.trajectory = trajectory;
    this.paths = new Set([settings.path]);
    this.status = 'ready';
    this.elapsed = 0;
    this.distance = 0;
    this.effectiveSpeed = 0;
    this.lost = 0;
    this.countdown = 2000;
    this.lastTime = 0;
    this.pauseCause = '';
    this.reason = '';
  }
  get position() { return this.trajectory.at(this.distance); }
  start(now) { this.status = 'countdown'; this.lastTime = now; }
  tick(now) {
    if (!['running', 'countdown'].includes(this.status)) return;
    let delta = Math.max(0, now - this.lastTime);
    this.lastTime = now;
    if (delta > 500) {
      this.status = 'paused'; this.pauseCause = 'interruption'; return;
    }
    if (this.status === 'countdown') {
      this.countdown = Math.max(0, this.countdown - delta);
      if (this.countdown === 0) this.status = 'running';
      return;
    }
    if (this.settings.duration) delta = Math.min(delta, this.settings.duration * 1000 - this.elapsed);
    this.elapsed += delta;
    const previous = this.effectiveSpeed;
    this.effectiveSpeed += (this.settings.speed - previous) * (1 - Math.exp(-delta / 240));
    this.distance = (this.distance + this.trajectory.baseSpeed * (previous + this.effectiveSpeed) / 2 * delta / 1000) % this.trajectory.length;
    if (this.settings.duration && this.elapsed >= this.settings.duration * 1000) this.finish('complete');
  }
  pause(now, cause = 'rest') {
    this.tick(now);
    if (['running', 'countdown'].includes(this.status)) { this.status = 'paused'; this.pauseCause = cause; }
  }
  resume(now) {
    if (this.status !== 'paused') return;
    this.status = 'countdown'; this.countdown = 1200;
    this.lastTime = now; this.effectiveSpeed = 0; this.pauseCause = '';
  }
  reportLost(now) {
    if (this.status !== 'running') return;
    this.tick(now);
    if (this.status === 'completed') return;
    this.lost++; this.status = 'paused'; this.pauseCause = 'lost';
  }
  setSpeed(speed) { this.settings.speed = clamp(speed, 0.3, 2.5); }
  setTrajectory(trajectory, reset = false) {
    const restart = reset || trajectory.dynamic || this.trajectory.dynamic;
    const fraction = restart ? 0 : this.distance / this.trajectory.length;
    this.trajectory = trajectory; this.distance = restart ? 0 : fraction * trajectory.length;
    this.settings.path = trajectory.path; this.paths.add(trajectory.path);
  }
  finish(reason = 'stopped') { this.status = 'completed'; this.reason = reason; }
}
