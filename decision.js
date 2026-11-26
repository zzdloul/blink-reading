import { shuffle } from './content.js?v=6';
import { readData, writeData } from './storage.js';

export const DECISION_MODES = Object.freeze({
  figures: '颜色与形状',
  stroop: '字与颜色',
  magnitude: '数字与字号',
  arrows: '箭头方向'
});

export const DECISION_PRESETS = Object.freeze({
  calm: { label: '舒缓', look: 2.0, answer: 1.2 },
  standard: { label: '标准', look: 1.5, answer: 1.0 },
  fast: { label: '极速', look: 0.9, answer: 0.7 }
});

export const BLANK_MS = 200;

const FIGURE_COLORS = [
  { name: '蓝色', hex: '#2468bd' },
  { name: '橙色', hex: '#bd5308' },
  { name: '紫色', hex: '#8c378e' }
];
const FIGURE_SHAPES = ['圆形', '方形', '三角形'];

const STROOP_ITEMS = [
  { name: '红', hex: '#c93b32' },
  { name: '蓝', hex: '#2266bc' },
  { name: '绿', hex: '#1f7a4c' },
  { name: '橙', hex: '#c85c0b' },
  { name: '紫', hex: '#88378b' }
];

const DIRECTIONS = [
  { id: 'left', label: '向左', symbol: '←' },
  { id: 'right', label: '向右', symbol: '→' },
  { id: 'up', label: '向上', symbol: '↑' },
  { id: 'down', label: '向下', symbol: '↓' }
];

function pickDifferentIndex(count, base, random) {
  return (base + 1 + Math.floor(random() * (count - 1))) % count;
}

export function sanitizeSeconds(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0.5 || num > 60) return fallback;
  return Math.round(num * 100) / 100;
}

function buildFigureDeck(random) {
  const trials = [];
  for (const rule of ['color', 'shape']) {
    for (const sameColor of [true, false]) {
      for (const sameShape of [true, false]) {
        const repeats = sameColor !== sameShape ? 2 : 1;
        for (let i = 0; i < repeats; i++) {
          const leftColor = Math.floor(random() * FIGURE_COLORS.length);
          const rightColor = sameColor ? leftColor : pickDifferentIndex(FIGURE_COLORS.length, leftColor, random);
          const leftShape = Math.floor(random() * FIGURE_SHAPES.length);
          const rightShape = sameShape ? leftShape : pickDifferentIndex(FIGURE_SHAPES.length, leftShape, random);
          const match = rule === 'color' ? sameColor : sameShape;
          const values = rule === 'color'
            ? [FIGURE_COLORS[leftColor].name, FIGURE_COLORS[rightColor].name]
            : [FIGURE_SHAPES[leftShape], FIGURE_SHAPES[rightShape]];
          trials.push({
            kind: 'figures',
            kindLabel: DECISION_MODES.figures,
            rule,
            question: rule === 'color' ? '只看颜色' : '只看形状',
            color: [leftColor, rightColor],
            colorHex: [FIGURE_COLORS[leftColor].hex, FIGURE_COLORS[rightColor].hex],
            shape: [leftShape, rightShape],
            match,
            answer: match ? '相同' : '不同',
            answerTone: match ? 'positive' : 'contrast',
            reason: match ? `同为${values[0]}` : `${values[0]}和${values[1]}`
          });
        }
      }
    }
  }
  return shuffle(trials, random);
}

function buildStroopDeck(random) {
  const trials = [];
  for (const rule of ['word', 'ink']) {
    for (const conflict of [true, true, true, false]) {
      for (let i = 0; i < 2; i++) {
        const wordIdx = Math.floor(random() * STROOP_ITEMS.length);
        const inkIdx = conflict ? pickDifferentIndex(STROOP_ITEMS.length, wordIdx, random) : wordIdx;
        const word = STROOP_ITEMS[wordIdx];
        const ink = STROOP_ITEMS[inkIdx];
        const target = rule === 'word' ? word.name : ink.name;
        trials.push({
          kind: 'stroop',
          kindLabel: DECISION_MODES.stroop,
          rule,
          question: rule === 'word' ? '只看字' : '只看颜色',
          word: word.name,
          inkName: ink.name,
          inkHex: ink.hex,
          conflict,
          answer: rule === 'word' ? `「${target}」` : `${target}色`,
          answerTone: 'accent',
          answerHex: rule === 'ink' ? ink.hex : '',
          reason: conflict ? `字是「${word.name}」，颜色是${ink.name}` : `字和颜色都是${word.name}`
        });
      }
    }
  }
  return shuffle(trials, random);
}

