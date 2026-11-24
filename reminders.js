import { shuffle } from './content.js?v=6';
import { readData, writeData } from './storage.js';

export const themes = {
  focus: [
    '我的注意力，由我慢慢收回来。',
    '这一刻，我只专心于一件事。',
    '一个念头飘过，我也能安定下来。',
    '我有自己的节奏。',
    '安静下来的这几分钟，属于我。',
    '我愿意把心思留给眼前的事。',
    '偶尔走神，我依然能找回专注。',
    '我的心思，可以慢慢沉下来。',
    '我喜欢全神贯注时的自己。',
    '有些消息，晚一点看也没关系。',
    '我有冲动，也有选择。',
    '我的时间，可以由我安排。',
    '专心投入的时候，我很踏实。',
    '我可以沉得住气。',
    '我在意的事情，值得我的专注。',
    '我能决定把注意力留给什么。',
    '心里有点杂念，我也能静下来。',
    '我愿意给一件事完整的关注。'
  ],
  study: [
    '我愿意为学习留出时间。',
    '多懂一点，就是今天的收获。',
    '学进去的东西，会成为我的本领。',
    '遇到难处，我也有耐心。',
    '花在学习上的时间，值得。',
    '今天的生疏，也有它的意义。',
    '每一点进步，都算数。',
    '走得慢的时候，我也在积累。',
    '我想学的事，值得我花时间。',
    '一次失误，抹不掉我的努力。'
  ],
  money: [
    '我愿意把钱留给真正在意的事。',
    '喜欢一样东西，也可以只是喜欢。',
    '小小的积蓄，也能给我更多选择。',
    '我的钱，可以按我的需要花。',
    '有些想买的念头，会慢慢变淡。',
    '手里有点余钱，我心里就踏实。',
    '我拥有的东西里，已有许多好物。',
    '折扣会过去，我的选择还在。'
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
  const panel = document.getElementById('reminders-panel');
  const topic = document.getElementById('reminder-topic');
  const preference = readData(storage, 'reminder-topic', 'focus');
  if ([...topic.options].some(option => option.value === preference)) topic.value = preference;
  let draw = createReminderDeck(topic.value);
  let timer = null;
  let firstVisit = true;

  function advance() { line.textContent = draw(); }
  function schedule() {
    clearInterval(timer);
    timer = setInterval(advance, 3000);
  }
  function pause() {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
    play.textContent = '继续轮播';
    line.setAttribute('aria-live', 'polite');
  }
  function start() {
    play.textContent = '暂停轮播';
    line.setAttribute('aria-live', 'off');
    schedule();
  }
  function show() {
    if (firstVisit && !document.hidden && !panel.hidden) {
      firstVisit = false;
      start();
    }
  }
  play.addEventListener('click', () => { if (timer === null) start(); else pause(); });
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else show(); });
  window.addEventListener('pagehide', pause);
  advance();
  return { pause, show };
}
