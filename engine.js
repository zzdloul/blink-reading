export const DEFAULTS = Object.freeze({
  category: 'mixed', difficulty: 'standard', exposure: 600, gap: 400,
  duration: 0, custom: '', fontSize: 132
});
const bounded = (value, min, max, fallback) => Number.isFinite(Number(value))
  ? Math.min(max, Math.max(min, Math.round(Number(value) / 50) * 50)) : fallback;

export function sanitizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    category: ['mixed', 'numbers', 'chinese', 'english', 'custom'].includes(source.category) ? source.category : DEFAULTS.category,
    difficulty: ['easy', 'standard', 'challenge'].includes(source.difficulty) ? source.difficulty : DEFAULTS.difficulty,
    exposure: bounded(source.exposure, 100, 2000, DEFAULTS.exposure),
    gap: bounded(source.gap, 100, 2000, DEFAULTS.gap),
    duration: [0, 60, 120, 300].includes(source.duration) ? source.duration : DEFAULTS.duration,
    custom: typeof source.custom === 'string' ? source.custom.slice(0, 15000) : '',
    fontSize: Number.isFinite(Number(source.fontSize)) ? Math.min(200, Math.max(6, Math.round(Number(source.fontSize)))) : DEFAULTS.fontSize
  };
}

export function adjustSpeed(settings, direction) {
  const step = direction === 'faster' ? -50 : 50;
  return { exposure: Math.max(100, Math.min(2000, settings.exposure + step)),
    gap: Math.max(100, Math.min(2000, settings.gap + step)) };
}

// A monotonic, frame-driven clock. Hidden time and pauses never count as practice.
// At most one phase transition per frame: a delayed frame never skips unseen items.
export class Session {
  constructor(settings, nextItem) {
    this.settings = { ...settings };
    this.nextItem = nextItem;
    this.status = 'ready';
    this.phase = 'gap';
    this.item = null;
    this.elapsed = 0;
    this.count = 0;
    this.phaseElapsed = 0;
    this.countdown = 2000;
    this.lastTime = null;
    this.reason = '';
  }
  start(now) { this.status = 'countdown'; this.lastTime = now; }
  showNext() {
    this.item = this.nextItem();
    this.count++;
    this.phase = 'show';
    this.phaseElapsed = 0;
    this.phaseDuration = this.settings.exposure;
  }
  tick(now) {
    if (!['countdown', 'running'].includes(this.status)) return;
    const delta = Math.max(0, now - this.lastTime);
    this.lastTime = now;
    if (this.status === 'countdown') {
      this.countdown -= delta;
      if (this.countdown <= 0) { this.status = 'running'; this.showNext(); }
      return;
    }
    this.elapsed += delta;
    if (this.settings.duration > 0 && this.elapsed >= this.settings.duration * 1000) {
      this.elapsed = this.settings.duration * 1000; this.finish('complete'); return;
    }
    this.phaseElapsed += delta;
    if (this.phaseElapsed >= this.phaseDuration) {
      if (this.phase === 'show') {
        this.phase = 'gap'; this.phaseElapsed = 0; this.phaseDuration = this.settings.gap;
      } else this.showNext();
    }
  }
  pause(now) {
    this.tick(now);
    if (['running', 'countdown'].includes(this.status)) {
      this.beforePause = this.status; this.status = 'paused';
    }
  }
  resume(now) {
    if (this.status !== 'paused') return;
    this.status = this.beforePause;
    this.lastTime = now;
    // Give a partially seen item its full exposure again without double-counting it.
    if (this.status === 'running') this.phaseElapsed = 0;
  }
  setTiming(exposure, gap) { this.settings.exposure = exposure; this.settings.gap = gap; }
  finish(reason = 'stopped') { this.status = 'completed'; this.reason = reason; }
}