function buildMagnitudeDeck(random) {
  const trials = [];
  for (const rule of ['value', 'size']) {
    for (const conflict of [true, true, true, false]) {
      for (const bigSide of [0, 1]) {
        const low = 1 + Math.floor(random() * 4);
        const high = 5 + Math.floor(random() * 5);
        const values = conflict
          ? (bigSide === 0 ? [low, high] : [high, low])
          : (bigSide === 0 ? [high, low] : [low, high]);
        const sizes = bigSide === 0 ? ['large', 'small'] : ['small', 'large'];
        const winner = rule === 'size'
          ? bigSide
          : (values[0] > values[1] ? 0 : 1);
        trials.push({
          kind: 'magnitude',
          kindLabel: DECISION_MODES.magnitude,
          rule,
          question: rule === 'value' ? '哪个数值大' : '哪个字号大',
          values,
          sizes,
          conflict,
          winner,
          answer: winner === 0 ? '左边' : '右边',
          answerTone: 'positive',
          reason: rule === 'value'
            ? `${values[winner]} 大于 ${values[1 - winner]}`
            : `${winner === 0 ? '左边' : '右边'}字号更大`
        });
      }
    }
  }
  return shuffle(trials, random);
}

function buildArrowsDeck(random) {
  const trials = [];
  for (const rule of ['center', 'outer']) {
    for (const conflict of [true, true, true, false]) {
      for (let i = 0; i < 2; i++) {
        const centerIdx = Math.floor(random() * DIRECTIONS.length);
        const outerIdx = conflict ? pickDifferentIndex(DIRECTIONS.length, centerIdx, random) : centerIdx;
        const centerDir = DIRECTIONS[centerIdx];
        const outerDir = DIRECTIONS[outerIdx];
        const target = rule === 'center' ? centerDir : outerDir;
        trials.push({
          kind: 'arrows',
          kindLabel: DECISION_MODES.arrows,
          rule,
          question: rule === 'center' ? '只看中间' : '看四周',
          centerDir: centerDir.id,
          outerDir: outerDir.id,
          conflict,
          targetDir: target.id,
          answer: `${target.symbol} ${target.label}`,
          answerTone: 'positive',
          reason: conflict
            ? `中间${centerDir.label}，四周${outerDir.label}`
            : `全部指向${target.label}`
        });
      }
    }
  }
  return shuffle(trials, random);
}

export function createDecisionStream(mode = 'all', random = Math.random) {
  const builders = {
    figures: buildFigureDeck,
    stroop: buildStroopDeck,
    magnitude: buildMagnitudeDeck,
    arrows: buildArrowsDeck
  };
  if (mode !== 'all' && !(mode in builders)) {
    throw new Error('未知决策玩法');
  }
  const activeModes = mode === 'all' ? Object.keys(builders) : [mode];
  let modeBag = [];
  let lastMode = '';
  const decks = new Map();

  return () => {
    let chosen = activeModes[0];
    if (activeModes.length > 1) {
      if (!modeBag.length) {
        modeBag = shuffle(activeModes, random);
        if (modeBag.at(-1) === lastMode) [modeBag[0], modeBag[modeBag.length - 1]] = [modeBag.at(-1), modeBag[0]];
      }
      chosen = modeBag.pop();
    }
    lastMode = chosen;

    let deck = decks.get(chosen);
    if (!deck?.length) {
      deck = builders[chosen](random);
      decks.set(chosen, deck);
    }
    return deck.pop();
  };
}

function makeShapeGlyph(shape, color) {
  const span = document.createElement('span');
  span.className = 'decision-cue-glyph';
  span.dataset.shape = String(shape);
  if (color) span.style.setProperty('--glyph-color', color);
  return span;
}

