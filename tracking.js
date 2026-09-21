import { TRACKS, TRACKING_DEFAULTS, sanitizeTrackingSettings, sanitizeTrackingHistory, createTrajectory, TrackingSession } from './tracking-engine.js?v=3';
import { readData, writeData } from './storage.js';

export function initTracking(storage) {
  const $ = id => document.getElementById(id);
  const panel = $('tracking-panel');
  let settings = sanitizeTrackingSettings(readData(storage, 'tracking-settings', {}));
  let history = sanitizeTrackingHistory(readData(storage, 'tracking-history', []));
  let trajectory = createTrajectory(settings.path, 300, 240, settings.range);
  let session = null;
  let savedRecord = null;
  let previousRender = '';
  let storageFailed = false;
  let clearArmed = false;
  const busy = () => session && ['running', 'countdown', 'paused'].includes(session.status);
  const active = () => session && ['running', 'countdown'].includes(session.status);
  const fmt = ms => {
    const seconds = Math.floor(ms / 1000);
    const parts = [Math.floor(seconds / 60), seconds % 60];
    if (seconds >= 3600) parts.splice(0, 1, Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60);
    return parts.map(n => String(n).padStart(2, '0')).join(':');
  };
  function save(key, value) {
    if (!writeData(storage, key, value)) storageFailed = true;
  }
  function announce(text) { $('tracking-announcement').textContent = text; }
  function paintSlider(input) {
    input.style.setProperty('--percent', `${(Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`);
  }
  function syncSettings() {
    for (const [id, value] of [['tracking-speed', settings.speed], ['tracking-size', settings.size], ['tracking-focus-size', settings.size]]) {
      $(id).value = value; paintSlider($(id));
    }
    $('tracking-speed-value').textContent = `${settings.speed.toFixed(1)} 倍`;
    $('tracking-speed').setAttribute('aria-valuetext', `${settings.speed.toFixed(1)} 倍`);
    $('tracking-size-number').value = settings.size;
    $('tracking-focus-size-value').textContent = `${settings.size} px`;
    $('tracking-guide').checked = settings.guide && settings.path !== 'random';
    $('tracking-guide').disabled = settings.path === 'random';
    $('tracking-route').toggleAttribute('hidden', !settings.guide || settings.path === 'random');
    $('tracking-route-note').textContent = settings.path === 'random' ? '随机路线会持续生成，不循环、不预告下一段。速度始终由你控制。' : '熟悉路线后可以隐藏引导线。改路线或范围会先暂停，重新看住圆点再继续。';
    for (const button of document.querySelectorAll('[data-path]')) button.setAttribute('aria-pressed', String(button.dataset.path === settings.path));
    for (const key of ['range', 'duration']) {
      for (const button of document.querySelectorAll(`[data-tracking-${key}]`)) {
        button.setAttribute('aria-pressed', String(Number(button.getAttribute(`data-tracking-${key}`)) === settings[key]));
      }
    }
    $('tracking-slower').disabled = settings.speed <= 0.3;
    $('tracking-faster').disabled = settings.speed >= 2.5;
    $('tracking-duration-label').textContent = settings.duration ? fmt(settings.duration * 1000) : '不限时';
    $('tracking-progress').max = settings.duration * 1000 || 1;
    $('tracking-progress').setAttribute('aria-hidden', String(!settings.duration));
    $('tracking-route-label').textContent = `${TRACKS[settings.path]} · ${settings.speed.toFixed(1)}×`;
    render(true);
  }
  function measure({ reset = false, intentional = false } = {}) {
    if (panel.hidden) return;
    const arena = $('tracking-arena');
    const width = arena.clientWidth, height = arena.clientHeight;
    if (!width || !height) return;
    const changed = Math.abs(width - trajectory.width) > 1 || Math.abs(height - trajectory.height) > 1;
    const routeChanged = trajectory.path !== settings.path || trajectory.range !== settings.range;
    if (!changed && !reset && !routeChanged) { draw(); return; }
    if (changed && !intentional && active()) pause('resize');
    trajectory = createTrajectory(settings.path, width, height, settings.range);
    if (session) session.setTrajectory(trajectory, reset || routeChanged);
    $('tracking-route').setAttribute('viewBox', `0 0 ${width} ${height}`);
    $('tracking-path').setAttribute('d', trajectory.samples.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '));
    draw();
  }
  function draw() {
    const point = session ? session.position : trajectory.at(0);
    const size = Math.min(settings.size, Math.max(6, Math.min(trajectory.width, trajectory.height) - 12));
    $('tracking-target').style.setProperty('--target-size', `${size}px`);
    $('tracking-target').style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`;
  }
  function render(force = false) {
    if (panel.hidden) return;
    draw();
    const status = session?.status || 'ready';
    const key = [status, session?.pauseCause, Math.floor((session?.elapsed || 0) / 1000), session?.lost, Math.ceil((session?.countdown || 0) / 1000)].join('|');
    if (!force && previousRender === key) return;
    previousRender = key;
    const completed = status === 'completed';
    $('tracking-arena').hidden = completed;
    $('tracking-hint').hidden = completed;
    $('tracking-result').hidden = !completed;
    // Reserve the same control area in every state. Otherwise starting on a
    // phone resizes the arena and correctly-but-unhelpfully triggers a pause.
    $('tracking-lost').hidden = false;
    $('tracking-lost').disabled = status !== 'running';
    $('tracking-stop').hidden = false;
    $('tracking-stop').style.visibility = busy() ? 'visible' : 'hidden';
    $('tracking-stop').disabled = !busy();
    $('tracking-stop').setAttribute('aria-hidden', String(!busy()));
    $('tracking-duration-field').disabled = Boolean(busy());
    $('tracking-time').textContent = fmt(session?.elapsed || 0);
    $('tracking-progress').value = settings.duration ? session?.elapsed || 0 : 0;
    $('tracking-lost-count').textContent = session?.lost || 0;
    $('tracking-status-dot').classList.toggle('paused', status === 'paused');
    $('tracking-status').textContent = {ready:'准备好了',countdown:'看住圆点',running:'平稳跟随中',paused:'已停住圆点',completed:'本轮已结束'}[status];
    $('tracking-play').textContent = active() ? '休息一下' : status === 'paused' ?
      session.pauseCause === 'lost' ? '重新跟上' : '继续追踪' : completed ? '再练一轮' : '开始追踪';
    const hints = {
      rest: '圆点已停住。准备好后，点「继续追踪」。',
      lost: '先找到圆点，可以减速，再点「重新跟上」。',
      route: '已换路线或范围。看清圆点后再继续。',
      resize: '画面大小已改变，重新看住圆点再继续。',
      hidden: '离开页面时已休息，准备好后继续。',
      interruption: '画面刚才有中断，已停住圆点。'
    };
    $('tracking-hint').textContent = status === 'countdown' ? `看住圆点 · ${Math.max(1, Math.ceil(session.countdown / 1000))} 秒后出发` :
      status === 'running' ? '' : status === 'paused' ? hints[session.pauseCause] || hints.rest : '先看住绿色圆点，再开始移动。';
    let note = status === 'running' ? '跟丢时点「跟丢了」，不要硬追速度。' : '不用点圆点，用目光跟随即可。';
    if (storageFailed) note += ' 当前浏览器无法保存记录。';
    $('tracking-transport-note').textContent = note;
    if (completed && !savedRecord) saveResult();
    if (status === 'paused') announce($('tracking-hint').textContent);
  }
  function start() {
    session = null; savedRecord = null;
    render(true);
    measure({ reset: settings.path === 'random', intentional: true });
    session = new TrackingSession(settings, trajectory);
    session.start(performance.now());
    savedRecord = null;
    $('tracking-advice').textContent = '先保持稳定，再尝试更快或更复杂的路线。';
    document.querySelectorAll('[data-tracking-feeling]').forEach(button => { button.disabled = false; button.setAttribute('aria-pressed', 'false'); });
    render(true); announce('看住圆点，倒计时后开始追踪。');
  }
  function play() {
    if (!session || ['ready', 'completed'].includes(session.status)) start();
    else if (active()) pause();
    else { session.resume(performance.now()); render(true); announce('看住当前圆点，即将继续。'); }
  }
  function pause(cause = 'rest') {
    if (!active()) return;
    session.pause(performance.now(), cause); render(true);
  }
  function finish() {
    if (!busy()) return;
    if (active()) session.tick(performance.now());
    session.finish('stopped'); render(true); announce('本轮结束，可以留下自我感受。');
  }
  function saveResult() {
    savedRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(),
      seconds: Math.floor(session.elapsed / 1000), lost: session.lost, speed: settings.speed,
      size: settings.size, paths: [...session.paths], feeling: null
    };
    const valid = session.elapsed > 0;
    if (valid) { history = [savedRecord, ...history].slice(0, 100); save('tracking-history', history); }
    $('tracking-result-time').textContent = fmt(session.elapsed);
    $('tracking-result-lost').textContent = session.lost;
    $('tracking-result-message').textContent = valid ? '刚才的路线，你跟上了吗？' : '圆点还没有开始移动，准备好后再试一次。';
    document.querySelectorAll('[data-tracking-feeling]').forEach(button => { button.disabled = !valid; });
    if (session.reason === 'complete') announce('本轮追踪已完成，可以休息或记录感受。');
    if (document.body.classList.contains('tracking-focus') && window.innerHeight < 500) {
      setFocus(false);
      $('tracking-result').scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }
  function setSpeed(speed) {
    settings.speed = sanitizeTrackingSettings({ ...settings, speed }).speed;
    session?.setSpeed(settings.speed);
    save('tracking-settings', settings); syncSettings();
  }
  function setSize(value) {
    if (String(value).trim() === '' || !Number.isFinite(Number(value))) return;
    settings.size = sanitizeTrackingSettings({ ...settings, size: Number(value) }).size;
    save('tracking-settings', settings); syncSettings();
  }
  function changeRoute(key, value) {
    if (settings[key] === value) return;
    pause('route');
    if (session?.status === 'completed') { session = null; savedRecord = null; }
    settings[key] = value;
    if (session?.status === 'paused') session.pauseCause = 'route';
    measure({ reset: true, intentional: true });
    save('tracking-settings', settings); syncSettings();
  }
  function setFocus(enabled) {
    document.body.classList.toggle('tracking-focus', enabled);
    $('tracking-focus').setAttribute('aria-pressed', String(enabled));
    $('tracking-focus').setAttribute('aria-label', enabled ? '退出追踪专注模式' : '进入追踪专注模式');
    $('tracking-focus-exit').hidden = !enabled;
    $('tracking-focus-tools').hidden = !enabled;
    for (const selector of ['.site-header', '.tracking-intro', '.tracking-settings', '.tracking-tip', '.tracking-disclaimer', 'footer']) document.querySelector(selector).inert = enabled;
    // Geometry changes intentionally pause before positioning in the new arena.
    pause('resize'); measure({ intentional: true }); render(true);
  }
  function openDialog(id) {
    pause();
    if (id === 'tracking-history-dialog') renderHistory();
    $(id).showModal();
  }
  function renderHistory() {
    clearArmed = false;
    $('tracking-clear-history').textContent = '清空追踪记录';
    $('tracking-clear-history').disabled = !history.length;
    $('tracking-cancel-clear').hidden = true; $('tracking-clear-hint').textContent = '';
    const today = new Date().toDateString();
    const records = history.filter(r => new Date(r.at).toDateString() === today);
    const summary = $('tracking-history-summary'); summary.replaceChildren();
    for (const label of [`今日 ${records.length} 轮`, `播放 ${fmt(records.reduce((sum, r) => sum + r.seconds * 1000, 0))}`, `共 ${history.length} 条`]) {
      const span = document.createElement('span'); span.textContent = label; summary.append(span);
    }
    const list = $('tracking-history-list'); list.replaceChildren();
    if (!history.length) {
      const empty = document.createElement('div'); empty.className = 'empty-state';
      const title = document.createElement('strong'); title.textContent = '从一次平稳跟随开始。';
      const text = document.createElement('p'); text.textContent = '结束一轮后，会留下播放时长和你的自报记录。';
      empty.append(title, text); list.append(empty); return;
    }
    for (const record of history) {
      const row = document.createElement('article'); row.className = 'history-row';
      const left = document.createElement('div'), right = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = `${record.paths.length > 1 ? '多路线' : TRACKS[record.paths[0]]} · ${fmt(record.seconds * 1000)}`;
      const detail = document.createElement('p'); detail.textContent = new Date(record.at).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) + ` · ${record.speed.toFixed(1)} 倍（结束时）`;
      const count = document.createElement('span'); count.textContent = `自报跟丢 ${record.lost} 次`;
      const feeling = document.createElement('p'); feeling.textContent = {easy:'自评：轻松跟上',okay:'自评：刚刚好',hard:'自评：有点吃力'}[record.feeling] || '尚未自评';
      left.append(title,detail); right.append(count,feeling); row.append(left,right); list.append(row);
    }
  }

  $('tracking-play').addEventListener('click', play);
  $('tracking-stop').addEventListener('click', finish);
  $('tracking-lost').addEventListener('click', () => { session?.reportLost(performance.now()); render(true); });
  $('tracking-faster').addEventListener('click', () => setSpeed(settings.speed + 0.1));
  $('tracking-slower').addEventListener('click', () => setSpeed(settings.speed - 0.1));
  $('tracking-speed').addEventListener('input', event => setSpeed(Number(event.target.value)));
  for (const id of ['tracking-size', 'tracking-focus-size']) $(id).addEventListener('input', event => setSize(event.target.value));
  $('tracking-size-number').addEventListener('input', event => {
    const value = Number(event.target.value);
    if (value >= 6 && value <= 64) setSize(value);
  });
  $('tracking-size-number').addEventListener('change', event => { setSize(event.target.value || TRACKING_DEFAULTS.size); syncSettings(); });
  document.querySelectorAll('[data-path]').forEach(button => button.addEventListener('click', () => changeRoute('path', button.dataset.path)));
  document.querySelectorAll('[data-tracking-range]').forEach(button => button.addEventListener('click', () => changeRoute('range', Number(button.dataset.trackingRange))));
  document.querySelectorAll('[data-tracking-duration]').forEach(button => button.addEventListener('click', () => {
    if (busy()) return;
    settings.duration = Number(button.dataset.trackingDuration);
    session = null; savedRecord = null;
    save('tracking-settings', settings); syncSettings(); measure({ reset: true });
  }));
  $('tracking-guide').addEventListener('change', event => { settings.guide = event.target.checked; save('tracking-settings', settings); syncSettings(); });
  $('tracking-focus').addEventListener('click', () => setFocus(!document.body.classList.contains('tracking-focus')));
  $('tracking-focus-exit').addEventListener('click', () => setFocus(false));
  $('history-open').addEventListener('click', () => { if (!panel.hidden) openDialog('tracking-history-dialog'); });
  $('guide-open').addEventListener('click', () => { if (!panel.hidden) openDialog('tracking-guide-dialog'); });
  document.querySelectorAll('[data-tracking-feeling]').forEach(button => button.addEventListener('click', () => {
    if (!savedRecord) return;
    const feeling = button.dataset.trackingFeeling;
    savedRecord.feeling = feeling; save('tracking-history', history);
    document.querySelectorAll('[data-tracking-feeling]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    $('tracking-advice').textContent = {easy:'可以试着增加 0.1 倍速度，或换一条路线；一次只改一项。',okay:'先保持这个节奏，稳定跟随就很好。',hard:'下轮先减速或换回水平往返，也可以先休息。'}[feeling];
  }));
  $('tracking-clear-history').addEventListener('click', () => {
    if (!clearArmed) {
      clearArmed = true; $('tracking-clear-history').textContent = '确认清空追踪记录';
      $('tracking-cancel-clear').hidden = false;
      $('tracking-clear-hint').textContent = '只清空追踪记录，不影响瞬读记录；不可撤销。'; return;
    }
    history = []; save('tracking-history', history); renderHistory();
  });
  $('tracking-cancel-clear').addEventListener('click', renderHistory);
  document.addEventListener('keydown', event => {
    if (panel.hidden || document.querySelector('dialog[open]') || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
    if (event.key === 'Escape') { event.preventDefault(); pause(); setFocus(false); return; }
    if (event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
    if (event.code === 'Space' && !event.target.closest('button,summary,a')) { event.preventDefault(); play(); }
    else if (['ArrowUp','ArrowDown'].includes(event.key)) { event.preventDefault(); setSpeed(settings.speed + (event.key === 'ArrowUp' ? 0.1 : -0.1)); }
    else if (event.key.toLowerCase() === 'l') { event.preventDefault(); session?.reportLost(performance.now()); render(true); }
    else if (event.key.toLowerCase() === 'f') { event.preventDefault(); setFocus(!document.body.classList.contains('tracking-focus')); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause('hidden'); });
  window.addEventListener('pagehide', () => pause('hidden'));
  new ResizeObserver(() => measure()).observe($('tracking-arena'));
  function loop(now) {
    if (!panel.hidden && active()) { session.tick(now); render(); }
    requestAnimationFrame(loop);
  }
  syncSettings(); requestAnimationFrame(loop);
  return {
    show() { syncSettings(); measure({ intentional: true }); render(true); },
    suspend() { pause(); setFocus(false); }
  };
}
