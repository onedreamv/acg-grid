import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BangumiCandidate, Card, SearchType } from '../types';
import { searchBangumi, SearchError } from '../lib/bangumi';
import { PawIcon, CloseIcon } from './icons';

/** API 源 */
type Source = 'bangumi' | 'local';

const TYPE_OPTIONS: Array<{ value: SearchType; label: string }> = [
  { value: 'Book', label: 'Book 书' },
  { value: 'Anime', label: 'Anime 番剧' },
  { value: 'Music', label: 'Music 歌' },
  { value: 'Game', label: 'Game 游戏' },
  { value: 'Real', label: 'Real 三次元（真人）' },
  { value: 'Character', label: 'Character 角色' },
];

const PAGE_SIZE = 20;

interface Candidate extends BangumiCandidate {
  key: string;
}

/**
 * 点击卡片封面唤出的会话窗口：
 * API 源分段控件（bangumi / 从本地添加）→ 搜索框 → 对象类型分段控件 → 候选区（5 列、触底分页）；
 * 最下方红色猫爪按钮销毁卡片。
 */
export function SearchDialog({
  card,
  onPickCandidate,
  onPickLocalFiles,
  onDelete,
  onClose,
}: {
  card: Card;
  onPickCandidate: (c: BangumiCandidate) => void;
  onPickLocalFiles: (files: File[]) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState<Source>('bangumi');
  const [searchType, setSearchType] = useState<SearchType>(defaultSearchType(card.type));
  const [keyword, setKeyword] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [results, setResults] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ kind: 'service' | 'network' } | null>(null);
  const [searched, setSearched] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasMore = useMemo(() => results.length < total, [results, total]);

  const runSearch = useCallback(
    async (kw: string, offset: number) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setError(null);
      try {
        const page = await searchBangumi(searchType, kw, offset, ac.signal);
        setTotal(page.total);
        setResults((prev) => {
          const merged = offset === 0 ? page.items : [...prev, ...page.items];
          // 去重（同一候选可能因分页边界重复）
          const seen = new Set<string>();
          return merged
            .filter((it) => {
              const key = `${it.kind}-${it.id}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map((it) => ({ ...it, key: `${it.kind}-${it.id}` }));
        });
        setSearched(true);
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(e instanceof SearchError ? { kind: e.kind } : { kind: 'network' });
        setSearched(true);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    },
    [searchType],
  );

  // 关键词/类型提交触发新搜索
  useEffect(() => {
    if (!submitted) return;
    void runSearch(submitted, 0);
  }, [submitted, runSearch]);

  // 触底自动加载下一页
  useEffect(() => {
    const list = listRef.current;
    const sentinel = sentinelRef.current;
    if (!list || !sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting) && hasMore && !loading && !error) {
          void runSearch(submitted, results.length);
        }
      },
      { root: list, rootMargin: '120px' },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMore, loading, error, runSearch, submitted, results.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submitSearch = () => {
    const kw = keyword.trim();
    if (!kw) return;
    setResults([]);
    setTotal(0);
    setSubmitted(kw);
  };

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    onPickLocalFiles(Array.from(files));
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div
      className="modal-overlay modal-overlay--sheet"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="search-modal" role="dialog" aria-modal="true" aria-label="选择卡片对象">
        <button className="modal-close" aria-label="关闭" onClick={onClose}>
          <CloseIcon />
        </button>

        <div className="segmented" role="tablist" aria-label="API 源">
          <button
            role="tab"
            aria-selected={source === 'bangumi'}
            className={`segment ${source === 'bangumi' ? 'active' : ''}`}
            onClick={() => setSource('bangumi')}
          >
            bangumi
          </button>
          <button
            role="tab"
            aria-selected={source === 'local'}
            className={`segment ${source === 'local' ? 'active' : ''}`}
            onClick={() => setSource('local')}
          >
            从本地添加
          </button>
        </div>

        {source === 'bangumi' ? (
          <>
            <form
              className="search-row"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
            >
              <input
                className="search-input"
                type="search"
                placeholder="输入 对象/番剧/角色/小说 名 搜索喵 "
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={!keyword.trim()}>
                搜索
              </button>
            </form>

            <div className="segmented type-seg" role="tablist" aria-label="对象类型">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  role="tab"
                  aria-selected={searchType === opt.value}
                  className={`segment ${searchType === opt.value ? 'active' : ''}`}
                  onClick={() => setSearchType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="candidate-list" ref={listRef}>
              {results.length > 0 && (
                <div className="candidate-grid">
                  {results.map((c) => (
                    <button
                      key={c.key}
                      className="candidate-cell"
                      onClick={() => onPickCandidate(c)}
                      title={c.name}
                    >
                      <span className="candidate-thumb">
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt={c.name} loading="lazy" />
                        ) : (
                          <span className="candidate-noimg">无图</span>
                        )}
                      </span>
                      <span className="candidate-name">{c.name}</span>
                    </button>
                  ))}
                  {loading &&
                    Array.from({ length: 5 }, (_, i) => (
                      <div key={`sk-${i}`} className="candidate-cell candidate-skeleton" />
                    ))}
                </div>
              )}
              {results.length === 0 && loading && (
                <div className="candidate-grid">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={`sk-${i}`} className="candidate-cell candidate-skeleton" />
                  ))}
                </div>
              )}
              {results.length === 0 && !loading && error && (
                <div className="candidate-state">
                  <p>
                    {error.kind === 'service'
                      ? '搜索服务暂时不可用，请稍后重试'
                      : '网络请求失败，请检查网络连接后重试'}
                  </p>
                  <button className="btn btn-primary" onClick={() => void runSearch(submitted, 0)}>
                    重试
                  </button>
                </div>
              )}
              {results.length === 0 && !loading && !error && searched && (
                <div className="candidate-state">
                  <p>未找到匹配结果，可尝试其他关键词</p>
                </div>
              )}
              {results.length === 0 && !loading && !error && !searched && (
                <div className="candidate-state">
                  <p>输入关键词开始搜索喵</p>
                </div>
              )}
              <div ref={sentinelRef} className="sentinel" />
            </div>
          </>
        ) : (
          <div className="local-pane">
            <p className="local-hint">
              选择一张图片填充当前卡片封面；多选时第一张填充当前卡片，其余各生成一张新卡。
              支持 png / jpg / jpeg / webp，GIF 取首帧，单文件 ≤ 20MB。
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
              multiple
              hidden
              onChange={(e) => onFiles(e.target.files)}
            />
            <button className="btn btn-primary local-pick" onClick={() => fileRef.current?.click()}>
              打开图片选择器
            </button>
          </div>
        )}

        <div className="destroy-row">
          <button
            className="destroy-btn"
            title="销毁卡片"
            aria-label="销毁卡片"
            onClick={onDelete}
          >
            <PawIcon size={26} color="#ffffff" />
          </button>
          <span className="destroy-label">销毁卡片</span>
        </div>
      </div>
    </div>
  );
}

function defaultSearchType(cardType: string): SearchType {
  if (cardType === 'She' || cardType === 'He') return 'Character';
  if (cardType === 'Book' || cardType === 'Music' || cardType === 'Game' || cardType === 'Real') {
    return cardType;
  }
  return 'Anime';
}
