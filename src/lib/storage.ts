import Dexie, { type Table } from 'dexie';
import type { CanvasSettings, Card, StoredImage } from '../types';

/**
 * IndexedDB 持久化（Dexie 封装，schema 带版本号）。
 * - 卡片数据 / 画布设置 / 标题 → 布局与状态
 * - 图片二进制（原图 + 缩略图 Blob）→ images 表
 * 应用永不主动清空缓存；清除入口仅 reset 与浏览器侧手动清除。
 * IndexedDB 不可用（如极端隐私环境）时回退内存模式：功能完整，仅不持久。
 */

interface MetaRow {
  key: string;
  value: unknown;
}

class AcgGridDB extends Dexie {
  cards!: Table<Card, string>;
  images!: Table<StoredImage, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('acg-grid');
    this.version(1).stores({
      cards: 'id, createdAt',
      images: 'id',
      meta: 'key',
    });
  }
}

export interface Storage {
  readonly persistent: boolean;
  loadCards(): Promise<Card[]>;
  saveCards(cards: Card[]): Promise<void>;
  loadSettings(): Promise<CanvasSettings | null>;
  saveSettings(s: CanvasSettings): Promise<void>;
  loadTitle(): Promise<string | null>;
  saveTitle(t: string): Promise<void>;
  putImage(img: StoredImage): Promise<void>;
  getImage(id: string): Promise<StoredImage | null>;
  deleteImage(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

class DexieStorage implements Storage {
  readonly persistent = true;
  private db: AcgGridDB;

  constructor() {
    this.db = new AcgGridDB();
  }

  async open(): Promise<void> {
    await this.db.open();
  }

  async loadCards(): Promise<Card[]> {
    return this.db.cards.orderBy('createdAt').toArray();
  }

  async saveCards(cards: Card[]): Promise<void> {
    await this.db.transaction('rw', this.db.cards, async () => {
      await this.db.cards.clear();
      if (cards.length) await this.db.cards.bulkPut(cards);
    });
  }

  async loadSettings(): Promise<CanvasSettings | null> {
    const row = await this.db.meta.get('settings');
    return (row?.value as CanvasSettings | undefined) ?? null;
  }

  async saveSettings(s: CanvasSettings): Promise<void> {
    await this.db.meta.put({ key: 'settings', value: s });
  }

  async loadTitle(): Promise<string | null> {
    const row = await this.db.meta.get('title');
    return (row?.value as string | undefined) ?? null;
  }

  async saveTitle(t: string): Promise<void> {
    await this.db.meta.put({ key: 'title', value: t });
  }

  async putImage(img: StoredImage): Promise<void> {
    await this.db.images.put(img);
  }

  async getImage(id: string): Promise<StoredImage | null> {
    return (await this.db.images.get(id)) ?? null;
  }

  async deleteImage(id: string): Promise<void> {
    await this.db.images.delete(id);
  }

  async clearAll(): Promise<void> {
    await this.db.transaction('rw', this.db.cards, this.db.images, this.db.meta, async () => {
      await this.db.cards.clear();
      await this.db.images.clear();
      await this.db.meta.clear();
    });
  }
}

class MemoryStorage implements Storage {
  readonly persistent = false;
  private cards: Card[] = [];
  private images = new Map<string, StoredImage>();
  private meta = new Map<string, unknown>();

  async loadCards() {
    return [...this.cards];
  }
  async saveCards(cards: Card[]) {
    this.cards = [...cards];
  }
  async loadSettings() {
    return (this.meta.get('settings') as CanvasSettings | undefined) ?? null;
  }
  async saveSettings(s: CanvasSettings) {
    this.meta.set('settings', { ...s });
  }
  async loadTitle() {
    return (this.meta.get('title') as string | undefined) ?? null;
  }
  async saveTitle(t: string) {
    this.meta.set('title', t);
  }
  async putImage(img: StoredImage) {
    this.images.set(img.id, img);
  }
  async getImage(id: string) {
    return this.images.get(id) ?? null;
  }
  async deleteImage(id: string) {
    this.images.delete(id);
  }
  async clearAll() {
    this.cards = [];
    this.images.clear();
    this.meta.clear();
  }
}

let instance: Storage | null = null;

/** 打开存储；失败时静默降级为内存模式（返回后 persistent 标识是否真正落库） */
export async function openStorage(): Promise<Storage> {
  if (instance) return instance;
  try {
    const dexie = new DexieStorage();
    await dexie.open();
    instance = dexie;
  } catch {
    instance = new MemoryStorage();
  }
  return instance;
}

/** 申请持久化存储（授权后磁盘压力下也不逐出），失败静默 */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* 忽略 */
  }
}
