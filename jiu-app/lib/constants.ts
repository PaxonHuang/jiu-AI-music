export interface Bird {
  id: number;
  name: string;
  englishName: string;
  category: 'cute' | 'abstract' | 'mystery';
  description: string;
  feature: string;
  sound: string;
  habitat: string;
  habit: string;
  avatar: string;
  avatarGray: string;
  atlasPosition: { column: number; row: number };
  fragmentType: FragmentType | '';
  fragmentNeeded: number;
  birdCall: string;
}

export const BIRDS: Bird[] = [
  {
    id: 1,
    name: '北长尾山雀',
    englishName: 'Long-tailed Tit',
    category: 'cute',
    description: '嗨！我是你的第一位音乐伙伴！我会一直陪着你的～',
    feature: '全身雪白蓬松，像会飞的棉花球，尾巴却比身体还要长。',
    sound: '叫声轻快细碎，像一群朋友在说悄悄话。',
    habitat: '欧洲和亚洲的温带树林，从英国到日本都能找到它们。',
    habit: '喜欢二三十只一起行动，永远热热闹闹。',
    avatar: '/birds/tit.svg',
    avatarGray: '/birds/tit-gray.svg',
    atlasPosition: { column: 0, row: 0 },
    fragmentType: '',
    fragmentNeeded: 0,
    birdCall: '/audio/tit-call.wav',
  },
  {
    id: 2,
    name: '花彩雀莺',
    englishName: 'White-browed Tit-warbler',
    category: 'cute',
    description: '哇，你已经开始认真练习了！我等你很久了，我们一起唱歌吧！',
    feature: '紫粉色和蓝色的羽毛像被彩虹轻轻染过。',
    sound: '声音轻柔婉转，细细的，像在唱摇篮曲。',
    habitat: '生活在喜马拉雅山脉一带的高山灌木丛。',
    habit: '爱在低矮的灌木枝头跳来跳去，动作像羽毛一样轻盈。',
    avatar: '/birds/penduline.svg',
    avatarGray: '/birds/penduline-gray.svg',
    atlasPosition: { column: 1, row: 0 },
    fragmentType: '绒羽',
    fragmentNeeded: 10,
    birdCall: '/audio/penduline-call.wav',
  },
  {
    id: 5,
    name: '红颊蓝饰雀',
    englishName: 'Red-cheeked Cordon-bleu',
    category: 'cute',
    description: '哈哈，你的脸颊是不是也跟我一样红了？因为你太厉害啦！',
    feature: '天蓝色羽毛配上红红的脸颊，像认真涂过腮红。',
    sound: '叫声清脆短促，听起来充满活力。',
    habitat: '生活在非洲较干燥的草地、灌木和村庄附近。',
    habit: '性格活泼，喜欢成对或结成小群在草地里蹦跳。',
    avatar: '/birds/penduline.svg',
    avatarGray: '/birds/penduline-gray.svg',
    atlasPosition: { column: 2, row: 0 },
    fragmentType: '绒羽',
    fragmentNeeded: 10,
    birdCall: '',
  },
  {
    id: 3,
    name: '冠小海雀',
    englishName: 'Crested Auklet',
    category: 'abstract',
    description: '汪！——对，你没听错，就是汪！我就是那只会叫汪的鸟！',
    feature: '圆滚滚的黑色身体，额头前还有一簇向前弯曲的羽冠。',
    sound: '声音很像小狗“汪汪”叫，第一次听见的人都会愣住。',
    habitat: '生活在阿留申群岛和白令海一带的寒冷海域。',
    habit: '潜水技术高超，会在冰冷海水里灵活追捕小鱼。',
    avatar: '/birds/auklet.svg',
    avatarGray: '/birds/auklet-gray.svg',
    atlasPosition: { column: 0, row: 1 },
    fragmentType: '怪羽',
    fragmentNeeded: 8,
    birdCall: '/audio/auklet-call.wav',
  },
  {
    id: 6,
    name: '穴小鸮',
    englishName: 'Burrowing Owl',
    category: 'abstract',
    description: '咯咯咯——我在洞里等你好久了！你的坚持让我笑出声啦！',
    feature: '这只迷你猫头鹰有一双出奇修长的腿，像踩着高跷。',
    sound: '会发出咯咯的叫声，紧张时还会不停地点头。',
    habitat: '广泛生活在北美洲和南美洲的开阔草原。',
    habit: '白天也会活动，住在地洞里，有时还会认真装饰自己的家。',
    avatar: '/birds/auklet.svg',
    avatarGray: '/birds/auklet-gray.svg',
    atlasPosition: { column: 1, row: 1 },
    fragmentType: '怪羽',
    fragmentNeeded: 15,
    birdCall: '',
  },
  {
    id: 7,
    name: '仓鸮',
    englishName: 'Barn Owl',
    category: 'abstract',
    description: '嘘——我悄悄地来了。你以为我不在，但我一直看着你进步。',
    feature: '心形白色脸盘和深色眼睛，像戴着一张神秘面具。',
    sound: '飞行时几乎没有声音，叫声却像一声长长的尖叫。',
    habitat: '除南极洲以外，世界许多农田、草原和谷仓里都有它们。',
    habit: '常在夜晚独自出猎，悄无声息地寻找小型猎物。',
    avatar: '/birds/auklet.svg',
    avatarGray: '/birds/auklet-gray.svg',
    atlasPosition: { column: 2, row: 1 },
    fragmentType: '怪羽',
    fragmentNeeded: 25,
    birdCall: '',
  },
  {
    id: 4,
    name: '蛇鹫',
    englishName: 'Secretarybird',
    category: 'mystery',
    description: '我踢飞过无数条蛇，但你的努力才最让我刮目相看。',
    feature: '修长双腿配上脑后一排黑色羽冠，走路像优雅的模特。',
    sound: '叫声低沉有力，在草原上可以传得很远。',
    habitat: '生活在非洲撒哈拉以南的开阔草原。',
    habit: '是著名的捕蛇高手，会用强有力的长腿踢击猎物。',
    avatar: '/birds/secretary.svg',
    avatarGray: '/birds/secretary-gray.svg',
    atlasPosition: { column: 0, row: 2 },
    fragmentType: '暗羽',
    fragmentNeeded: 6,
    birdCall: '/audio/secretary-call.wav',
  },
  {
    id: 8,
    name: '黑翅鸢',
    englishName: 'Black-winged Kite',
    category: 'mystery',
    description: '我在高空见过很多孩子，但能坚持到这里的真的不多。你不一样。',
    feature: '雪白身体、黑色肩羽和深红眼睛，让它看起来格外锐利。',
    sound: '叫声尖锐悠长，在空旷的地方可以传出很远。',
    habitat: '生活在非洲、亚洲南部和欧洲南部等地的农田与草原。',
    habit: '最擅长像直升机一样悬停在空中，再突然俯冲捕捉猎物。',
    avatar: '/birds/secretary.svg',
    avatarGray: '/birds/secretary-gray.svg',
    atlasPosition: { column: 1, row: 2 },
    fragmentType: '暗羽',
    fragmentNeeded: 15,
    birdCall: '',
  },
  {
    id: 9,
    name: '三趾翠鸟',
    englishName: 'Black-backed Dwarf Kingfisher',
    category: 'mystery',
    description: '……你真的来了。把这个只属于耐心探索者的秘密好好珍藏吧。',
    feature: '蓝、橙、红交织在小小的身体上，像森林里飞舞的宝石。',
    sound: '叫声清脆如银铃，但大多数时候安静得像一个秘密。',
    habitat: '藏在东南亚和南亚热带雨林的溪流附近。',
    habit: '行动极为敏捷，很少在同一个地方停留超过几秒。',
    avatar: '/birds/secretary.svg',
    avatarGray: '/birds/secretary-gray.svg',
    atlasPosition: { column: 2, row: 2 },
    fragmentType: '暗羽',
    fragmentNeeded: 30,
    birdCall: '',
  },
];

