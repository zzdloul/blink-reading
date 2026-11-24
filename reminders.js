import { shuffle } from './content.js?v=6';
import { readData, writeData } from './storage.js';

export const themes = {
  focus: [
    '此刻，我只需要专心于一件事。',
    '心思飘远了，我也能慢慢回来。',
    '这个念头可以路过，我可以继续读。',
    '我有好奇心，也有选择把注意力放在哪里的自由。',
    '这一小段安静的时间，属于我自己。',
    '还有好多事要忙，眼前这一件也值得我安心投入。',
    '我偶尔分心，也能一次次找回自己的节奏。',
    '外面有很多声音，我仍然可以听清心里的这句话。',
    '我可以慢一点，让心思跟上正在读的字。',
    '有些消息晚一点看也没关系。',
    '我不必回应每一个突然冒出来的念头。',
    '我可以想起别的事，也可以留在这一刻。',
    '专心的这一小会儿，我心里是踏实的。',
    '我有想刷手机的时候，也有安安静静投入的时候。',
    '手边的事值得我把这一刻留给它。',
    '刚才走神的那一会儿，决定不了接下来的我。',
    '心里有一点杂念，也容得下这一句话。',
    '我喜欢沉下心来、渐渐读懂的感觉。'
  ],
  study: [
    '时间很珍贵，我愿意把其中一部分留给学习。',
    '读懂一个原来不懂的地方，就是今天的收获。',
    '一点一点学进去的东西，会成为我自己的本领。',
    '遇到难处时，我可以给自己多一点耐心。',
    '我花在学习上的这一小段时间，有它的分量。',
    '我不必一开始就熟练，生疏也是学习的一部分。',
    '今天比昨天多懂一点，我就有理由为自己高兴。',
    '有进展快的日子，也有慢的日子，我都在积累。',
    '想学的东西值得我为它留出时间。',
    '我已经付出的努力，不会因为一次失误就消失。'
  ],
  money: [
    '我知道自己真正看重什么，钱可以留给那些事。',
    '喜欢一样东西，也可以只是喜欢。',
    '一笔小小的积蓄，也在给以后的我多一种选择。',
    '我可以按自己的需要花钱，按自己的节奏生活。',
    '有些想买的念头，过一会儿就淡了。',
    '我喜欢手里有一点余钱时的踏实感。',
    '我已有的东西里，也有许多用起来顺手的。',
    '折扣会过去，我的选择一直都在。'
  ]
};

export function createReminderDeck(topic, random = Math.random) {
  const lines = topic === 'all' ? Object.values(themes).flat() : themes[topic];
  let deck = [];
  let last;
  return () => {
    if (!deck.length) {
      deck = shuffle(lines, random);
      if (deck.at(-1) === last) [deck[0], deck[deck.length - 1]] = [deck.at(-1), deck[0]];
    }
    last = deck.pop();
    return last;
  };
}

export function initReminders(storage) {
  const line = document.getElementById('reminder-line');
  const play = document.getElementById('reminder-play');
  const interval = document.getElementById('reminder-interval');
  const topic = document.getElementById('reminder-topic');
  const preference = readData(storage, 'reminder-topic', 'focus');
  if ([...topic.options].some(option => option.value === preference)) topic.value = preference;
  let draw = createReminderDeck(topic.value);
  const saved = readData(storage, 'reminder-seconds', 8);
  if ([...interval.options].some(option => option.value === String(saved))) interval.value = String(saved);
  let timer = null;

  function advance() { line.textContent = draw(); }
  function schedule() {
    clearInterval(timer);
    timer = setInterval(advance, Number(interval.value) * 1000);
  }
  function pause() {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
    play.textContent = '继续轮播';
    line.setAttribute('aria-live', 'polite');
  }
  play.addEventListener('click', () => {
    if (timer !== null) { pause(); return; }
    play.textContent = '暂停轮播';
    line.setAttribute('aria-live', 'off');
    schedule();
  });
  document.getElementById('reminder-next').addEventListener('click', () => {
    advance();
    if (timer !== null) schedule();
  });
  topic.addEventListener('change', () => {
    writeData(storage, 'reminder-topic', topic.value);
    draw = createReminderDeck(topic.value);
    advance();
    if (timer !== null) schedule();
  });
  interval.addEventListener('change', () => {
    writeData(storage, 'reminder-seconds', Number(interval.value));
    if (timer !== null) schedule();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', pause);
  advance();
  return { pause };
}
