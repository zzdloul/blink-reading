import { shuffle } from './content.js?v=6';
import { readData, writeData } from './storage.js';

export const themes = {
  focus: [
    '我想过的那种生活，值得我把最清醒的时间留给它。',
    '我的时间有去处，不能谁来敲门都有份。',
    '愿意把一件难事想透，是我对自己本事的尊重。',
    '别人随手发来的一条消息，不必占走我最好的半小时。',
    '最难熬的是开头那几分钟，往下才是我擅长的部分。',
    '一个上午能被琐事分完，也能被我完整地用一次。',
    '真正让我痛快的，是终于解开那个困了我几天的结。',
    '我看重自己答应过的事，哪怕没人来检查。',
    '我已经在这件事上走了这么远，值得再往深处走。',
    '有些事要想上很久才有头绪，我肯给自己这段时间。',
    '我想有一天，遇到真正难的事，也有底气说我来。',
    '分出去的每一分钟，都要从我真想做的事里扣。',
    '生活里已经有够多意外，自己的注意力我想自己做主。',
    '我认得那种踏实感，抬起头时，难题已经有了眉目。',
    '我可以暂时没有答案，也可以把一个问题追到底。',
    '专心把事做成的滋味，比看别人做成更过瘾。'
  ],
  study: [
    '我想要的选择权，有一部分就藏在今天肯学的东西里。',
    '这次肯把一道难题吃透，下次我就有自己的解法。',
    '真正学到手的本事，换个地方也跟着我走。',
    '我想听懂更难的讨论，也想说出有分量的意见。',
    '我肯为一个好问题多花时间，弄懂了，往后都受用。',
    '我羡慕过别人的从容，也愿意练出自己的功底。',
    '今天多弄懂一层，明天做决定时就少一点盲目。',
    '我想把当年只能仰望的事，慢慢变成自己的日常。',
    '一件事反复做不好，正值得我把它学明白。',
    '以后遇到机会，我想拿得出作品，接得住责任。'
  ],
  money: [
    '钱是我用时间挣来的，我在意它最后换回了什么。',
    '我想攒下的，是遇到变故也能从容几个月的底气。',
    '一件东西如果原价时根本不想要，打折也没有替我省钱。',
    '我愿意为天天用的好东西付钱，也舍得让热闹的新品过去。',
    '手里有余钱，遇到不合适的选择，我才更敢拒绝。',
    '结账只用几秒，那笔钱可能是我半天的辛苦。',
    '有些东西我确实买得起，只是另一个目标更值得。',
    '我存下这笔钱，是想让以后的自己有得选。'
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
  const interval = document.getElementById('reminder-interval');
  const note = document.getElementById('reminder-interval-note');
  const savedSeconds = readData(storage, 'reminder-seconds', 3);
  interval.value = String(savedSeconds);
  if (!interval.validity.valid) interval.value = '3';
  let seconds = interval.valueAsNumber;
  const preference = readData(storage, 'reminder-topic', 'focus');
  if ([...topic.options].some(option => option.value === preference)) topic.value = preference;
  let draw = createReminderDeck(topic.value);
  let timer = null;
  let firstVisit = true;

  function advance() { line.textContent = draw(); }
  function schedule() {
    clearInterval(timer);
    timer = setInterval(advance, seconds * 1000);
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
  interval.addEventListener('input', () => {
    note.textContent = '';
    if (!interval.validity.valid) return;
    seconds = interval.valueAsNumber;
    writeData(storage, 'reminder-seconds', seconds);
    if (timer !== null) schedule();
  });
  interval.addEventListener('blur', () => {
    if (interval.validity.valid) return;
    interval.value = String(seconds);
    note.textContent = '可输入 0.5 至 300 秒，当前使用 ' + seconds + ' 秒。';
  });
  interval.addEventListener('keydown', event => {
    if (event.key === 'Enter') interval.blur();
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else show(); });
  window.addEventListener('pagehide', pause);
  advance();
  return { pause, show };
}
