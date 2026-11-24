import { suspendReading, refreshReading } from './app.js?v=4';
import { initReminders } from './reminders.js?v=7';
import { readData, writeData } from './storage.js';

let storage;
try { storage = window.localStorage; } catch { storage = null; }
const reminders = initReminders(storage);
let current = '';
const modes = ['reading', 'reminders'];
const targets = { reading: 'trainer', reminders: 'reminder-stage' };
const titles = { reading: '自由默念', reminders: '自我提醒' };
function selectMode(mode, scroll = true) {
  if (!modes.includes(mode) || mode === current) return;
  if (current === 'reading') suspendReading();
  if (current === 'reminders') reminders.pause();
  for (const name of modes) document.getElementById(`${name}-panel`).hidden = name !== mode;
  for (const link of document.querySelectorAll('[data-mode]')) {
    if (link.dataset.mode === mode) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  current = mode;
  writeData(storage, 'mode', mode);
  document.querySelector('.skip-link').href = '#' + targets[mode];
  document.title = '瞬读 blink · ' + titles[mode];
  if (mode === 'reading') refreshReading();
  if (mode === 'reminders') reminders.show();
  document.querySelector('.utility-nav').hidden = mode !== 'reading';
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
}
function route(scroll) {
  let mode = location.hash.slice(1);
  if (mode === 'tracking' || mode === 'breathing') {
    mode = 'reading';
    window.history.replaceState(null, '', '#reading');
  }
  if (!modes.includes(mode)) {
    if (current) return;
    const saved = readData(storage, 'mode', 'reading');
    mode = modes.includes(saved) ? saved : 'reading';
  }
  selectMode(mode, scroll);
}
window.addEventListener('hashchange', () => route(true));
route(false);
