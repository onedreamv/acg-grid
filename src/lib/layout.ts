/**
 * Flickr 式 justified 布局：
 * - 用户设置行高为目标值，每行按行内卡片宽高比在 ±15% 容差内微调实际行高，使非末行精确填满容器宽；
 * - 末行不放大、从行首左对齐；
 * - 不压缩图片宽高比（卡片宽 = 行高 × 宽高比）。
 */

export interface LayoutInput {
  /** 每张卡片的宽高比 w/h（与卡片顺序一一对应） */
  aspects: number[];
  /** 容器宽度（逻辑像素） */
  containerWidth: number;
  /** 目标行高 */
  rowHeight: number;
  /** 卡片间距 */
  gap: number;
  /** 行高容差（构建期可调），默认 0.15 */
  tolerance?: number;
}

export interface PlacedCard {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutResult {
  items: PlacedCard[];
  /** 内容包围盒宽度（非末行铺满容器时即容器宽） */
  width: number;
  /** 内容包围盒高度（各行高 + 行间距） */
  height: number;
}

const EPS = 1e-6;

export function justifyLayout(input: LayoutInput): LayoutResult {
  const { aspects, containerWidth: W, rowHeight: H, gap } = input;
  const tolerance = input.tolerance ?? 0.15;
  const n = aspects.length;
  const items: PlacedCard[] = [];
  if (n === 0 || W <= 0) return { items, width: 0, height: 0 };

  // 前缀和加速行内宽高比求和
  const prefix: number[] = [0];
  for (let i = 0; i < n; i++) {
    prefix.push(prefix[i] + Math.max(EPS, aspects[i]));
  }

  let y = 0;
  let start = 0;
  let maxRowWidth = 0;

  while (start < n) {
    // 在所有可行的行划分点中，选择最接近目标行高的方案（优先落在 ±容差 内）
    let bestEnd = start + 1;
    let bestH = 0;
    let bestDev = Infinity;

    for (let end = start + 1; end <= n; end++) {
      const sumAspect = prefix[end] - prefix[start];
      const innerGap = gap * (end - start - 1);
      const h = (W - innerGap) / sumAspect;
      if (h <= 0 || !Number.isFinite(h)) break;
      const dev = Math.abs(h - H) / H;
      if (dev < bestDev - EPS || (Math.abs(dev - bestDev) <= EPS && end > bestEnd)) {
        bestDev = dev;
        bestEnd = end;
        bestH = h;
      }
      // 一旦超出容差且行高已低于下限，继续加卡片只会更矮，可提前结束
      if (h < H * (1 - tolerance) * 0.5) break;
    }

    const isLastRow = bestEnd >= n;
    let h = bestH;
    if (isLastRow) {
      // 末行不放大：行高按自然值但不越过目标行高
      h = Math.min(bestH, H);
    }

    // 非末行但极端超差（如单张超宽图占满一行）：钳制行高到容差边界，避免离谱
    if (!isLastRow && bestDev > tolerance) {
      h = Math.min(Math.max(bestH, H * (1 - tolerance)), H * (1 + tolerance));
    }

    let x = 0;
    for (let i = start; i < bestEnd; i++) {
      const w = aspects[i] * h;
      items.push({ index: i, x, y, w, h });
      x += w + gap;
      maxRowWidth = Math.max(maxRowWidth, x - gap);
    }
    y += h + gap;
    start = bestEnd;
  }

  return {
    items,
    width: Math.min(maxRowWidth, W),
    height: Math.max(0, y - gap),
  };
}
