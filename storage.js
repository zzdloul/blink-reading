import { sanitizeSettings } from './engine.js';
const PREFIX = 'blink-reading:v1:';
export function readData(storage, key, fallback) {
  try { return JSON.parse(storage.getItem(PREFIX + key)) ?? fallback; } catch { return fallback; }
}
export function writeData(storage, key, value) {
  try { storage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}
export function loadSettings(storage) { return sanitizeSettings(readData(storage, 'settings', {})); }
export function loadHistory(storage) {
  const data = readData(storage, 'history', []);
  if (!Array.isArray(data)) return [];
  return data.filter(r => r && typeof r.id === 'string' && Number.isFinite(r.at) &&
    Number.isFinite(r.seconds) && r.seconds >= 0 && Number.isFinite(r.count) && r.count >= 0 &&
    ['mixed', 'numbers', 'chinese', 'english', 'custom'].includes(r.category) &&
    Number.isFinite(r.exposure) && Number.isFinite(r.gap)).slice(0, 100);
}
