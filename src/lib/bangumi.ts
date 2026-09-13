import type { BangumiCandidate, SearchType } from '../types';
import { SUBJECT_TYPE_MAP, genderToType } from '../constants';

/**
 * bangumi 搜索客户端。
 * 前端一律使用相对路径 /api、/img（开发走 Vite 代理，生产走 Worker 同域反代）。
 */

export type SearchErrorKind = 'service' | 'network';

export class SearchError extends Error {
  kind: SearchErrorKind;
  constructor(kind: SearchErrorKind) {
    super(kind === 'service' ? '搜索服务暂时不可用' : '网络请求失败');
    this.kind = kind;
  }
}

const REQUEST_TIMEOUT_MS = 15000;

const SUBJECT_TYPE_CODES: Record<Exclude<SearchType, 'Character'>, number> = {
  Book: 1,
  Anime: 2,
  Music: 3,
  Game: 4,
  Real: 6,
};

/** bangumi 返回的封面是绝对地址（多为 http://lain.bgm.tv/...），统一改写为 /img 相对路径 */
export function normalizeImageURL(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /^https?:\/\/lain\.bgm\.tv(\/.+)$/i.exec(url.trim());
  if (m) return `/img${m[1]}`;
  // 兼容无 scheme 或其他 bangumi 图片 host 的形态
  const bare = /^\/\/lain\.bgm\.tv(\/.+)$/i.exec(url.trim());
  if (bare) return `/img${bare[1]}`;
  return url.trim() || null;
}

interface InfoboxItem {
  key: string;
  value: string | Array<{ k?: string; v: string }>;
}

/** infobox 项取值：字符串，或 {k,v} 对象数组（取第一个非空 v） */
function infoboxValue(item: InfoboxItem | undefined): string | null {
  if (!item) return null;
  if (typeof item.value === 'string') return item.value.trim() || null;
  if (Array.isArray(item.value)) {
    for (const entry of item.value) {
      if (entry && typeof entry.v === 'string' && entry.v.trim()) return entry.v.trim();
    }
  }
  return null;
}

/**
 * 中文名三级回退：
 * 1) 搜索结果 name_cn 字段（空字符串视为无；角色搜索无此字段，直接走 infobox）；
 * 2) infobox 键名「简体中文名 → 繁體中文名 → 中文名」；
 * 3) 回退 name 全名。
 */
export function resolveDisplayName(
  name: string,
  nameCn: string | null | undefined,
  infobox: InfoboxItem[] | null | undefined,
): string {
  if (nameCn && nameCn.trim()) return nameCn.trim();
  if (infobox && infobox.length) {
    for (const key of ['简体中文名', '繁體中文名', '中文名']) {
      const v = infoboxValue(infobox.find((it) => it.key === key));
      if (v) return v;
    }
  }
  return name;
}

interface SearchResponseBase {
  total: number;
  limit: number;
  offset: number;
}

interface SubjectResult {
  id: number;
  name: string;
  name_cn: string;
  type: number;
  images?: { large?: string; medium?: string; common?: string; small?: string; grid?: string } | null;
  infobox?: InfoboxItem[] | null;
}

interface CharacterResult {
  id: number;
  name: string;
  images?: { large?: string; medium?: string; small?: string; grid?: string } | null;
  infobox?: InfoboxItem[] | null;
  gender?: string | null;
}

async function postSearch<T>(path: string, body: unknown, offset: number, signal?: AbortSignal): Promise<T & SearchResponseBase> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const merged =
    typeof AbortSignal.any === 'function' && signal ? AbortSignal.any([signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(`/api${path}?limit=20&offset=${offset}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: merged,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new SearchError('network');
  }
  if (!res.ok) throw new SearchError('service');
  return (await res.json()) as T & SearchResponseBase;
}

export interface SearchPage {
  total: number;
  items: BangumiCandidate[];
}

/** 条目/角色搜索。请求侧显式携带 filter.nsfw:false 以防上游默认行为漂移。 */
export async function searchBangumi(
  type: SearchType,
  keyword: string,
  offset: number,
  signal?: AbortSignal,
): Promise<SearchPage> {
  const kw = keyword.trim();
  if (!kw) return { total: 0, items: [] };

  if (type === 'Character') {
    // 角色搜索接口的 filter 仅支持 nsfw，无类型过滤
    const res = await postSearch<{ data: CharacterResult[] }>(
      '/v0/search/characters',
      { keyword: kw, filter: { nsfw: false } },
      offset,
      signal,
    );
    return {
      total: res.total,
      items: (res.data ?? []).map((c) => ({
        id: c.id,
        kind: 'character' as const,
        name: resolveDisplayName(c.name, null, c.infobox),
        imageUrl: normalizeImageURL(c.images?.medium ?? c.images?.large ?? c.images?.small ?? null),
        gender: c.gender ?? null,
      })),
    };
  }

  // 作品（含 Real）走条目搜索，filter.type 为 SubjectType 数组（多值或）
  const res = await postSearch<{ data: SubjectResult[] }>(
    '/v0/search/subjects',
    { keyword: kw, filter: { nsfw: false, type: [SUBJECT_TYPE_CODES[type]] } },
    offset,
    signal,
  );
  return {
    total: res.total,
    items: (res.data ?? []).map((s) => ({
      id: s.id,
      kind: 'subject' as const,
      name: resolveDisplayName(s.name, s.name_cn, s.infobox),
      imageUrl: normalizeImageURL(s.images?.medium ?? s.images?.common ?? s.images?.large ?? null),
      subjectType: s.type,
    })),
  };
}

/** 候选选中后解析出的对象数据（名称/类型已在候选列表算好，这里只带出来） */
export function candidateToCardFields(c: BangumiCandidate): { name: string; type: string } {
  if (c.kind === 'character') {
    return { name: c.name, type: genderToType(c.gender) };
  }
  return { name: c.name, type: SUBJECT_TYPE_MAP[c.subjectType ?? -1] ?? '' };
}