export const FRAGMENT_TYPES = ['绒羽', '怪羽', '暗羽'] as const;
export type FragmentType = (typeof FRAGMENT_TYPES)[number];

export const STYLES = [
  { id: 'happy', label: '😊 欢快', color: '#FF9F43' },
  { id: 'quiet', label: '🌙 安静', color: '#52715E' },
  { id: 'dreamy', label: '✨ 梦幻', color: '#A29BFE' },
] as const;

export type AcademyGameKey =
  | 'sound-elevator'
  | 'sound-relay'
  | 'sound-balance'
  | 'heartbeat-drummer'
  | 'note-race'
  | 'rhythm-puzzle'
  | 'note-town'
  | 'pitch-tower'
  | 'note-home';

export interface AcademyLevel {
  id: number;
  order: number;
  stageId: 1 | 2 | 3;
  lesson: 1 | 2 | 3;
  stageName: string;
  name: string;
  icon: string;
  subtitle: string;
  zone: string;
  companionTip: string;
  game: AcademyGameKey;
  rewardType: FragmentType;
  position: { x: number; y: number };
}

export const ACADEMY_STAGES = [
  { id: 1, name: '听的世界', subtitle: '发现声音的高低、长短和强弱', icon: '👂' },
  { id: 2, name: '节奏魔法', subtitle: '用身体感受音乐的心跳', icon: '🥁' },
  { id: 3, name: '旋律星图', subtitle: '唱出音符，找到它们的家', icon: '✨' },
] as const;

