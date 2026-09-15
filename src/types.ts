/** 卡片数据（IndexedDB 持久化的最小单元） */
export interface Card {
  id: string;
  /** 态度（预设预填或用户手填，可为空） */
  attitude: string;
  /** 对象名 */
  name: string;
  /** 对象类型：预设名（见 TYPE_PRESETS）或自定义文本；空串 = 未设置（不显示徽章） */
  type: string;
  /** 图片库引用；null = 占位卡（渐变玻璃块） */
  imageId: string | null;
  /** 宽高比 w/h；占位卡为创建时随机值，真实图片为其原始宽高比 */
  aspect: number;
  source: 'preset' | 'bangumi' | 'local' | 'manual';
  createdAt: number;
}

export interface CanvasSettings {
  /** 卡片行高 200–300px，默认 250 */
  rowHeight: number;
  /** 卡片间距 0–25px，默认 5 */
  gap: number;
  /** 元数据分离：元数据条追加在卡片下方，不遮挡模糊封面 */
  separatedMeta: boolean;
}

export const DEFAULT_SETTINGS: CanvasSettings = { rowHeight: 250, gap: 5, separatedMeta: true };

/** IndexedDB 图片库条目：原图 Blob（仅导出用）+ 缩略图 Blob（屏幕用） */
export interface StoredImage {
  id: string;
  original: Blob;
  thumb: Blob;
  width: number;
  height: number;
  createdAt: number;
}

/** 搜索候选条目（bangumi） */
export interface BangumiCandidate {
  id: number;
  kind: 'subject' | 'character';
  /** 已做三级回退的展示名 */
  name: string;
  /** 已归一化为 /img 相对路径的候选小图 */
  imageUrl: string | null;
  /** kind=subject 时的条目类型码（1/2/3/4/6） */
  subjectType?: number;
  /** kind=character 时的性别（'female' | 'male' | null | 其他） */
  gender?: string | null;
}

export type SearchType = 'Book' | 'Anime' | 'Music' | 'Game' | 'Real' | 'Character';

/** 本地图片选择结果（已入库） */
export interface LocalImagePick {
  imageId: string;
  aspect: number;
}
