import type { CanvasSettings, Card } from '../types';
import { FONT_STACK } from '../constants';
import { justifyLayout, type LayoutResult } from './layout';
import { badgeSpec, metaMetrics, overlayMode, textWidth, type BadgeSpec } from './metrics';
import { buildExportFilename } from './filename';

/**
 * 自定义 canvas 导出渲染器：
 * - 不采用 html2canvas / foreignObject（亚克力渲染不可靠），按屏幕同一份设计参数原生重绘；
 * - 封面取库内原图，逐卡解码、绘制后立即释放；
 * - 亚克力模糊用 ctx.filter（目标平台 Chrome）；Safari 无 ctx.filter 时走无模糊高不透明回退；
 * - 倍率 2x → 1x → 0.5x 阶梯降级，分配失败靠「分配即探针」检测（超限 canvas 分配是静默失败）。
 */

export interface ExportCardSource {
  card: Card;
  /** 库内原图 Blob（占位卡为 null） */
  original: Blob | null;
}

export interface ExportInput {
  cards: Card[];
  sources: Map<string, Blob | null>;
  settings: CanvasSettings;
  title: string;
  /** 屏幕端画布容器宽度（导出与屏幕同一布局输入） */
  containerWidth: number;
  /** 降档时回调（用于 toast 告知），参数为尝试倍率 */
  onScaleAttempt?: (scale: number) => void;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  scale: number;
}

const MARGIN = 24; // 内容包围盒四边留白（逻辑像素）
const TITLE_FONT = 34;
const TITLE_BLOCK_H = 48; // 标题行高
const TITLE_GAP = 14; // 标题与卡墙间距

const MAX_SIDE = 16384;
const MAX_AREA = 16384 * 16384;
const MIN_BLOB_BYTES = 2048; // 过小视为可疑白图