// Existing level IDs 1/2/3 are intentionally preserved so saved progress
// continues to point at the same games. `order` controls the learning path.
export const LEVELS: AcademyLevel[] = [
  {
    id: 1,
    order: 1,
    stageId: 1,
    lesson: 1,
    stageName: '听的世界',
    name: '声音电梯',
    icon: '🎶',
    subtitle: '听见声音的高与低',
    zone: '田野启程',
    companionTip: '听，声音也是会坐电梯的哦！有的往上走，有的往下走。',
    game: 'sound-elevator',
    rewardType: '绒羽',
    position: { x: 30, y: 90 },
  },
  {
    id: 4,
    order: 2,
    stageId: 1,
    lesson: 2,
    stageName: '听的世界',
    name: '声音接力',
    icon: '💧',
    subtitle: '感受声音的长与短',
    zone: '溪流小径',
    companionTip: '有的声音像小溪一样长长的，有的像水滴一样短短的。',
    game: 'sound-relay',
    rewardType: '绒羽',
    position: { x: 68, y: 81 },
  },
  {
    id: 5,
    order: 3,
    stageId: 1,
    lesson: 3,
    stageName: '听的世界',
    name: '声音天平',
    icon: '⚖️',
    subtitle: '分辨声音的强与弱',
    zone: '向日葵田',
    companionTip: '声音有时像大象踩地一样重，有时像小猫走路一样轻。',
    game: 'sound-balance',
    rewardType: '绒羽',
    position: { x: 31, y: 72 },
  },
  {
    id: 2,
    order: 4,
    stageId: 2,
    lesson: 1,
    stageName: '节奏魔法',
    name: '心跳鼓手',
    icon: '🥁',
    subtitle: '跟着节拍翻过山坡',
    zone: '风车山坡',
    companionTip: '把手放在胸口，音乐也有像心跳一样稳定的拍子。',
    game: 'heartbeat-drummer',
    rewardType: '怪羽',
    position: { x: 69, y: 61 },
  },
  {
    id: 6,
    order: 5,
    stageId: 2,
    lesson: 2,
    stageName: '节奏魔法',
    name: '音符赛跑',
    icon: '🏃',
    subtitle: '认识走路拍和跑步拍',
    zone: '节拍跑道',
    companionTip: '四分音符像走路，八分音符像小跑，两步当一步。',
    game: 'note-race',
    rewardType: '怪羽',
    position: { x: 31, y: 52 },
  },
  {
    id: 7,
    order: 6,
    stageId: 2,
    lesson: 3,
    stageName: '节奏魔法',
    name: '节奏拼图',
    icon: '🧩',
    subtitle: '把音符拼成完整节奏',
    zone: '木桥工坊',
    companionTip: '把不同长度的木板拼在一起，就能搭出一座节奏桥啦！',
    game: 'rhythm-puzzle',
    rewardType: '怪羽',
    position: { x: 69, y: 43 },
  },
  {
    id: 3,
    order: 7,
    stageId: 3,
    lesson: 1,
    stageName: '旋律星图',
    name: '音符小镇',
    icon: '🎵',
    subtitle: '在森林里唱出 Do Re Mi',
    zone: '山林乐园',
    companionTip: '每一个音符都有自己的颜色和性格，我们来认识它们吧。',
    game: 'note-town',
    rewardType: '暗羽',
    position: { x: 31, y: 32 },
  },
  {
    id: 8,
    order: 8,
    stageId: 3,
    lesson: 2,
    stageName: '旋律星图',
    name: '音准爬塔',
    icon: '🗼',
    subtitle: '唱准音符向上攀登',
    zone: '云端高塔',
    companionTip: '只要唱得准，小人就能爬得高！慢慢唱，不着急。',
    game: 'pitch-tower',
    rewardType: '暗羽',
    position: { x: 69, y: 23 },
  },
  {
    id: 9,
    order: 9,
    stageId: 3,
    lesson: 3,
    stageName: '旋律星图',
    name: '音符找家',
    icon: '🏠',
    subtitle: '认识音符在五线谱的位置',
    zone: '星光树屋',
    companionTip: '五线谱像一栋五层楼，每个音符都有自己固定的房间。',
    game: 'note-home',
    rewardType: '暗羽',
    position: { x: 31, y: 14 },
  },
];

export const CATEGORY_LABELS: Record<string, string> = {
  cute: '小可爱',
  abstract: '抽象大师',
  mystery: '神秘来客',
};
