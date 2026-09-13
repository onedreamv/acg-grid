import { useCallback, useEffect, useMemo, useLayoutEffect, useRef, useState } from 'react';
import { CardTile } from './components/CardTile';
import { ConfirmModal } from './components/ConfirmModal';
import { ControlPanel } from './components/ControlPanel';
import { EditDialog } from './components/EditDialog';
import { SearchDialog } from './components/SearchDialog';
import { TitleBar } from './components/TitleBar';
import { ToastProvider, useToast } from './components/Toast';
import {
  CHARACTER_ATTITUDES,
  DEFAULT_TITLE,
  LOCAL_IMAGE_MAX_MB,
  MAX_CARDS,
  WORK_ATTITUDES,
} from './constants';
import { DEFAULT_SETTINGS } from './types';
import { candidateToCardFields } from './lib/bangumi';
import { exportWallPNG } from './lib/exportCanvas';
import { genId } from './lib/id';
import { ImageStore } from './lib/imageStore';
import { justifyLayout } from './lib/layout';
import { openStorage, requestPersistentStorage, type Storage } from './lib/storage';
import type { BangumiCandidate, CanvasSettings, Card } from './types';

const WALL_MAX_WIDTH = 1280;
const PLACEHOLDER_ASPECTS = [2 / 3, 3 / 4, 4 / 3];
const LOCAL_OK_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const LOCAL_OK_EXT = /\.(png|jpe?g|webp|gif)$/i;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

let createdAtCounter = 0;

function placeholderCard(attitude: string, type: string, source: Card['source']): Card {
  createdAtCounter += 1;
  return {
    id: genId(),
    attitude,
    name: '',
    type,
    imageId: null,
    aspect: PLACEHOLDER_ASPECTS[Math.floor(Math.random() * PLACEHOLDER_ASPECTS.length)],
    source,
    createdAt: Date.now() + createdAtCounter,
  };
}

/** 初次访问 / reset：角色池抽 3、作品池抽 7，组内不重复；有且仅有 1 张 16:9 */
function makePresetCards(): Card[] {
  const works = pickN(WORK_ATTITUDES, 7).map((a) => placeholderCard(a, 'Anime', 'preset'));
  const chars = pickN(CHARACTER_ATTITUDES, 3).map((a) => placeholderCard(a, 'She', 'preset'));
  const cards = shuffle([...works, ...chars]);
  const idx = Math.floor(Math.random() * cards.length);
  cards[idx] = { ...cards[idx], aspect: 16 / 9 };
  return cards;
}

