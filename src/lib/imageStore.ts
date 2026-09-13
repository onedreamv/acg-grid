import type { StoredImage } from '../types';
import type { Storage } from './storage';
import { genId } from './id';

/**
 * 运行时图片库：
 * - 入库：解码原图 → 生成缩略图（最长边 1000px）→ 原图 + 缩略图 Blob 一起入库；
 * - 屏幕渲染一律用缩略图 objectURL（带缓存）；原图仅在导出时逐卡解码；
 * - 本地上传以原始 Blob 入库；bangumi 封面经 /img 代理抓取为 Blob 入库。
 */

const THUMB_MAX_SIDE = 1000;

export interface PutResult {
  imageId: string;
  width: number;
  height: number;
}

async function decode(blob: Blob): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

async function makeThumbBlob(bitmap: ImageBitmap, sourceType: string): Promise<Blob> {
  const scale = Math.min(1, THUMB_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('thumbnail canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  // 带透明可能的源（png/gif）保留 png，其余用 jpeg 控制体积
  const type = sourceType === 'image/png' || sourceType === 'image/gif' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) throw new Error('thumbnail encode failed');
  return blob;
}

export class ImageStore {
  private storage: Storage;
  /** id → 缩略图 objectURL（应用生命周期内缓存，reset 时统一回收） */
  private urlCache = new Map<string, string>();

  constructor(storage: Storage) {
    this.storage = storage;
  }

  /** 解码并入库，返回图片引用与原始宽高 */
  async put(blob: Blob): Promise<PutResult> {
    const { bitmap, width, height } = await decode(blob);
    try {
      const thumb = await makeThumbBlob(bitmap, blob.type || 'image/jpeg');
      const image: StoredImage = {
        id: genId('img'),
        original: blob,
        thumb,
        width,
        height,
        createdAt: Date.now(),
      };
      await this.storage.putImage(image);
      return { imageId: image.id, width, height };
    } finally {
      bitmap.close();
    }
  }

  /** 取缩略图 objectURL（缓存；无此图返回 null） */
  async thumbURL(id: string): Promise<string | null> {
    const cached = this.urlCache.get(id);
    if (cached) return cached;
    const img = await this.storage.getImage(id);
    if (!img) return null;
    const url = URL.createObjectURL(img.thumb);
    this.urlCache.set(id, url);
    return url;
  }

  /** 取原图 Blob（仅导出使用） */
  async originalBlob(id: string): Promise<Blob | null> {
    const img = await this.storage.getImage(id);
    return img?.original ?? null;
  }

  async delete(id: string): Promise<void> {
    const url = this.urlCache.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this.urlCache.delete(id);
    }
    await this.storage.deleteImage(id);
  }

  /** reset：回收全部 objectURL 缓存（Blob 已由 clearAll 清库） */
  clearRuntime(): void {
    for (const url of this.urlCache.values()) URL.revokeObjectURL(url);
    this.urlCache.clear();
  }
}
