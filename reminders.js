import { shuffle } from './content.js?v=6';
import { readData, writeData } from './storage.js';

export const themes = {
  focus: [
    '我想考上的那所学校，值得我把最清醒的时间留给复习。',
    '一条消息可以晚点回，一道快想通的题值得接着想。',
    '我的复习进度，写在我真正弄懂的那几页里。',
    '我喜欢那一刻，题目还是那道题，我却看出了门道。',
    '这一页有个地方一直没懂，我愿意在这里多花十分钟。',
    '复习最有劲的时候，是我忘了看时间，思路却越来越清楚。',
    '别人已经翻到哪一章，决定不了我眼前这道题怎么解。',
    '我读得进去的这半小时，很珍贵，我舍得把它留给自己。',
    '刚才漏看的那个条件，值得我把题干再读一遍。',
    '复习到难处，能坐得住，是我在给自己争取机会。',
    '越是惦记初试成绩，我越珍惜眼下这段能安心读书的时间。',
    '一个问题想透了，再翻下一页，我心里有底。',
    '难得有个完整的上午，我想看看自己能把这章学多深。',
    '刚才的十分钟已经过去，接下来的十分钟仍然由我支配。',
    '一张安静的书桌，一道值得琢磨的题，这会儿已经够了。',
    '我想走进考场时，记得自己曾这样专心地准备过。',
    '遇到没把握的题，我最需要的是把题读透的那点定力。',
    '今天能把一道题从头想通，这段自习就有了分量。',
    '看见别人交卷，我也能按自己的节奏把答案写完。',
    '备考的日子里，我最想守住的是每天那段不被打断的时间。'
  ],
  study: [
    '我想读研，是想把感兴趣的问题研究得更深。',
    '考场上能替我撑住的，是合上书也讲得清的东西。',
    '同一道错题，今天我终于能说清当时错在哪儿。',
    '我想攒下的底气，是看到陌生题目也知道从哪里入手。',
    '一套真题做得不理想，至少让我看清还有哪些分可以争。',
    '今天记得磕绊的知识点，下次再见，我会更熟一点。',
    '有些分数，要从我总想跳过的那一章里争回来。',
    '复习很长，真正走过的路，是那些从不会到会的瞬间。',
    '我愿意为想读的专业，耐心啃下眼前这几页。',
    '我期待有一天，能在自己选的方向上继续追问。',
    '真题换个问法我还能答出来，这份把握是我自己练出来的。',
    '从看懂答案，到自己写得出来，这段距离值得我走。',
    '翻回第一本笔记，我才发现，有些旧难题已经难不住我了。',
    '一次模考让我看清薄弱的地方，离初试还有机会补上。',
    '我喜欢自己的答案越来越有条理，那是下过功夫的痕迹。',
    '能把两个容易混的概念讲清楚，这一晚就有实实在在的收获。',
    '我盼着收到录取通知，也珍惜沿途长出来的真本事。',
    '复习也有平淡的日子，很多牢靠的记忆就长在这些日子里。',
    '考场里的沉着，来自平时一道道独立答完的题。',
    '真遇上没见过的题，我还有学过的原理可以依靠。'
  ],
  money: [
    '钱是我用时间挣来的，我在意它最后换回了什么。',
    '我想攒下的，是遇到变故也能从容几个月的底气。',
    '一件东西如果原价时根本不想要，打折也没有替我省钱。',
    '我愿意为天天用的好东西付钱，也舍得让热闹的新品过去。',
    '手里有余钱，遇到不合适的选择，我才更敢拒绝。',
    '结账只用几秒，那笔钱可能是我半天的辛苦。',
    '有些东西我确实买得起，只是另一个目标更值得。',
    '我存下这笔钱，是想让以后的自己有得选。',
    '同一本资料读到卷边，比书架上多一套新书更让我安心。',
    '我肯为真正用得上的课花钱，也清楚自己的时间能学多少。',
    '手里留足报名费和路费，我就能安心准备那场考试。',
    '一顿吃得舒服的饭值得花钱，凑单添的东西未必值得带回家。',
    '我可以喜欢一件东西，等真正需要它时再买。',
    '留一点余钱，临时要办件正事时就少一分为难。',
    '我花过最值的钱，往往买的是后来反复用到的东西。',
    '一个月里那些随手的小开销，加起来也是我能支配的一笔钱。',
    '我辛苦挣来的钱，值得花在自己真心认可的地方。',
    '为真正喜欢的事留好预算，花这笔钱时我也坦然。',
    '一件东西再便宜，闲置以后，占的也是我的钱和地方。',
    '把钱花在我选的生活上，这份主动权值得珍惜。'
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
