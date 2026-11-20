import { suspendReading, refreshReading } from './app.js?v=4';
import { initTracking } from './tracking.js?v=3';
import { initBreathing } from './breathing.js';
import { readData, writeData } from './storage.js';

let storage;
try { storage = window.localStorage; } catch { storage = null; }
const tracking = initTracking(storage);
const breathing = initBreathing(storage);
let current = '';
const modes = ['reading', 'tracking', 'breathing'];
const targets = { reading: 'trainer', tracking: 'tracker', breathing: 'breather' };
const titles = { reading: '自由默念', tracking: '视线追踪', breathing: '呼吸训练' };
function selectMode(mode, scroll = true) {
  if (!modes.includes(mode) || mode === current) return;
  if (current === 'reading') suspendReading();
  if (current === 'tracking') tracking.suspend();
  if (current === 'breathing') breathing.pause();
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
  if (mode === 'tracking') tracking.show();
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
}
window.addEventListener('hashchange', () => selectMode(location.hash.slice(1)));
const saved = readData(storage, 'mode', 'reading');
const initial = modes.includes(location.hash.slice(1)) ? location.hash.slice(1) : modes.includes(saved) ? saved : 'reading';
selectMode(initial, false);
