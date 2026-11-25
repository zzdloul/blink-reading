import { shuffle } from './content.js?v=6';
import { createEvidenceStream } from './evidence.js?v=12';

const colors = ['蓝色', '橙色', '紫色'];
const shapes = ['圆形', '方形', '三角形'];
const rules = { color: '颜色', shape: '形状' };

function pair(count, match, random) {
  const left = Math.floor(random() * count);
  const right = match ? left : (left + 1 + Math.floor(random() * (count - 1))) % count;
  return [left, right];
}

export function createJudgmentRound(random = Math.random) {
  const trials = [];
  for (const rule of Object.keys(rules)) {
    for (const sameColor of [true, false]) {
      for (const sameShape of [true, false]) {
        // Twice per combination, including when the irrelevant feature suggests the opposite response.
        for (let i = 0; i < 2; i++) {
          const color = pair(colors.length, sameColor, random);
          const shape = pair(shapes.length, sameShape, random);
          trials.push({
            rule, color, shape,
            correct: rule === 'color' ? sameColor : sameShape
          });
        }
      }
    }
  }
  return shuffle(trials, random);
}

function createFigureStream() {
  let deck = [];
  return () => {
    if (!deck.length) deck = createJudgmentRound();
    const trial = deck.pop();
    const labels = trial.rule === 'color' ? colors : shapes;
    const values = trial[trial.rule].map(value => labels[value]);
    return {
      ...trial,
      question: '只看' + rules[trial.rule],
      reason: '按' + rules[trial.rule] + '判断，两图' +
        (trial.correct ? '同为' + values[0] : '分别是' + values.join('和')) + '。'
    };
  };
}

export function initJudgment() {
  const byId = name => document.getElementById('judgment-' + name);
  const mode = byId('mode');
  const rule = byId('rule');
  const context = byId('context');
  const figures = byId('figures');
  const cards = [byId('left'), byId('right')];
  const yes = byId('same');
  const no = byId('different');
  const feedback = byId('feedback');
  const announcement = byId('announcement');
  const games = {
    evidence: { next: createEvidenceStream(), answered: 0, points: 0 },
    figures: { next: createFigureStream(), answered: 0, points: 0 }
  };

  function render() {
    const isEvidence = mode.value === 'evidence';
    const game = games[mode.value];
    const trial = game.trial ??= game.next();
    byId('progress').textContent = '第 ' + (game.answered + 1) + ' 题';
    byId('points').textContent = '答对 ' + game.points;
    rule.textContent = trial.question;
    context.hidden = !isEvidence;
    context.textContent = trial.context ?? '';
    figures.hidden = isEvidence;
    yes.textContent = isEvidence ? '证据够' : '相同';
    no.textContent = isEvidence ? '证据不够' : '不同';
    feedback.textContent = game.feedback ?? '';
    if (!isEvidence) {
      for (const [side, card] of cards.entries()) {
        card.dataset.color = trial.color[side];
        card.dataset.shape = trial.shape[side];
        card.setAttribute('aria-label', colors[trial.color[side]] + shapes[trial.shape[side]]);
      }
    }
  }

  function answer(choice) {
    const game = games[mode.value];
    const trial = game.trial;
    const hit = choice === trial.correct;
    game.answered++;
    if (hit) game.points++;
    game.feedback = (hit ? '上一题答对了。' : '上一题答错了。') + trial.reason;
    game.trial = game.next();
    render();
    const detail = game.trial.context ??
      ('左边' + cards[0].getAttribute('aria-label') + '，右边' + cards[1].getAttribute('aria-label') + '。');
    announcement.textContent = game.feedback + '第 ' + (game.answered + 1) + ' 题。' + rule.textContent + '。' + detail;
  }

  yes.addEventListener('click', () => answer(true));
  no.addEventListener('click', () => answer(false));
  mode.addEventListener('change', () => {
    announcement.textContent = '';
    render();
  });
  render();
}