export function initDecision(storage) {
  const byId = name => document.getElementById('decision-' + name);
  const panel = byId('panel');
  const stage = byId('stage');
  const badge = byId('kind-badge');
  const phaseDot = byId('phase-dot');
  const phaseText = byId('phase-text');
  const meterBar = byId('meter-bar');
  const questionEl = byId('question');

  const figuresBox = byId('figures');
  const figureCards = [byId('figure-left'), byId('figure-right')];
  const stroopBox = byId('stroop');
  const stroopWord = byId('stroop-word');
  const magnitudeBox = byId('magnitude');
  const numCards = [byId('num-left'), byId('num-right')];
  const arrowsBox = byId('arrows');
  const arrowSlots = [...arrowsBox.querySelectorAll('.decision-arrow')];

  const visualCueEl = byId('visual-cue');
  const answerEl = byId('answer');
  const reasonEl = byId('reason');
  const playBtn = byId('play');
  const stepBtn = byId('step');
  const focusBtn = byId('focus-toggle');
  const focusExitBtn = byId('focus-exit');
  const modeSelect = byId('mode');
  const presetButtons = [...document.querySelectorAll('[data-decision-preset]')];
  const lookInput = byId('look-seconds');
  const answerInput = byId('answer-seconds');
  const noteEl = byId('note');
  const announceEl = byId('announcement');

  let lookSeconds = sanitizeSeconds(readData(storage, 'decision-look-seconds', 1.5), 1.5);
  let answerSeconds = sanitizeSeconds(readData(storage, 'decision-answer-seconds', 1.0), 1.0);
  lookInput.value = String(lookSeconds);
  answerInput.value = String(answerSeconds);

  const savedMode = readData(storage, 'decision-visual-mode', 'all');
  if ([...modeSelect.options].some(option => option.value === savedMode)) {
    modeSelect.value = savedMode;
  }

  let nextTrial = createDecisionStream(modeSelect.value);
  let trial = nextTrial();
  let phase = 'cue'; // 'cue' | 'reveal' | 'blank'
  let timer = null;
  let firstVisit = true;
  let beatFlip = false;

  function syncPresetButtons() {
    for (const btn of presetButtons) {
      const preset = DECISION_PRESETS[btn.dataset.decisionPreset];
      const active = Boolean(preset && preset.look === lookSeconds && preset.answer === answerSeconds);
      btn.setAttribute('aria-pressed', String(active));
    }
  }

  function renderVisualCue() {
    visualCueEl.replaceChildren();
    if (phase !== 'reveal') {
      visualCueEl.hidden = true;
      return;
    }
    if (trial.kind === 'figures') {
      const left = trial.rule === 'color'
        ? makeShapeGlyph(0, trial.colorHex[0])
        : makeShapeGlyph(trial.shape[0], '#51695c');
      const right = trial.rule === 'color'
        ? makeShapeGlyph(0, trial.colorHex[1])
        : makeShapeGlyph(trial.shape[1], '#51695c');
      const op = document.createElement('span');
      op.className = 'decision-cue-op';
      op.textContent = trial.match ? '=' : '≠';
      visualCueEl.append(left, op, right);
      visualCueEl.hidden = false;
      return;
    }
    if (trial.kind === 'stroop' && trial.rule === 'ink') {
      visualCueEl.append(makeShapeGlyph(0, trial.inkHex));
      visualCueEl.hidden = false;
      return;
    }
    visualCueEl.hidden = true;
  }

  function renderVisual() {
    figuresBox.hidden = trial.kind !== 'figures';
    stroopBox.hidden = trial.kind !== 'stroop';
    magnitudeBox.hidden = trial.kind !== 'magnitude';
    arrowsBox.hidden = trial.kind !== 'arrows';

    if (trial.kind === 'figures') {
      for (const [side, card] of figureCards.entries()) {
        card.dataset.color = String(trial.color[side]);
        card.dataset.shape = String(trial.shape[side]);
        card.setAttribute('aria-label', FIGURE_COLORS[trial.color[side]].name + FIGURE_SHAPES[trial.shape[side]]);
      }
    } else if (trial.kind === 'stroop') {
      stroopWord.textContent = trial.word;
      // When the rule asks for the word itself, strip distracting ink color on reveal.
      stroopWord.style.color = phase === 'reveal' && trial.rule === 'word' ? 'var(--ink)' : trial.inkHex;
      stroopWord.setAttribute('aria-label', `${trial.inkName}色的${trial.word}字`);
    } else if (trial.kind === 'magnitude') {
      for (const [side, card] of numCards.entries()) {
        card.textContent = String(trial.values[side]);
        card.dataset.size = trial.sizes[side];
        card.dataset.winner = phase === 'reveal' ? String(side === trial.winner) : '';
        card.setAttribute('aria-label', `${side === 0 ? '左边' : '右边'}数字 ${trial.values[side]}`);
      }
    } else if (trial.kind === 'arrows') {
      for (const [idx, slot] of arrowSlots.entries()) {
        const isCenter = idx === 2;
        const dir = isCenter ? trial.centerDir : trial.outerDir;
        slot.dataset.dir = dir;
        if (phase === 'reveal') {
          const isTarget = trial.rule === 'center' ? isCenter : !isCenter;
          slot.dataset.focus = isTarget ? 'target' : 'noise';
        } else {
          delete slot.dataset.focus;
        }
      }
      const centerLabel = DIRECTIONS.find(d => d.id === trial.centerDir).label;
      const outerLabel = DIRECTIONS.find(d => d.id === trial.outerDir).label;
      arrowsBox.setAttribute('aria-label', `中间箭头${centerLabel}，四周箭头${outerLabel}`);
    }
  }

  function currentDurationMs() {
    if (phase === 'blank') return BLANK_MS;
    return (phase === 'cue' ? lookSeconds : answerSeconds) * 1000;
  }

  function render(announceManual = false) {
    const running = timer !== null;
    stage.dataset.phase = phase;
    stage.dataset.running = String(running);
    stage.dataset.kind = trial.kind;
    badge.textContent = trial.kindLabel;
    phaseDot.classList.toggle('paused', !running);
    phaseText.textContent = !running
      ? (phase === 'cue' ? '已暂停 · 看图秒判' : '已暂停 · 看答案')
      : (phase === 'reveal' ? '答案 · 对照一下' : '看图 · 心里秒判');

    questionEl.textContent = trial.question;
    renderVisual();
    renderVisualCue();

    answerEl.style.removeProperty('--answer-color');
    if (phase === 'reveal') {
      answerEl.textContent = trial.answer;
      answerEl.dataset.tone = trial.answerTone;
      if (trial.answerHex) answerEl.style.setProperty('--answer-color', trial.answerHex);
      reasonEl.textContent = trial.reason;
      stepBtn.textContent = '下一局';
    } else {
      answerEl.textContent = '心里秒判…';
      answerEl.dataset.tone = 'placeholder';
      reasonEl.textContent = '不用点选项，心里默选即可';
      stepBtn.textContent = '看答案';
    }

    playBtn.textContent = running ? '暂停轮播' : '继续轮播';

    if (running && phase !== 'blank') {
      beatFlip = !beatFlip;
      meterBar.style.setProperty('--beat-ms', `${currentDurationMs()}ms`);
      meterBar.dataset.beat = beatFlip ? 'a' : 'b';
    } else {
      delete meterBar.dataset.beat;
    }

    if (announceManual) {
      if (phase === 'cue') {
        const desc = trial.kind === 'figures'
          ? `左边${figureCards[0].getAttribute('aria-label')}，右边${figureCards[1].getAttribute('aria-label')}`
          : trial.kind === 'stroop'
            ? stroopWord.getAttribute('aria-label')
            : trial.kind === 'magnitude'
              ? `${numCards[0].getAttribute('aria-label')}，${numCards[1].getAttribute('aria-label')}`
              : arrowsBox.getAttribute('aria-label');
        announceEl.textContent = `${trial.question}。${desc}。`;
      } else if (phase === 'reveal') {
        announceEl.textContent = `答案：${trial.answer}。${trial.reason}`;
      }
    }
  }

  function scheduleNext() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (phase === 'cue') {
        phase = 'reveal';
      } else if (phase === 'reveal') {
        phase = 'blank';
      } else {
        trial = nextTrial();
        phase = 'cue';
      }
      scheduleNext();
      render(false);
    }, currentDurationMs());
  }

  function start() {
    if (timer !== null) return;
    if (phase === 'blank') {
      trial = nextTrial();
      phase = 'cue';
    }
    scheduleNext();
    render(false);
  }

  function pause(announcePause = false) {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    if (phase === 'blank') {
      trial = nextTrial();
      phase = 'cue';
    }
    render(announcePause);
  }

  function setFocus(enabled) {
    const active = Boolean(enabled);
    document.body.classList.toggle('decision-focus', active);
    focusBtn.setAttribute('aria-pressed', String(active));
    focusBtn.setAttribute('aria-label', active ? '退出专注模式' : '进入专注模式');
    focusExitBtn.hidden = !active;
    for (const selector of ['.site-header', '#decision-panel .intro', 'footer']) {
      const node = document.querySelector(selector);
      if (node) node.inert = active;
    }
  }

  function toggle() {
    if (timer === null) start();
    else pause(true);
  }

  function stepForward(manual = true) {
    const wasRunning = timer !== null;
    if (phase === 'cue') {
      phase = 'reveal';
    } else {
      trial = nextTrial();
      phase = 'cue';
    }
    if (wasRunning) scheduleNext();
    render(manual);
  }

  function show() {
    if (firstVisit && !document.hidden && !panel.hidden) {
      firstVisit = false;
      start();
    }
  }

  function applyPace(nextLook, nextAnswer, feedbackText = '') {
    lookSeconds = sanitizeSeconds(nextLook, lookSeconds);
    answerSeconds = sanitizeSeconds(nextAnswer, answerSeconds);
    lookInput.value = String(lookSeconds);
    answerInput.value = String(answerSeconds);
    writeData(storage, 'decision-look-seconds', lookSeconds);
    writeData(storage, 'decision-answer-seconds', answerSeconds);
    syncPresetButtons();
    if (feedbackText) noteEl.textContent = feedbackText;
    if (timer !== null && phase !== 'blank') {
      scheduleNext();
      render(false);
    }
  }

  function bindSecondsInput(input, key, getVal, setVal) {
    input.addEventListener('input', () => {
      noteEl.textContent = '';
      if (!input.validity.valid) return;
      const next = sanitizeSeconds(input.valueAsNumber, getVal());
      setVal(next);
      writeData(storage, key, next);
      syncPresetButtons();
      if (timer !== null && phase !== 'blank') {
        scheduleNext();
        render(false);
      }
    });
    input.addEventListener('blur', () => {
      if (input.validity.valid && Number.isFinite(input.valueAsNumber)) {
        const clean = sanitizeSeconds(input.valueAsNumber, getVal());
        setVal(clean);
        input.value = String(clean);
        syncPresetButtons();
        return;
      }
      input.value = String(getVal());
      noteEl.textContent = `可输入 0.5 至 60 秒，当前使用 ${getVal()} 秒。`;
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') input.blur();
    });
  }

  bindSecondsInput(lookInput, 'decision-look-seconds', () => lookSeconds, v => { lookSeconds = v; });
  bindSecondsInput(answerInput, 'decision-answer-seconds', () => answerSeconds, v => { answerSeconds = v; });

  for (const btn of presetButtons) {
    btn.addEventListener('click', () => {
      const preset = DECISION_PRESETS[btn.dataset.decisionPreset];
      if (!preset) return;
      applyPace(preset.look, preset.answer, `已切换到${preset.label}：看图 ${preset.look} 秒 · 看答案 ${preset.answer} 秒`);
    });
  }

  playBtn.addEventListener('click', toggle);
  stepBtn.addEventListener('click', () => stepForward(true));
  focusBtn.addEventListener('click', () => setFocus(!document.body.classList.contains('decision-focus')));
  focusExitBtn.addEventListener('click', () => setFocus(false));

  stage.addEventListener('click', event => {
    if (event.target.closest('button')) return;
    if (window.getSelection?.().toString()) return;
    stepForward(true);
  });

  modeSelect.addEventListener('change', () => {
    writeData(storage, 'decision-visual-mode', modeSelect.value);
    nextTrial = createDecisionStream(modeSelect.value);
    trial = nextTrial();
    phase = 'cue';
    if (timer !== null) scheduleNext();
    render(true);
  });

  document.addEventListener('keydown', event => {
    if (panel.hidden) return;
    if (document.querySelector('dialog[open]') || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
    if (event.key === 'Escape' && document.body.classList.contains('decision-focus')) {
      event.preventDefault();
      setFocus(false);
      return;
    }
    if (event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
    if (event.code === 'Space') {
      if (event.target.closest('button,summary,a')) return;
      event.preventDefault();
      toggle();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepForward(true);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const delta = event.key === 'ArrowUp' ? -0.2 : 0.2;
      applyPace(lookSeconds + delta, answerSeconds + delta, `节奏已调为：看图 ${sanitizeSeconds(lookSeconds + delta, lookSeconds)} 秒 · 看答案 ${sanitizeSeconds(answerSeconds + delta, answerSeconds)} 秒`);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      setFocus(!document.body.classList.contains('decision-focus'));
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause(false);
    else show();
  });
  window.addEventListener('pagehide', () => pause(false));

  syncPresetButtons();
  render(false);
  return {
    pause: () => { pause(false); setFocus(false); },
    show
  };
}
