import { DEFAULTS, Session, adjustSpeed } from './engine.js';
import { createGenerator, LABELS, validateCustom, parseCustom } from './content.js';
import { loadSettings, loadHistory, writeData } from './storage.js';

const $ = id => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let settings = loadSettings(storage);
if (settings.category === 'custom' && validateCustom(settings.custom)) settings.category = 'mixed';
let history = loadHistory(storage);
let session = null;
let savedSession = null;
let suggestion = null;
let toastTimer;
let previousRender = '';
let storageWarned = false;
let clearArmed = false;
const busy = () => session && ['countdown', 'running', 'paused'].includes(session.status);
const active = () => session && ['countdown', 'running'].includes(session.status);
const fmt = seconds => {
  const n = Math.max(0, Math.floor(seconds));
  if (n >= 3600) return `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
};
function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3600);
}
function save(key, value) {
  const success = writeData(storage, key, value);
  if (!success && !storageWarned) { storageWarned = true; toast('当前浏览器无法保存记录，仍可正常训练。'); }
  return success;
}
function announce(text) { $('announcement').textContent = text; }
function saveSettings() { save('settings', settings); }
function paintSlider(input) {
  input.style.setProperty('--percent', `${(Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`);
}
function syncSettings() {
  for (const key of ['category', 'difficulty', 'duration']) {
    document.querySelectorAll(`[data-${key}]`).forEach(button => {
      button.setAttribute('aria-pressed', String(String(settings[key]) === button.dataset[key]));
    });
  }
  for (const key of ['exposure', 'gap']) {
    $(key).value = settings[key]; paintSlider($(key));
    $(key + '-value').textContent = `${settings[key]} ms`;
    $(key).setAttribute('aria-valuetext', `${settings[key]} 毫秒`);
  }
  $('font-size').value = settings.fontSize;
  $('font-size-number').value = settings.fontSize;
  paintSlider($('font-size'));
  $('focus-font-size').value = settings.fontSize;
  $('focus-font-value').textContent = `${settings.fontSize} px`;
  paintSlider($('focus-font-size'));
  $('font-size').setAttribute('aria-valuetext', `${settings.fontSize} 像素`);
  $('custom-active').hidden = settings.category !== 'custom';
  $('custom-active').textContent = `自定义词库 · ${parseCustom(settings.custom).length} 个内容`;
  $('pace-note').textContent = `每分钟约 ${Math.round(60000 / (settings.exposure + settings.gap))} 个内容（以实际呈现为准）`;
  $('duration-label').textContent = settings.duration ? fmt(settings.duration) : '不限时';
  $('session-progress').max = settings.duration * 1000 || 1;
  $('session-progress').setAttribute('aria-hidden', String(!settings.duration));
  $('stage-category').textContent = settings.category === 'mixed' ? '数字 · 中文 · 英文' :
    settings.category === 'custom' ? '自定义词库' : LABELS[settings.category];
  $('faster').disabled = settings.exposure === 100 && settings.gap === 100;
  $('slower').disabled = settings.exposure === 2000 && settings.gap === 2000;
  render(true);
}
function lockSettings() {
  const locked = Boolean(busy());
  for (const id of ['category-field', 'difficulty-field', 'duration-field']) $(id).disabled = locked;
  $('difficulty-field').disabled = locked || settings.category === 'custom';
  $('custom-open').disabled = locked;
}
function setTiming(exposure, gap) {
  settings.exposure = exposure; settings.gap = gap;
  session?.setTiming(exposure, gap);
  saveSettings(); syncSettings();
}
function changeSpeed(direction) {
  const timing = adjustSpeed(settings, direction);
  setTiming(timing.exposure, timing.gap);
  toast(`${direction === 'faster' ? '提速' : '减速'}：闪现 ${settings.exposure} ms · 间隔 ${settings.gap} ms`);
}
function setFont(value) {
  if (!Number.isFinite(Number(value)) || String(value).trim() === '') return;
  settings.fontSize = Math.max(6, Math.min(200, Math.round(Number(value))));
  saveSettings(); syncSettings();
}
function fitStimulus(text) {
  // Preserve the requested size, reducing only when a long item would overflow.
  const units = Array.from(text).reduce((sum, char) => sum + (/[^\x00-\x7F]/.test(char) ? 1 : .64), 0);
  const width = $('stimulus-area').clientWidth - 30;
  const max = Math.max(6, Math.floor(width / Math.max(1, units)));
  $('stimulus').style.setProperty('--stimulus-size', `${Math.min(settings.fontSize, max)}px`);
}
function preview() {
  if (settings.category === 'custom') return parseCustom(settings.custom)[0] || '专注';
  if (settings.category === 'chinese') return settings.difficulty === 'challenge' ? '全神贯注' : '清风';
  if (settings.category === 'english') return settings.difficulty === 'easy' ? 'calm' : settings.difficulty === 'challenge' ? 'attention' : 'rhythm';
  return settings.difficulty === 'easy' ? '28' : settings.difficulty === 'challenge' ? '204816' : '2048';
}
function render(force = false) {
  const status = session?.status || 'ready';
  const seconds = Math.floor((session?.elapsed || 0) / 1000);
  const snapshot = [status, session?.phase, session?.item?.text, session?.count, seconds, Math.ceil((session?.countdown || 0) / 1000)].join('|');
  if (!force && previousRender === snapshot) return;
  previousRender = snapshot;
  $('elapsed').textContent = fmt(seconds);
  $('session-progress').value = settings.duration ? session?.elapsed || 0 : 0;
  const completed = status === 'completed';
  $('stimulus-area').hidden = completed;
  $('result').hidden = !completed;
  $('stop').hidden = !busy();
  $('keyboard-tip').hidden = Boolean(busy());
  $('presented').hidden = !busy();
  $('presented-count').textContent = session?.count || 0;
  $('status-dot').classList.toggle('paused', status === 'paused');
  $('play').textContent = status === 'running' || status === 'countdown' ? '休息一下' :
    status === 'paused' ? '继续训练' : completed ? '再练一轮' : '开始训练';
  $('status-text').textContent = { ready: '准备好了', countdown: '准备开始', running: '跟着自己的节奏', paused: '休息中', completed: '本轮已结束' }[status];
  if (completed && !session.count) $('status-text').textContent = '本轮已结束';
  $('stimulus').className = 'stimulus';
  let text = preview();
  let hint = '目光停在中心，在心里轻轻读出。';
  if (status === 'countdown') {
    text = String(Math.max(1, Math.ceil(session.countdown / 1000)));
    $('stimulus').classList.add('countdown');
    hint = '放松呼吸，目光停在中心。';
  } else if (status === 'running') {
    text = session.item.text;
    if (session.phase === 'gap') $('stimulus').classList.add('blank');
    hint = '';
  } else if (status === 'paused') {
    text = '休息一下';
    $('stimulus').classList.add('pause-text');
    hint = '准备好后，点「继续训练」。';
  }
  if (!/^\d+$/.test(text)) $('stimulus').classList.add('word');
  $('stimulus').textContent = text;
  $('stimulus').lang = /^[a-z\s]+$/i.test(text) ? 'en' : 'zh-CN';
  $('stage-hint').textContent = hint;
  if (status === 'paused' || status === 'countdown') $('stimulus').style.removeProperty('--stimulus-size');
  else fitStimulus(text);
  lockSettings();
  if (completed && !savedSession) saveResult();
}
function start() {
  if (settings.category === 'custom' && validateCustom(settings.custom)) { openDialog('custom-dialog'); return; }
  savedSession = null; suggestion = null;
  $('result-advice').textContent = '选一个感受，帮下一轮找到更合适的节奏。';
  $('apply-suggestion').hidden = true;
  document.querySelectorAll('[data-feeling]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  session = new Session(settings, createGenerator(settings));
  session.start(performance.now());
  render(true); announce('训练即将开始。空格休息，方向键上下调速。');
}
function pause(message) {
  if (!active()) return;
  session.pause(performance.now()); render(true);
  if (session.status === 'paused') { announce(message || '已休息，点击继续训练即可恢复。'); if (message) toast(message); }
}
function play() {
  if (!session || session.status === 'ready' || session.status === 'completed') start();
  else if (active()) pause();
  else { session.resume(performance.now()); render(true); announce('继续训练。'); }
}
function finish() {
  if (!busy()) return;
  if (active()) session.tick(performance.now());
  session.finish('stopped'); render(true); announce('本轮已结束，可以记录你的感受。');
}
function saveResult() {
  const valid = session.count > 0 && session.elapsed > 0;
  const record = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(),
    seconds: Math.floor(session.elapsed / 1000), count: session.count, category: session.settings.category,
    difficulty: session.settings.difficulty, exposure: settings.exposure, gap: settings.gap,
    fontSize: settings.fontSize, feeling: null, completed: session.reason === 'complete' };
  savedSession = record;
  if (valid) { history = [record, ...history].slice(0, 100); save('history', history); }
  $('result-time').textContent = fmt(record.seconds);
  $('result-count').textContent = record.count;
  $('result-label').textContent = session.reason === 'complete' ? '本轮完成 · 休息片刻' : '本轮结束';
  if (session.reason === 'complete') announce('本轮训练已完成，可以记录感受或再练一轮。');
  $('result-message').textContent = valid ? '刚才的节奏，你跟上了吗？' : '还没有开始呈现内容，准备好就再试一次。';
  document.querySelectorAll('[data-feeling]').forEach(button => button.disabled = !valid);
}
function feedback(feeling) {
  if (!savedSession) return;
  savedSession.feeling = feeling;
  save('history', history);
  document.querySelectorAll('[data-feeling]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.feeling === feeling)));
  suggestion = feeling === 'okay' ? null : adjustSpeed(settings, feeling === 'easy' ? 'faster' : 'slower');
  $('result-advice').textContent = feeling === 'okay' ? '保持这个节奏，稳定地读清就很好。' :
    feeling === 'easy' ? '下轮可以试着小幅提速，也可以保持当前节奏。' : '下轮可以放慢一点，给默念留出更多时间。';
  $('apply-suggestion').hidden = !suggestion;
  if (suggestion) $('apply-suggestion').textContent = `下轮采用 ${suggestion.exposure} + ${suggestion.gap} ms`;
}
function setFocus(enabled) {
  document.body.classList.toggle('focus-mode', enabled);
  $('focus-toggle').setAttribute('aria-pressed', String(enabled));
  $('focus-toggle').setAttribute('aria-label', enabled ? '退出专注模式' : '进入专注模式');
  $('focus-exit').hidden = !enabled;
  $('focus-font-tools').hidden = !enabled;
  // Keep keyboard focus out of content covered by the fullscreen trainer.
  for (const selector of ['.site-header', '.intro', '.settings', '.practice-tip', 'footer']) document.querySelector(selector).inert = enabled;
  render(true);
}
function openDialog(id) {
  pause('已为你暂停训练。关闭窗口后可继续。');
  if (id === 'history-dialog') renderHistory();
  if (id === 'custom-dialog') { $('custom-text').value = settings.custom; $('custom-error').textContent = ''; }
  $(id).showModal();
}
function renderHistory() {
  clearArmed = false; $('clear-history').textContent = '清空记录'; $('clear-hint').textContent = ''; $('cancel-clear').hidden = true;
  $('clear-history').disabled = !history.length;
  const today = new Date().toDateString();
  const todays = history.filter(record => new Date(record.at).toDateString() === today);
  $('history-summary').replaceChildren();
  for (const text of [`今日 ${todays.length} 轮`, `累计练习 ${fmt(todays.reduce((sum, r) => sum + r.seconds, 0))}`, `共 ${history.length} 条记录`]) {
    const span = document.createElement('span'); span.textContent = text; $('history-summary').append(span);
  }
  const list = $('history-list'); list.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    const title = document.createElement('strong'); title.textContent = '从第一轮开始。';
    const body = document.createElement('p'); body.textContent = '结束一轮训练后，这里会留下你的练习记录。';
    empty.append(title, body); list.append(empty); return;
  }
  for (const record of history) {
    const row = document.createElement('article'); row.className = 'history-row';
    const left = document.createElement('div'); const right = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = `${LABELS[record.category]} · ${fmt(record.seconds)}`;
    const date = document.createElement('p'); date.textContent = new Date(record.at).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) + ` · ${record.exposure} + ${record.gap} ms（结束时）`;
    const count = document.createElement('span'); count.textContent = `呈现 ${record.count} 个`;
    const feeling = document.createElement('p'); feeling.textContent = {easy:'自评：轻松跟上',okay:'自评：刚刚好',hard:'自评：有点吃力'}[record.feeling] || '尚未自评';
    left.append(title,date); right.append(count,feeling); row.append(left,right); list.append(row);
  }
}

$('play').addEventListener('click', play);
$('stop').addEventListener('click', finish);
$('faster').addEventListener('click', () => changeSpeed('faster'));
$('slower').addEventListener('click', () => changeSpeed('slower'));
for (const key of ['exposure','gap']) $(key).addEventListener('input', () => setTiming(Number($('exposure').value), Number($('gap').value)));
$('font-size').addEventListener('input', event => setFont(event.target.value));
$('focus-font-size').addEventListener('input', event => setFont(event.target.value));
$('font-size-number').addEventListener('input', event => {
  const n = Number(event.target.value);
  if (event.target.value && Number.isFinite(n) && n >= 6 && n <= 200) setFont(n);
});
$('font-size-number').addEventListener('change', event => { setFont(event.target.value || DEFAULTS.fontSize); syncSettings(); });
for (const key of ['category','difficulty','duration']) document.querySelectorAll(`[data-${key}]`).forEach(button => button.addEventListener('click', () => {
  if (busy()) return;
  settings[key] = key === 'duration' ? Number(button.dataset[key]) : button.dataset[key];
  session = null; savedSession = null;
  saveSettings(); syncSettings();
}));
document.querySelectorAll('[data-feeling]').forEach(button => button.addEventListener('click', () => feedback(button.dataset.feeling)));
$('apply-suggestion').addEventListener('click', () => {
  if (!suggestion) return;
  setTiming(suggestion.exposure, suggestion.gap);
  $('apply-suggestion').hidden = true; $('result-advice').textContent = '已调整，下轮会采用新节奏。';
});
$('history-open').addEventListener('click', () => openDialog('history-dialog'));
$('guide-open').addEventListener('click', () => openDialog('guide-dialog'));
$('custom-open').addEventListener('click', () => openDialog('custom-dialog'));
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
$('custom-form').addEventListener('submit', event => {
  event.preventDefault();
  const text = $('custom-text').value;
  const error = validateCustom(text);
  $('custom-error').textContent = error;
  if (error) { $('custom-text').focus(); return; }
  settings.custom = parseCustom(text).join('\n'); settings.category = 'custom';
  session = null; savedSession = null;
  saveSettings(); syncSettings(); $('custom-dialog').close(); toast(`已载入 ${parseCustom(text).length} 个内容`);
});
$('clear-history').addEventListener('click', () => {
  if (!clearArmed) {
    clearArmed = true; $('clear-history').textContent = '确认清空'; $('cancel-clear').hidden = false;
    $('clear-hint').textContent = '仅清空本机记录，此操作不可撤销。'; return;
  }
  history = []; save('history', history); renderHistory(); toast('训练记录已清空');
});
$('cancel-clear').addEventListener('click', renderHistory);
$('focus-toggle').addEventListener('click', () => setFocus(!document.body.classList.contains('focus-mode')));
$('focus-exit').addEventListener('click', () => setFocus(false));
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
  if (event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
  if (event.code === 'Space') {
    if (event.target.closest('button,summary,a')) return;
    event.preventDefault(); play();
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault(); changeSpeed(event.key === 'ArrowUp' ? 'faster' : 'slower');
  } else if (event.key.toLowerCase() === 'f') {
    event.preventDefault(); setFocus(!document.body.classList.contains('focus-mode'));
  } else if (event.key === 'Escape') { pause(); setFocus(false); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause('页面离开时已自动休息，回来后点继续即可。'); });
window.addEventListener('pagehide', () => pause());
window.addEventListener('resize', () => render(true));
const loop = now => { if (active()) { session.tick(now); render(); } requestAnimationFrame(loop); };
syncSettings();
requestAnimationFrame(loop);
