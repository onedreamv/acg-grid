/** 卡片数量上限：所有产生卡片的路径（初始模板、add、本地上传多图）均受此约束 */
export const MAX_CARDS = 32;

/** 初次访问随机生成的占位卡数量 */
export const INIT_CARD_COUNT = 10;

/** 本地图片单文件大小上限（MB） */
export const LOCAL_IMAGE_MAX_MB = 20;

/** 对象类型八种预设 */
export const TYPE_PRESETS = [
  'Book',
  'Anime',
  'Music',
  'Game',
  'Real',
  'She',
  'He',
  'Character',
] as const;
export type TypePreset = (typeof TYPE_PRESETS)[number];

/** bangumi SubjectType 数字码 → 卡片对象类型 */
export const SUBJECT_TYPE_MAP: Record<number, TypePreset> = {
  1: 'Book',
  2: 'Anime',
  3: 'Music',
  4: 'Game',
  6: 'Real',
};

/** 预设类型徽章配色（文字统一深灰 #333） */
export const BADGE_COLORS: Record<TypePreset, string> = {
  Book: '#EAD8B7',
  Anime: '#66CCFF',
  Music: '#A8E6CF',
  Game: '#C9B6E4',
  Real: '#B8C9D4',
  She: '#FFB6C1',
  He: '#CC66FF',
  Character: '#FFD9A0',
};

/** 品牌色 */
export const BRAND_COLOR = '#66CCFF';

/** 态度预设 · 作品池（Book/Anime/Music/Game/Real） */
export const WORK_ATTITUDES = [
  '初见入宅',
  '最喜欢',
  '一见钟情',
  '想吐槽',
  '最长情',
  '剧情',
  '画面',
  '音乐',
  '最佳结局',
  '想安利',
  '被低估',
  '被高估',
  '期待续作',
  '意犹未尽',
  '我的回忆',
  '小众佳作',
];

/** 态度预设 · 角色池（She/He） */
export const CHARACTER_ATTITUDES = [
  '初见',
  'Waifu',
  '一见钟情',
  '最长情',
  '悲壮',
  '可怜即可爱',
  '可爱即正义',
  '天真无邪',
  '温柔',
  '天使',
  '萝莉',
];

/** 按对象类型过滤态度预设：She/He → 角色池；作品类 → 作品池；自定义与 Character → 全部 */
export function attitudesForType(type: string): string[] {
  if (type === 'She' || type === 'He') return CHARACTER_ATTITUDES;
  if (type === 'Book' || type === 'Anime' || type === 'Music' || type === 'Game' || type === 'Real') {
    return WORK_ATTITUDES;
  }
  return [...CHARACTER_ATTITUDES, ...WORK_ATTITUDES];
}

/** 角色性别解析（写死规则）：female→She、male→He，其余一律 Character */
export function genderToType(gender: string | null | undefined): TypePreset {
  if (gender === 'female') return 'She';
  if (gender === 'male') return 'He';
  return 'Character';
}

/** 判断类型是否为预设之一 */
export function isPresetType(type: string): type is TypePreset {
  return (TYPE_PRESETS as readonly string[]).includes(type);
}

export const DEFAULT_TITLE = 'My ACG Grid';

/** 应用统一字体栈（屏幕与 canvas 导出共用） */
export const FONT_STACK =
  "-apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif";