function supportsCtxFilter(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    return !!ctx && typeof ctx.filter === 'string';
  } catch {
    return false;
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/** 单行文本绘制，超宽时截断加省略号，返回实际绘制文字 */
function drawTruncated(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
): string {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return text;
  }
  let t = text;
  while (t.length > 1) {
    t = t.slice(0, -1);
    const candidate = `${t}…`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      ctx.fillText(candidate, x, y);
      return candidate;
    }
  }
  return '';
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  spec: BadgeSpec,
  cx: number,
  cy: number,
  scale: number,
): void {
  const px = (v: number) => v * scale;
  const x = px(cx - spec.width / 2);
  const y = px(cy - spec.height / 2);
  roundRectPath(ctx, x, y, px(spec.width), px(spec.height), px(spec.radius));
  ctx.fillStyle = spec.bg;
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.font = `600 ${px(spec.fontSize)}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.label, px(cx), px(cy) + spec.fontSize * scale * 0.03);
}

interface Geometry {
  layout: LayoutResult;
  offsetX: number; // 包围盒内卡墙起点（MARGIN）
  offsetY: number; // 包围盒内卡墙起点（MARGIN + 标题区）
  wallX: number;
  wallY: number;
  width: number; // 画布逻辑宽
  height: number; // 画布逻辑高
}

function computeGeometry(input: ExportInput): Geometry {
  const aspects = input.cards.map((c) => c.aspect);
  const layout = justifyLayout({
    aspects,
    containerWidth: input.containerWidth,
    rowHeight: input.settings.rowHeight,
    gap: input.settings.gap,
  });
  const width = layout.width + MARGIN * 2;
  const height = MARGIN + TITLE_BLOCK_H + TITLE_GAP + layout.height + MARGIN;
  return {
    layout,
    offsetX: MARGIN,
    offsetY: MARGIN + TITLE_BLOCK_H + TITLE_GAP,
    wallX: MARGIN,
    wallY: MARGIN + TITLE_BLOCK_H + TITLE_GAP,
    width,
    height,
  };
}

interface AttemptContext {
  ctx: CanvasRenderingContext2D;
  scale: number;
  blurEnabled: boolean;
}

/**
 * 绘制单张卡片的亚克力元数据层（模糊 + 白色渐变 + 文本 + 徽章）。
 * x/y/w/h 为逻辑坐标；绘制时统一乘 scale（不用 ctx 变换，确保 blur 半径不受变换歧义影响）。
 */
function drawMetaOverlay(
  ac: AttemptContext,
  bitmap: ImageBitmap | HTMLImageElement | null,
  card: Card,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const { ctx, scale, blurEnabled } = ac;
  const px = (v: number) => v * scale;
  const m = metaMetrics(h);
  const mode = overlayMode(w, h);
  const badge = badgeSpec(card.type, m);

  const line1H = m.attitudeFS * 1.22;
  const line2H = m.nameFS * 1.3;

  // 区域与文本布局参数（逻辑坐标）
  let regionX: number, regionY: number, regionW: number, regionH: number, radius: number;
  let textX: number;
  let line1CY: number; // 态度行中心
  let line2CY: number; // 名字行中心
  let attitudeMaxW: number;
  let nameMaxW: number;
  let badgeCX: number;
  let badgeCY: number;

  if (mode === 'full') {
    regionW = w;
    regionH = m.metaH + m.fadeH;
    regionX = x;
    regionY = y + h - regionH;
    radius = Math.min(16, w * 0.05, h * 0.05);
    textX = x + m.padX;
    line1CY = y + h - m.metaH + m.padTop + m.attitudeFS * 0.61;
    line2CY = line1CY + line1H - m.attitudeFS * 0.61 + m.lineGap + m.nameFS * 0.65;
    // 态度永不截断（给全宽）；名字可截断（避让徽章列）
    attitudeMaxW = w - m.padX * 2;
    nameMaxW = w - m.padX * 2 - (badge ? badge.width + m.innerGap : 0);
    badgeCX = badge ? x + w - badge.width / 2 - m.padX * 0.7 : 0;
    badgeCY = y + h - m.metaH / 2;
  } else {
    const textW0 = Math.max(
      textWidth(card.attitude, m.attitudeFS, 700) + 2,
      Math.min(textWidth(card.name, m.nameFS), w - m.edgeMargin * 2 - m.padX * 2 - (badge ? badge.width + m.innerGap : 0)),
    );
    const capW = Math.min(
      w - m.edgeMargin * 2,
      m.padX * 2 + textW0 + (badge ? m.innerGap + badge.width : 0),
    );
    const capH = m.padTop + line1H + m.lineGap + line2H + m.padBottom;
    regionW = capW;
    regionH = capH;
    regionX = x + (w - capW) / 2;
    regionY = y + h - capH - m.capsuleBottom;
    radius = capH / 2;
    textX = regionX + m.padX;
    line1CY = regionY + m.padTop + m.attitudeFS * 0.61;
    line2CY = line1CY + line1H - m.attitudeFS * 0.61 + m.lineGap + m.nameFS * 0.65;
    attitudeMaxW = capW - m.padX * 2 - (badge ? badge.width + m.innerGap : 0);
    nameMaxW = attitudeMaxW;
    badgeCX = badge ? regionX + capW - m.padX - badge.width / 2 : 0;
    badgeCY = line1CY;
  }

  ctx.save();
  roundRectPath(ctx, px(regionX), px(regionY), px(regionW), px(regionH), px(radius));
  ctx.clip();

  // 亚克力：模糊取样自整张封面（overscan 防止边缘透入透明区）
  if (bitmap && blurEnabled) {
    const blur = Math.max(4, 9 * m.s); // 逻辑模糊半径
    const overscan = blur * 2;
    ctx.filter = `blur(${blur * scale}px)`;
    ctx.drawImage(
      bitmap,
      px(x - overscan),
      px(y - overscan),
      px(w + overscan * 2),
      px(h + overscan * 2),
    );
    ctx.filter = 'none';
  } else if (bitmap) {
    // 无 ctx.filter 回退：不模糊，靠下面更高不透明度铺底
    ctx.drawImage(bitmap, px(x), px(y), px(w), px(h));
  }

  // 白色渐变叠加（回退模式不透明度更高）
  const baseAlpha = blurEnabled ? 0.56 : 0.78;
  const grad = ctx.createLinearGradient(0, px(regionY), 0, px(regionY + regionH));
  if (mode === 'full') {
    const fadeStop = m.fadeH / regionH;
    grad.addColorStop(0, `rgba(255,255,255,0)`);
    grad.addColorStop(fadeStop, `rgba(255,255,255,${baseAlpha - 0.06})`);
    grad.addColorStop(1, `rgba(255,255,255,${baseAlpha})`);
  } else {
    grad.addColorStop(0, `rgba(255,255,255,${baseAlpha - 0.04})`);
    grad.addColorStop(1, `rgba(255,255,255,${baseAlpha + 0.06})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(px(regionX), px(regionY), px(regionW), px(regionH));
  ctx.restore();

  // 文本块：态度（大）在上、名字（小）在下，左对齐
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if (card.attitude) {
    ctx.fillStyle = '#2b2b33';
    ctx.font = `700 ${px(m.attitudeFS)}px ${FONT_STACK}`;
    drawTruncated(ctx, card.attitude, px(textX), px(line1CY), px(attitudeMaxW));
  }
  if (card.name) {
    ctx.fillStyle = '#55555f';
    ctx.font = `500 ${px(m.nameFS)}px ${FONT_STACK}`;
    drawTruncated(ctx, card.name, px(textX), px(line2CY), px(nameMaxW));
  }
  if (badge) {
    drawBadge(ctx, badge, badgeCX, badgeCY, scale);
  }
}

