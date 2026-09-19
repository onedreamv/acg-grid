import { BADGE_COLORS, FONT_STACK, isPresetType } from '../constants';

/**
 * 元数据叠加层与类型徽章的设计参数——一份规格两处消费：
 * 屏幕端（CSS/内联 SVG）与 canvas 导出（原生重绘）均从本模块取值。
 */

export interface MetaMetrics {
  /** 缩放系数（行高/250） */
  s: number;
  /** 态度字号（最大） */
  attitudeFS: number;
  /** 对象名字号（最小） */
  nameFS: number;
  /** 徽章高 */
  badgeH: number;
  /** 徽章字号 */
  badgeFS: number;
  /** 水平内边距 */
  padX: number;
  /** 首行与次行间距 */
  lineGap: number;
  /** 叠加层上内边距 */
  padTop: number;
  /** 叠加层下内边距 */
  padBottom: number;
  /** 通栏模式：亚克力实心区高度（两行 + 内边距） */
  metaH: number;
  /** 向上渐隐过渡带（≤16px） */
  fadeH: number;
  /** 胶囊模式：距底边距离 */
  capsuleBottom: number;
  /** 胶囊模式：文本块与徽章间隙 */
  innerGap: number;
  /** 胶囊模式：胶囊两侧距卡片边缘的留白 */
  edgeMargin: number;
}

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v));

export function metaMetrics(cardH: number): MetaMetrics {
  const s = cardH / 250;
  const attitudeFS = clamp(10, 17 * s, 30);
  const nameFS = clamp(8, 12.5 * s, 22);
  const badgeH = clamp(14, 21 * s, 38);
  const badgeFS = badgeH / 1.65;
  const padX = clamp(8, 12 * s, 22);
  const lineGap = clamp(1.5, 3.5 * s, 7);
  const padTop = clamp(6, 9 * s, 16);
  const padBottom = clamp(7, 11.5 * s, 20);
  const metaH = padTop + attitudeFS * 1.22 + lineGap + nameFS * 1.3 + padBottom;
  return {
    s,
    attitudeFS,
    nameFS,
    badgeH,
    badgeFS,
    padX,
    lineGap,
    padTop,
    padBottom,
    metaH,
    fadeH: clamp(6, 12 * s, 16),
    capsuleBottom: clamp(6, 12 * s, 20),
    innerGap: clamp(4, 9 * s, 16),
    edgeMargin: clamp(8, 14 * s, 24),
  };
}

/** 元数据层形态：ratio = w/h，< 1.5 通栏贴底，≥ 1.5 居中胶囊 */
export function overlayMode(w: number, h: number): 'full' | 'capsule' {
  return w / h < 1.5 ? 'full' : 'capsule';
}

/**
 * 卡片最小宽高比（w/h）：分离模式元数据条需容纳「4 字态度 + 左右内边距 + 徽章间隙 +
 * 最宽常用预设徽章(Anime)」，元数据度量全部线性于 rowHeight/250，所需比例与行高无关
 * （≈ 0.616），取 0.65 留余量；不得越过 2:3（0.667），否则正常竖图卡会被垫宽留白。
 * 极端窄图（如 1:3 数轴）布局时垫宽至此比例，封面 contain 居中、两侧留白。
 * 注：Character 等超长徽章仍可能与 4 字态度轻微重叠——与屏幕端溢出表现一致（所见即所得）。
 */
export const MIN_CARD_ASPECT = 0.65;

/** 布局用有效宽高比：极端窄图垫宽到 MIN_CARD_ASPECT（card.aspect 数据保持原图比例） */
export function effectiveAspect(aspect: number): number {
  return Math.max(aspect, MIN_CARD_ASPECT);
}

/** 封面留白背景色（极端窄图 contain 居中时露出）；与 global.css .card-cover img 的 background 同步维护 */
export const LETTERBOX_BG = '#f2f5f9';

export interface BadgeSpec {
  width: number;
  height: number;
  radius: number;
  fontSize: number;
  bg: string;
  /** 显示文字（预设首字母大写，自定义原样） */
  label: string;
  preset: boolean;
}

let measureCtx: CanvasRenderingContext2D | null = null;
const measureCache = new Map<string, number>();

function textWidth(text: string, fontSize: number, weight = 600): number {
  const key = `${weight}|${Math.round(fontSize * 10)}|${text}`;
  const cached = measureCache.get(key);
  if (cached !== undefined) return cached;
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
    if (!measureCtx) return text.length * fontSize * 0.6;
  }
  measureCtx.font = `${weight} ${fontSize}px ${FONT_STACK}`;
  const w = measureCtx.measureText(text).width;
  measureCache.set(key, w);
  return w;
}

/** 徽章规格：圆角胶囊、首字母大写单词水平垂直居中；宽度随文字自适应 */
export function badgeSpec(type: string, m: MetaMetrics): BadgeSpec | null {
  if (!type) return null;
  const preset = isPresetType(type);
  const label = preset ? type.charAt(0).toUpperCase() + type.slice(1) : type;
  const padX = m.badgeFS * 0.62;
  const width = Math.max(m.badgeH * 0.9, textWidth(label, m.badgeFS) + padX * 2);
  return {
    width,
    height: m.badgeH,
    radius: m.badgeH / 2,
    fontSize: m.badgeFS,
    bg: preset ? BADGE_COLORS[type] : 'rgba(255, 255, 255, 0.62)',
    label,
    preset,
  };
}

/** 按徽章高度直接取规格（独立于整卡 metrics 的使用场景） */
export function badgeSpecForHeight(type: string, badgeH: number): BadgeSpec | null {
  const m = metaMetrics(250);
  m.badgeH = badgeH;
  m.badgeFS = badgeH / 1.65;
  return badgeSpec(type, m);
}

export { textWidth };
