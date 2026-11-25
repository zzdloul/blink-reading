import { shuffle } from './content.js?v=6';

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function integer(min, max, random) {
  return min + Math.floor(random() * (max - min + 1));
}

const scenarios = [
  (enough, random) => {
    const [place, change] = pick([
      ['北门', '暂停通行'], ['停车场', '免费开放'], ['服务台', '暂停办公'], ['活动室', '临时关闭']
    ], random);
    const venues = shuffle(['湖畔社区', '松桥社区', '石泉社区', '云溪社区'], random);
    const day = integer(3, 27, random);
    const mismatch = !enough && random() < 0.5;
    const noticeDay = enough || mismatch ? day : day - 1;
    const noticeVenue = mismatch ? venues[1] : venues[0];
    return {
      question: '能确认当日安排吗？',
      context: '你想确认 ' + day + ' 日' + venues[0] + '的' + place + '是否' + change + '。你找到一份官方通知，上面写的是「' + noticeDay + ' 日，' + noticeVenue + place + change + '」。',
      reason: enough ? '通知的日期、社区和事项都对得上。' : '通知的' + (mismatch ? '社区' : '日期') + '对不上，无法确认目标安排。'
    };
  },
  (enough, random) => {
    const [event, people] = pick([
      ['拼车', '位乘客'], ['读书会', '位参加者'], ['周末球赛', '位队员'], ['志愿活动', '位志愿者']
    ], random);
    const needed = integer(4, 12, random);
    const confirmed = needed + (enough ? integer(0, 2, random) : -integer(1, 3, random));
    const pending = Math.max(1, needed - confirmed) + integer(0, 4, random);
    return {
      question: '能确认人数达到要求吗？',
      context: event + '至少需要 ' + needed + ' ' + people + '。现在 ' + confirmed + ' 人明确答应，另有 ' + pending + ' 人说「可能会来」。',
      reason: '明确答应的有 ' + confirmed + ' 人。' + (enough ? '已经达到 ' + needed + ' 人。' : '可能会来的人还不能算入确认人数。')
    };
  },
  (enough, random) => {
    const [item, event] = pick([
      ['条公交线路', '晚点'], ['台打印机', '卡纸'], ['组取件柜', '故障'], ['条配送路线', '超时']
    ], random);
    const totalA = integer(2, 7, random) * 10;
    const totalB = totalA * integer(2, 4, random);
    const countA = integer(4, 12, random);
    const threshold = countA * (totalB / totalA);
    const countB = enough ? integer(threshold + 1, threshold + 4, random) : integer(threshold - 4, threshold, random);
    return {
      question: '这批记录能证明甲的比例更低吗？',
      context: '两' + item + '的记录使用同一个口径。甲的 ' + totalA + ' 次里有 ' + countA + ' 次' + event + '，乙的 ' + totalB + ' 次里有 ' + countB + ' 次。',
      reason: countA + ' / ' + totalA + ' 与 ' + countB + ' / ' + totalB + ' 相比，甲的比例' + (enough ? '更低。' : '没有更低。')
    };
  },
  (enough, random) => {
    const [object, feature, measure, unit, start] = pick([
      ['水壶', '壶盖', '水量', '毫升', 400],
      ['打印机', '打印模式', '份数', '份', 8],
      ['台灯', '灯罩', '测量距离', '厘米', 40],
      ['保温杯', '杯盖', '起始水温', '摄氏度', 60]
    ], random);
    const first = start + integer(0, 5, random);
    const second = enough ? first : first + integer(1, 6, random);
    return {
      question: '这次对比只改变了一个条件吗？',
      context: '你用同一' + (object === '打印机' || object === '台灯' ? '台' : '个') + object + '试两种' + feature + '。第一次' + measure + '是 ' + first + ' ' + unit + '，第二次是 ' + second + ' ' + unit + '，其余条件一致。',
      reason: enough ? measure + '一致，题目列出的条件中只有' + feature + '变了。' : feature + '和' + measure + '同时变了，两者的影响还分不开。'
    };
  },
  (enough, random) => {
    const [item, groupA, groupB] = pick([
      ['准时率', '早班', '晚班'], ['满意度', '工作日', '周末'], ['通过率', '甲组', '乙组'], ['领取率', '上午场', '下午场']
    ], random);
    const size = integer(8, 28, random);
    const percentage = Math.round(integer(4, size, random) / size * 100);
    return {
      question: '这个比例能代表全部记录吗？',
      context: '你要汇总' + groupA + '和' + groupB + '的全部' + item + '。手上的 ' + size + ' 份记录' + (enough
        ? '已经包含这两组的全部记录' : '只来自' + pick([groupA, groupB], random)) + '，汇总结果约为 ' + percentage + '%。',
      reason: enough ? '这次目标就是汇总两组现有记录，统计范围完整。' : '现有数字只反映其中一组，另一组的记录还未纳入。'
    };
  },
  (enough, random) => {
    const [event, source] = pick([
      ['车站临时关闭', '车站公告'], ['展厅暂停入场', '主办方通知'], ['本楼停水', '物业通知'], ['公园暂停开放', '管理方通告']
    ], random);
    const names = shuffle(['小周', '小林', '小陈', '小许', '小吴', '小陆', '小秦', '小唐'], random);
    return {
      question: '这里有两个独立的信息来源吗？',
      context: '关于「' + event + '」，' + names[0] + '看了' + source + '。' + names[1] + (enough
        ? '没有看过通知，到了现场亲自观察到这个情况。' : '从另一个群里收到了同一份' + source + '的截图。'),
      reason: enough ? '一条来自通知，另一条来自独立的现场观察。' : '截图和原文来自同一份通知，换一个群转发也还是同一来源。'
    };
  }
];

export function createEvidenceStream(random = Math.random) {
  let deck = [];
  let previous;
  return () => {
    if (!deck.length) {
      deck = shuffle(scenarios, random);
      if (deck.at(-1) === previous) [deck[0], deck[deck.length - 1]] = [deck.at(-1), deck[0]];
    }
    previous = deck.pop();
    const correct = random() < 0.5;
    return { ...previous(correct, random), correct };
  };
}