/** 尝试以指定倍率渲染整墙，返回 blob；任何一步失败返回 null（由外层降档重试） */
async function attemptRender(input: ExportInput, geo: Geometry, scale: number): Promise<Blob | null> {
  const W = geo.width * scale;
  const H = geo.height * scale;
  if (W > MAX_SIDE || H > MAX_SIDE || W * H > MAX_AREA) return null;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W);
  canvas.height = Math.round(H);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 分配即探针：填背景色后读回角像素，透明黑即分配失败（静默失败不抛异常）
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  try {
    const probe = ctx.getImageData(0, 0, 1, 1).data;
    if (probe[3] === 0) return null;
  } catch {
    return null;
  }

  const blurEnabled = supportsCtxFilter();
  const ac: AttemptContext = { ctx, scale, blurEnabled };

  // 标题（仅卡墙与标题，不含任何控件）
  if (input.title.trim()) {
    ctx.fillStyle = '#333';
    ctx.font = `700 ${TITLE_FONT * scale}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(input.title, geo.width / 2, MARGIN + TITLE_BLOCK_H / 2, geo.width - MARGIN * 2);
  }

  const cardRadius = (h: number) => Math.min(18, h * 0.06);
  const px = (v: number) => v * scale;

  for (const placed of geo.layout.items) {
    const card = input.cards[placed.index];
    if (!card) continue;
    const x = px(geo.wallX + placed.x);
    const y = px(geo.wallY + placed.y);
    const w = px(placed.w);
    const h = px(placed.h);
    const r = px(cardRadius(placed.h));

    const blob = card.imageId ? input.sources.get(card.imageId) ?? null : null;
    let bitmap: ImageBitmap | null = null;
    if (blob) {
      try {
        bitmap = await createImageBitmap(blob);
      } catch {
        bitmap = null; // 解码失败按占位处理
      }
    }

    // 封面（圆角裁剪；占位卡为渐变水蓝玻璃块）
    ctx.save();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.clip();
    if (bitmap) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, x, y, w, h);
    } else {
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, '#9fd4f2');
      grad.addColorStop(0.55, '#c9e6fb');
      grad.addColorStop(1, '#dceeff');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      // 玻璃高光（柔和渐变带）
      const gloss = ctx.createLinearGradient(x, y + h * 0.05, x, y + h * 0.42);
      gloss.addColorStop(0, 'rgba(255,255,255,0.34)');
      gloss.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gloss;
      ctx.fillRect(x, y, w, h * 0.45);
    }
    ctx.restore();

    // 卡片描边与投影感（细白描边统一观感）
    ctx.save();
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = Math.max(1, scale);
    ctx.stroke();
    ctx.restore();

    drawMetaOverlay(ac, bitmap, card, geo.wallX + placed.x, geo.wallY + placed.y, placed.w, placed.h);

    bitmap?.close();
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return null; // toBlob 非空校验
  if (blob.size < MIN_BLOB_BYTES) return null; // 过小视为可疑，宁可报错不给白图
  return blob;
}

export interface ExportWallDeps {
  /** 每次尝试倍率前的通知（逐级 toast） */
  onScaleAttempt?: (scale: number) => void;
  /** 全部倍率失败 */
  onFinalFailure?: () => void;
}

/** 导出整墙 PNG。倍率 2x → 1x → 0.5x 阶梯降级；0.5x 仍失败则诚实报错、不产出文件。 */
export async function exportWallPNG(
  input: ExportInput,
  deps: ExportWallDeps = {},
): Promise<ExportResult | null> {
  if (!input.cards.length) return null;
  const geo = computeGeometry(input);
  for (const scale of [2, 1, 0.5]) {
    deps.onScaleAttempt?.(scale);
    try {
      const blob = await attemptRender(input, geo, scale);
      if (blob) {
        return { blob, filename: buildExportFilename(input.title), scale };
      }
    } catch {
      // 单次尝试的意外异常同样进入降档
    }
  }
  deps.onFinalFailure?.();
  return null;
}
