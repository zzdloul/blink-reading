import { readData, writeData } from './storage.js';

const fields = [
  { key: 'inhale', label: '第一次吸气', unit: '秒', min: 1, max: 10, step: 0.5, initial: 3 },
  { key: 'topUp', label: '第二次补吸', unit: '秒', min: 0.5, max: 5, step: 0.5, initial: 1 },
  { key: 'exhale', label: '用嘴呼气', unit: '秒', min: 1, max: 15, step: 0.5, initial: 6 },
  { key: 'minutes', label: '训练总时长', unit: '分钟', min: 0.5, max: 20, step: 0.5, initial: 2 }
];
const cues = ['用鼻吸气', '再补一口', '用嘴慢慢呼气'];
const sizes = [0.60, 0.86, 1, 0.60];

export function normalizeRhythm(value) {
  return Object.fromEntries(fields.map(({ key, initial, min, max, step }) => {
    const n = value?.[key];
    return [key, Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n / step) * step)) : initial];
  }));
}

// Adjacent phases share an endpoint, including the last exhale and the next inhale.
export function breathAt(seconds, { inhale, topUp, exhale }) {
  const cycle = inhale + topUp + exhale;
  const position = seconds % cycle;
  const phase = position < inhale ? 0 : position < inhale + topUp ? 1 : 2;
  const start = [0, inhale, inhale + topUp][phase];
  const duration = [inhale, topUp, exhale][phase];
  const t = (position - start) / duration;
  const ease = (1 - Math.cos(Math.PI * t)) / 2;
  return { phase, remaining: Math.ceil(duration - position + start), size: sizes[phase] + (sizes[phase + 1] - sizes[phase]) * ease };
}

function clock(seconds) {
  return [Math.floor(seconds / 60), Math.floor(seconds % 60)].map(n => String(n).padStart(2, '0')).join(':');
}

export function initBreathing(storage) {
  const el = id => document.getElementById(id);
  const panel = el('breathing-panel');
  const orb = el('breath-orb');
  const progress = el('breath-progress');
  const settings = normalizeRhythm(readData(storage, 'breathing-settings', {}));
  const saved = readData(storage, 'breathing-history', []);
  const records = Array.isArray(saved) ? saved.filter(r => r && Number.isFinite(r.seconds) && Number.isFinite(r.at)).slice(0, 100) : [];
  let state = 'ready', elapsed = 0, started = 0, frame = 0;
  let lastDisplay = '';
  function render() {
    const total = settings.minutes * 60;
    const active = state === 'running' || state === 'paused';
    const { phase, remaining, size } = breathAt(elapsed, settings);
    orb.style.setProperty('--breath-size', active ? size.toFixed(5) : sizes[0]);
    progress.value = elapsed;
    const display = [state, phase, remaining, Math.floor(elapsed), total].join('/');
    if (display === lastDisplay) return;
    lastDisplay = display;
    const cue = state === 'running' ? cues[phase] : { ready: '准备呼吸', paused: '已暂停', ended: '本轮结束', complete: '练习完成' }[state];
    if (el('breath-cue').textContent !== cue) el('breath-cue').textContent = cue;
    el('breath-seconds').textContent = active ? (state === 'paused' ? cues[phase] + ' · ' : '') + remaining + ' 秒' :
      state === 'ready' ? '跟随光环的起伏' : '已练习 ' + clock(elapsed);
    el('breath-clock').textContent = '剩余 ' + clock(Math.ceil(total - elapsed));
    progress.max = total;
    el('breath-elapsed').textContent = clock(elapsed) + ' / ' + clock(total);
    el('breath-play').textContent = { ready: '开始呼吸', running: '暂停练习', paused: '继续呼吸', complete: '再练一次', ended: '再练一次' }[state];
    el('breath-end').hidden = !active;
    for (const input of panel.querySelectorAll('input')) input.disabled = active;
    el('breath-setting-note').textContent = active ? '结束本轮后可调整下一轮的节奏。' : '按舒服的节奏调节，开始后跟随光环即可。';
  }
  for (const field of fields) {
    const group = document.createElement('div');
    group.className = 'setting-group timing-group';
    const id = 'breath-' + field.key;
    group.innerHTML = `<div class="setting-label"><label for="${id}">${field.label}</label><output for="${id}"></output></div>
      <input type="range" id="${id}" min="${field.min}" max="${field.max}" step="${field.step}">
      <div class="range-scale"><span>${field.min} ${field.unit}</span><span>${field.max} ${field.unit}</span></div>`;
    el('breath-fields').append(group);
    const input = group.querySelector('input');
    input.value = settings[field.key];
    function updateField() {
      const n = input.valueAsNumber;
      settings[field.key] = n;
      group.querySelector('output').value = n + ' ' + field.unit;
      input.setAttribute('aria-valuetext', n + ' ' + field.unit);
      input.style.setProperty('--percent', (n - field.min) / (field.max - field.min) * 100 + '%');
    }
    updateField();
    input.addEventListener('input', () => {
      updateField();
      writeData(storage, 'breathing-settings', settings);
      state = 'ready'; elapsed = 0; render();
    });
  }
  function finish() {
    cancelAnimationFrame(frame);
    state = elapsed >= settings.minutes * 60 ? 'complete' : 'ended';
    if (elapsed >= 1) {
      records.unshift({ at: Date.now(), seconds: Math.floor(elapsed), ...settings });
      records.splice(100);
      writeData(storage, 'breathing-history', records);
    }
    render();
  }
  function syncElapsed(now) {
    elapsed = Math.min(settings.minutes * 60, Math.max(0, (now - started) / 1000));
  }
  function tick() {
    syncElapsed(performance.now());
    if (elapsed >= settings.minutes * 60) { finish(); return; }
    render();
    frame = requestAnimationFrame(tick);
  }
  function pause() {
    if (state !== 'running') return;
    syncElapsed(performance.now());
    if (elapsed >= settings.minutes * 60) { finish(); return; }
    cancelAnimationFrame(frame);
    state = 'paused';
    render();
  }
  function toggle() {
    if (state === 'running') { pause(); return; }
    if (state !== 'paused') elapsed = 0;
    state = 'running';
    started = performance.now() - elapsed * 1000;
    tick();
  }
  el('breath-play').addEventListener('click', toggle);
  el('breath-end').addEventListener('click', () => {
    if (state === 'running') syncElapsed(performance.now());
    finish();
    el('breath-play').focus();
  });
  function openGuideOrHistory(id) {
    if (panel.hidden) return;
    pause();
    if (id === 'breath-history-dialog') {
      const list = el('breath-history-list');
      list.replaceChildren();
      if (!records.length) list.textContent = '完成一次呼吸练习后，可以在这里回看。';
      for (const record of records) {
        const row = document.createElement('p');
        row.className = 'history-row';
        row.textContent = new Date(record.at).toLocaleString('zh-CN') + '　·　' + clock(record.seconds);
        list.append(row);
      }
    }
    el(id).showModal();
  }
  el('guide-open').addEventListener('click', () => openGuideOrHistory('breath-guide-dialog'));
  el('history-open').addEventListener('click', () => openGuideOrHistory('breath-history-dialog'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', pause);
  render();
  return { pause };
}
