export const CHINESE = {
  easy: '天空 清风 星星 月亮 阳光 山林 河流 海洋 草地 花朵 果实 早晨 夜晚 春天 夏天 秋天 冬天 雨滴 白云 微笑 温柔 安静 自由 勇气 希望 朋友 家人 书本 音乐 画笔 灯光 城市 田野 小路 远方 旅行 脚步 眼睛 耳朵 双手 思考 发现 等待 记住 认真 专注 轻松 快乐 出发 回家'.split(' '),
  standard: '晨曦 黄昏 山谷 海岸 森林 溪水 浪花 落叶 露珠 雪花 萤火 彩虹 竹林 稻田 旅途 方向 记忆 节奏 灵感 片刻 细节 观察 理解 想象 探索 坚持 平衡 从容 清晰 笃定 纯粹 丰盈 晴朗 辽阔 细腻 沉静 流转 交汇 回响 绽放 飞跃 寻找 记录 感受 连接 整理 阅读 练习 思绪 心愿'.split(' '),
  challenge: '春暖花开 山清水秀 风和日丽 鸟语花香 海阔天空 星光灿烂 云淡风轻 细水长流 脚踏实地 全神贯注 聚精会神 日积月累 循序渐进 温故知新 熟能生巧 持之以恒 专心致志 目不转睛 心平气和 从容不迫 井然有序 有条不紊 恰到好处 一目了然 豁然开朗 焕然一新 生机勃勃 欣欣向荣 开门见山 柳暗花明 一往无前 自由自在 津津有味 念念不忘 记忆犹新 历历在目 融会贯通 举一反三 见微知著 水到渠成'.split(' ')
};
export const ENGLISH = {
  easy: 'sun moon star sky sea rain wind tree leaf bird fish cat dog book pen home warm cool kind calm soft slow fast time day blue gold hope love play read look walk jump sing live grow seed snow wave lake hill sand road hand mind rest open'.split(' '),
  standard: 'garden forest ocean river cloud flower bright gentle silent steady clear focus rhythm moment wonder simple travel listen spring summer autumn winter memory dream learn create notice follow gather stream breeze morning evening balance curious explore imagine patient journey light peace quiet breathe window'.split(' ').filter(w => w.length >= 5 && w.length <= 7),
  challenge: 'attention practice peaceful discovery learning creative sunshine mountain together distance question progress language remember gratitude graceful tomorrow universe familiar thoughtful adventure confident patience strength movement continue imagine carefully beautiful landscape direction curiosity'.split(' ').filter(w => w.length >= 8)
};
export const LABELS = { mixed: '混合', numbers: '数字', chinese: '中文', english: '英文', custom: '自定义' };
export const LENGTHS = { easy: 2, standard: 4, challenge: 6 };

export function parseCustom(text) {
  return [...new Set(String(text).split(/[\n\r,，;；]+/).map(w => w.trim()).filter(Boolean))];
}

export function validateCustom(text) {
  const words = parseCustom(text);
  if (words.length < 2) return '请至少输入 2 个不同的词，用换行或逗号分开。';
  if (words.length > 500) return '一次最多保存 500 个词，请删减后再试。';
  if (words.some(w => Array.from(w).length > 24)) return '每个词或短句最多 24 个字，请缩短后再试。';
  return '';
}

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createGenerator(settings, random = Math.random) {
  let last = '';
  let categoryBag = [];
  const wordBags = {};
  return () => {
    let category = settings.category;
    if (category === 'mixed') {
      if (!categoryBag.length) categoryBag = shuffle(['numbers', 'chinese', 'english'], random);
      category = categoryBag.pop();
    }
    let text;
    if (category === 'numbers') {
      const digits = LENGTHS[settings.difficulty];
      const min = 10 ** (digits - 1);
      let value = min + Math.floor(random() * min * 9);
      if (String(value) === last) value = min + ((value - min + 1) % (min * 9));
      text = String(value);
    } else {
      const pool = category === 'custom' ? parseCustom(settings.custom) :
        (category === 'chinese' ? CHINESE : ENGLISH)[settings.difficulty];
      if (!pool || pool.length < 2) throw new Error('词库至少需要两个不同的词');
      if (!wordBags[category]?.length) {
        wordBags[category] = shuffle(pool, random);
        const bag = wordBags[category];
        if (bag.at(-1) === last) [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
      }
      text = wordBags[category].pop();
    }
    last = text;
    return { text, category };
  };
}