function AppInner() {
  const { toast } = useToast();
  const [storage, setStorage] = useState<Storage | null>(null);
  const imageStoreRef = useRef<ImageStore | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [settings, setSettings] = useState<CanvasSettings>(DEFAULT_SETTINGS);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [hydrated, setHydrated] = useState(false);
  /** 入场动画只作用于本次初始化/reset 生成的卡片（全部加载动画 3s 以内） */
  const [stagedIds, setStagedIds] = useState<Set<string>>(new Set());
  const [thumbUrls, setThumbUrls] = useState<Map<string, string>>(new Map());
  const [wallWidth, setWallWidth] = useState(0);
  const [searchCardId, setSearchCardId] = useState<string | null>(null);
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const wallWrapRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);

  // ── 启动：开库 → 首次访问判定 → 初始化/回访 ─────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        requestPersistentStorage();
        const st = await openStorage();
        if (!alive) return;
        imageStoreRef.current = new ImageStore(st);
        setStorage(st);
        if (!st.persistent) {
          toast('当前浏览器环境不支持持久化存储，刷新后数据可能丢失', 'error');
        }
        const loadedCards = await st.loadCards();
        const loadedSettings = await st.loadSettings();
        const loadedTitle = await st.loadTitle();
        if (!alive) return;
        if (loadedSettings) setSettings(loadedSettings);
        if (loadedTitle) setTitle(loadedTitle);
        if (loadedCards.length === 0) {
          // 首次访问：随机 10 张占位卡，立即落库，次序入场
          const init = makePresetCards();
          setCards(init);
          setStagedIds(new Set(init.map((c) => c.id)));
          await st.saveCards(init);
        } else {
          setCards(loadedCards);
          setStagedIds(new Set());
        }
        setHydrated(true);
        hydratedRef.current = true;
      } catch {
        // 存储层异常时界面保持空态可用（openStorage 内部已有内存回退）
        setHydrated(true);
        hydratedRef.current = true;
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 卡片变化防抖落库 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydratedRef.current || !storage) return;
    const t = window.setTimeout(() => {
      void storage.saveCards(cards);
    }, 250);
    return () => window.clearTimeout(t);
  }, [cards, storage]);

  // ── 缩略图 objectURL 按需加载 ───────────────────────────────────────────
  useEffect(() => {
    const store = imageStoreRef.current;
    if (!store) return;
    let alive = true;
    for (const card of cards) {
      if (!card.imageId || thumbUrls.has(card.imageId)) continue;
      const id = card.imageId;
      void store.thumbURL(id).then((url) => {
        if (!alive || !url) return;
        setThumbUrls((prev) => {
          if (prev.has(id)) return prev;
          const next = new Map(prev);
          next.set(id, url);
          return next;
        });
      });
    }
    return () => {
      alive = false;
    };
  }, [cards, thumbUrls]);

  // ── 画布宽度测量：每次渲染提交后同步测量（仅变化时更新），另监听 resize ──
  useLayoutEffect(() => {
    const el = wallWrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.min(el.clientWidth, WALL_MAX_WIDTH);
      setWallWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });

  // ── 布局 ────────────────────────────────────────────────────────────────
  const layout = useMemo(() => {
    if (!cards.length || wallWidth <= 0) return { items: [], width: 0, height: 0 };
    return justifyLayout({
      aspects: cards.map((c) => c.aspect),
      containerWidth: wallWidth,
      rowHeight: settings.rowHeight,
      gap: settings.gap,
    });
  }, [cards, wallWidth, settings]);

  const cardById = useCallback((id: string | null) => cards.find((c) => c.id === id) ?? null, [cards]);

  // ── 卡片操作 ────────────────────────────────────────────────────────────
  const addPlaceholder = useCallback(() => {
    if (cards.length >= MAX_CARDS) {
      toast(`已达到 ${MAX_CARDS} 张卡片上限`);
      return;
    }
    const card = placeholderCard('', '', 'manual');
    setCards((prev) => [...prev, card]);
    // 追加后滚动到画布末尾，便于立刻编辑
    window.setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 60);
  }, [cards.length, toast]);

  const clearCoverless = useCallback(() => {
    const removed = cards.filter((c) => !c.imageId).length;
    if (removed === 0) {
      toast('没有需要清空的无封面卡片');
      return;
    }
    setCards((prev) => prev.filter((c) => c.imageId));
    toast(`已清空 ${removed} 张无封面卡片`);
  }, [cards, toast]);

  const deleteCard = useCallback(
    (id: string) => {
      const card = cards.find((c) => c.id === id);
      if (card?.imageId) void imageStoreRef.current?.delete(card.imageId);
      setCards((prev) => prev.filter((c) => c.id !== id));
      setSearchCardId(null);
    },
    [cards],
  );

  const updateCard = useCallback((id: string, patch: Partial<Card>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const resetAll = useCallback(async () => {
    const st = storage;
    const store = imageStoreRef.current;
    if (!st || !store) return;
    setResetOpen(false);
    await st.clearAll();
    store.clearRuntime();
    setThumbUrls(new Map());
    setTitle(DEFAULT_TITLE);
    setSettings(DEFAULT_SETTINGS);
    await st.saveTitle(DEFAULT_TITLE);
    await st.saveSettings(DEFAULT_SETTINGS);
    const init = makePresetCards();
    setCards(init);
    setStagedIds(new Set(init.map((c) => c.id)));
    await st.saveCards(init);
    window.scrollTo({ top: 0 });
  }, [storage]);

  // ── bangumi 候选选中：填写数据并抓取封面入库 ─────────────────────────────
  const pickCandidate = useCallback(
    async (cardId: string, candidate: BangumiCandidate) => {
      const fields = candidateToCardFields(candidate);
      setSearchCardId(null);
      let imageId: string | null = null;
      let aspect: number | undefined;
      if (candidate.imageUrl) {
        try {
          const res = await fetch(candidate.imageUrl);
          if (res.ok) {
            const blob = await res.blob();
            const store = imageStoreRef.current;
            if (store) {
              const put = await store.put(blob);
              imageId = put.imageId;
              aspect = put.width / put.height;
            }
          }
        } catch {
          // 封面抓取失败：卡片保留，封面回退类型色渐变占位块（不打断填写）
        }
      }
      updateCard(cardId, {
        name: fields.name,
        type: fields.type,
        source: 'bangumi',
        ...(imageId ? { imageId } : {}),
        ...(aspect ? { aspect } : {}),
      });
    },
    [updateCard],
  );

  // ── 本地图片：格式/大小校验，第一张填当前卡，其余按上限生成新卡 ────────────
  const pickLocalFiles = useCallback(
    async (cardId: string, files: File[]) => {
      const store = imageStoreRef.current;
      if (!store) return;
      let skipped = 0;
      const valid: File[] = [];
      for (const f of files) {
        const okType = LOCAL_OK_TYPES.has(f.type) || LOCAL_OK_EXT.test(f.name);
        if (!okType || f.size > LOCAL_IMAGE_MAX_MB * 1024 * 1024) {
          skipped += 1;
          continue;
        }
        valid.push(f);
      }
      if (!valid.length) {
        if (skipped > 0) toast(`图片格式不支持或文件过大（>20MB），已跳过 ${skipped} 张`, 'error');
        return;
      }

      setSearchCardId(null);
      const capacity = MAX_CARDS - cards.length;
      if (capacity <= 0) {
        toast(`已达到 ${MAX_CARDS} 张卡片上限，剩余 ${valid.length} 张图片未添加`, 'error');
        return;
      }
      const usable = valid.slice(0, capacity);
      const overflow = valid.length - usable.length;

      let first = true;
      const newCards: Card[] = [];
      for (const file of usable) {
        try {
          const put = await store.put(file);
          if (first) {
            first = false;
            updateCard(cardId, {
              imageId: put.imageId,
              aspect: put.width / put.height,
              source: 'local',
            });
          } else {
            newCards.push({
              ...placeholderCard('', '', 'local'),
              imageId: put.imageId,
              aspect: put.width / put.height,
            });
          }
        } catch {
          skipped += 1; // 解码失败按不支持处理
        }
      }
      if (newCards.length) setCards((prev) => [...prev, ...newCards]);
      if (skipped > 0) toast(`图片格式不支持或文件过大（>20MB），已跳过 ${skipped} 张`, 'error');
      if (overflow > 0) {
        toast(`已达到 ${MAX_CARDS} 张卡片上限，剩余 ${overflow} 张图片未添加`, 'error');
      }
    },
    [cards.length, toast, updateCard],
  );

  // ── 导出 ────────────────────────────────────────────────────────────────
  const download = useCallback(async () => {
    const store = imageStoreRef.current;
    if (!store || !cards.length || exporting) return;
    setExporting(true);
    try {
      const sources = new Map<string, Blob | null>();
      for (const card of cards) {
        if (card.imageId && !sources.has(card.imageId)) {
          sources.set(card.imageId, await store.originalBlob(card.imageId));
        }
      }
      const result = await exportWallPNG(
        {
          cards,
          sources,
          settings,
          title,
          containerWidth: wallWidth,
          onScaleAttempt: (scale) => {
            if (scale !== 2) toast(`图片尺寸过大，已自动降级为 ${scale}x 重新导出`);
          },
        },
        {
          onFinalFailure: () =>
            toast('当前设备无法导出此规模的图片，请减少卡片数量或调低行高后重试', 'error'),
        },
      );
      if (result) {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast(`已导出 ${result.filename}（${result.scale}x）`);
      }
    } finally {
      setExporting(false);
    }
  }, [cards, exporting, settings, title, toast, wallWidth]);

  const searchCard = cardById(searchCardId);
  const editCard = cardById(editCardId);

  return (
    <div className="app">
      <header className="app-header">
        <ControlPanel
          settings={settings}
          onSettingsChange={(s) => {
            setSettings(s);
            void storage?.saveSettings(s);
          }}
          onAdd={addPlaceholder}
          onClear={clearCoverless}
          onDownload={() => void download()}
          onReset={() => setResetOpen(true)}
          addDisabled={cards.length >= MAX_CARDS}
        />
        <TitleBar
          title={title}
          onTitleChange={(t) => {
            setTitle(t);
            void storage?.saveTitle(t);
          }}
        />
      </header>

      <main className="wall-wrap" ref={wallWrapRef}>
        {hydrated && layout.items.length > 0 && (
          <div className="wall" style={{ width: layout.width, height: layout.height }}>
            {layout.items.map((placed) => {
              const card = cards[placed.index];
              if (!card) return null;
              return (
                <CardTile
                  key={card.id}
                  card={card}
                  x={placed.x}
                  y={placed.y}
                  w={placed.w}
                  h={placed.h}
                  thumbUrl={card.imageId ? thumbUrls.get(card.imageId) ?? null : null}
                  staged={stagedIds.has(card.id)}
                  animationDelay={stagedIds.has(card.id) ? placed.index * 220 : 0}
                  onCoverClick={() => setSearchCardId(card.id)}
                  onMetaClick={() => setEditCardId(card.id)}
                />
              );
            })}
          </div>
        )}
      </main>

      {searchCard && (
        <SearchDialog
          card={searchCard}
          onPickCandidate={(c) => void pickCandidate(searchCard.id, c)}
          onPickLocalFiles={(files) => void pickLocalFiles(searchCard.id, files)}
          onDelete={() => deleteCard(searchCard.id)}
          onClose={() => setSearchCardId(null)}
        />
      )}

      {editCard && (
        <EditDialog
          card={editCard}
          onSave={({ type, name, attitude }) => {
            updateCard(editCard.id, { type, name, attitude });
            setEditCardId(null);
          }}
          onClose={() => setEditCardId(null)}
        />
      )}

      <ConfirmModal
        open={resetOpen}
        title="重置全部？"
        message="将清除所有持久状态（卡片、本地图片、设置、标题），并重新随机 10 张占位卡。此操作不可撤销。"
        confirmLabel="好喵"
        cancelLabel="算了喵"
        danger
        onConfirm={() => void resetAll()}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
