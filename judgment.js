import { shuffle } from './content.js?v=6';

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

export function initJudgment() {
  const byId = name => document.getElementById('judgment-' + name);
  const rule = byId('rule');
  const cards = [byId('left'), byId('right')];
  const feedback = byId('feedback');
  const quiz = byId('quiz');
  const summary = byId('summary');
  const score = byId('score');
  let round;
  let index;
  let points;

  function showTrial() {
    const trial = round[index];
    byId('progress').textContent = '第 ' + (index + 1) + ' / ' + round.length + ' 题';
    byId('meter').value = index;
    byId('points').textContent = '答对 ' + points;
    rule.textContent = '只看' + rules[trial.rule];
    for (const [side, card] of cards.entries()) {
      card.dataset.color = trial.color[side];
      card.dataset.shape = trial.shape[side];
      card.setAttribute('aria-label', colors[trial.color[side]] + shapes[trial.shape[side]]);
    }
  }

  function answer(same) {
    const trial = round[index];
    if (!trial) return;
    const hit = same === trial.correct;
    if (hit) points++;
    const labels = trial.rule === 'color' ? colors : shapes;
    const values = trial[trial.rule].map(value => labels[value]);
    const explanation = (hit ? '答对了' : '这题答错了') + '。按' + rules[trial.rule] + '判断，两图' +
      (trial.correct ? '同为' + values[0] : '分别是' + values.join('和')) + '。';
    index++;
    if (index === round.length) {
      quiz.hidden = true;
      summary.hidden = false;
      score.textContent = '本轮答对 ' + points + ' / ' + round.length + ' 题';
      byId('last').textContent = '最后一题。' + explanation;
      score.focus();
      return;
    }
    feedback.textContent = '上一题。' + explanation;
    showTrial();
    byId('announcement').textContent = explanation + '第 ' + (index + 1) + ' 题，' + rule.textContent +
      '。左边' + cards[0].getAttribute('aria-label') + '，右边' + cards[1].getAttribute('aria-label') + '。';
  }

  function startRound() {
    round = createJudgmentRound();
    index = 0;
    points = 0;
    quiz.hidden = false;
    summary.hidden = true;
    feedback.textContent = '';
    byId('announcement').textContent = '';
    byId('meter').max = round.length;
    showTrial();
  }

  byId('same').addEventListener('click', () => answer(true));
  byId('different').addEventListener('click', () => answer(false));
  byId('restart').addEventListener('click', () => {
    startRound();
    rule.focus();
  });
  startRound();
}
