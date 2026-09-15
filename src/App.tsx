import { useCallback, useEffect, useMemo, useLayoutEffect, useRef, useState } from 'react';
import { CardActionSheet } from './components/CardActionSheet';
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
import { metaMetrics } from './lib/metrics';
import { openStorage, requestPersistentStorage, type Storage } from './lib/storage';
import type { BangumiCandidate, CanvasSettings, Card } from './types';

const WALL_MAX_WIDTH = 1280;
/** compact 断点：与 global.css 的媒体查询保持一致（matchMedia 同步判定） */
const COMPACT_BREAKPOINT = 720;
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

/** 当前 schema 的卡片校验。schema 变更时原地更新此函数（不新增分支）；
 *  校验失败不迁移，由启动流程引导 reset 清空本机旧库。 */
function isCurrentSchemaCard(c: unknown): c is Card {
  if (typeof c !== 'object' || c === null) return false;
  const card = c as Record<string, unknown>;
  return (
    typeof card.id === 'string' &&
    card.id !== '' &&
    typeof card.attitude === 'string' &&
    typeof card.name === 'string' &&
    typeof card.type === 'string' &&
    (typeof card.imageId === 'string' || card.imageId === null) &&
    typeof card.aspect === 'number' &&
    Number.isFinite(card.aspect) &&
    card.aspect > 0 &&
    (card.source === 'preset' ||
      card.source === 'bangumi' ||
      card.source === 'local' ||
      card.source === 'manual') &&
    typeof card.createdAt === 'number'
  );
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
  /** 墙舞台内容宽度（wall-stage 的 clientWidth，逻辑像素） */
  const [stageWidth, setStageWidth] = useState(0);
  /** compact（视口 < 720px）：构图恒为 1280 逻辑宽，预览整体等比缩放，导出与桌面同构 */
  const [compact, setCompact] = useState(false);
  const [searchCardId, setSearchCardId] = useState<string | null>(null);
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [actionCardId, setActionCardId] = useState<string | null>(null);
  const [destroyCardId, setDestroyCardId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  /** 加载的数据未通过 schema 校验：封锁落库并引导 reset（开发阶段不做字段迁移） */
  const [legacyBlocked, setLegacyBlocked] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
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
      // 旧版本持久化的 settings 可能缺少新字段，合并默认值
      if (loadedSettings) setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
        if (loadedTitle) setTitle(loadedTitle);
        if (loadedCards.length === 0) {
          // 首次访问：随机 10 张占位卡，立即落库，次序入场
          const init = makePresetCards();
          setCards(init);
          setStagedIds(new Set(init.map((c) => c.id)));
          await st.saveCards(init);
        } else if (loadedCards.every(isCurrentSchemaCard)) {
          setCards(loadedCards);
          setStagedIds(new Set());
        } else {
          // 数据与当前 schema 不兼容：不迁移，展示示例画布并引导 reset（落库保持封锁）
          const init = makePresetCards();
          setCards(init);
          setStagedIds(new Set(init.map((c) => c.id)));
          setLegacyBlocked(true);
          setLegacyOpen(true);
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

  // ── 卡片变化防抖落库（schema 不兼容期间封锁，防止示例画布覆盖本机旧库）──
  useEffect(() => {
    if (legacyBlocked) return;
    if (!hydratedRef.current || !storage) return;
    const t = window.setTimeout(() => {
      void storage.saveCards(cards);
    }, 250);
    return () => window.clearTimeout(t);
  }, [cards, storage, legacyBlocked]);

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

  // ── 舞台宽度测量：compact 判定跟随 CSS 媒体查询断点，窄屏走缩放画布 ──────
  // ResizeObserver 观察舞台元素本身：视口/旋转/仿真时序导致的 0 → 实宽变化均能自愈
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const mq = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT}px)`);
    const measure = () => {
      const w = el.clientWidth;
      setStageWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
      setCompact(mq.matches);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    mq.addEventListener('change', measure);
    // 挂载瞬间个别环境可能读到 0 宽（样式未就绪/视口仿真时序）且 RO 不投递，
    // 以短周期重试兜底，读到非零宽度后即停（正常环境一次都不重试）
    let tries = 0;
    const retry = () => {
      if (el.clientWidth > 0 || tries >= 30) {
        measure();
        return;
      }
      tries += 1;
      setTimeout(retry, 100);
    };
    setTimeout(retry, 100);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', measure);
    };
  }, []);

  // ── 布局 ────────────────────────────────────────────────────────────────
  // 构图宽度：compact 恒为 1280（导出与桌面大屏同一构图）；桌面按舞台宽 1:1，上限 1280
  const canvasWidth = compact ? WALL_MAX_WIDTH : Math.min(stageWidth, WALL_MAX_WIDTH);
  // compact 预览缩放比：视口宽 / 构图宽；经 CSS zoom 在布局期缩放，
  // 规避 transform 缩放层在 Android 页面缩放下的合成器瓦片错乱（闪烁/残影）
  const previewScale = compact && stageWidth > 0 ? stageWidth / WALL_MAX_WIDTH : 1;
  // 分离模式：元数据条高度按行高目标值固定（避免与行高互相依赖），行距按封面高+条高推进
  const stripMeta = useMemo(() => metaMetrics(settings.rowHeight), [settings.rowHeight]);
  const extraMetaH = settings.separatedMeta ? stripMeta.metaH : 0;
  const layout = useMemo(() => {
    if (!cards.length || canvasWidth <= 0) return { items: [], width: 0, height: 0 };
    return justifyLayout({
      aspects: cards.map((c) => c.aspect),
      containerWidth: canvasWidth,
      rowHeight: settings.rowHeight,
      gap: settings.gap,
      extraHeight: extraMetaH,
    });
  }, [cards, canvasWidth, settings, extraMetaH]);

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
    setLegacyOpen(false);
    setLegacyBlocked(false);
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
          containerWidth: canvasWidth,
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
  }, [cards, exporting, settings, title, toast, canvasWidth]);

  const searchCard = cardById(searchCardId);
  const editCard = cardById(editCardId);
  const actionCard = cardById(actionCardId);

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

      <main className="wall-wrap">
        <div className="wall-stage" ref={stageRef}>
          {hydrated && layout.items.length > 0 && (
              <div
                className="wall"
                style={{
                  width: layout.width,
                  height: layout.height,
                  // 字符串形式注入，规避任何 React 数值样式序列化的边界行为
                  zoom: previewScale !== 1 ? String(previewScale) : undefined,
                }}
              >
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
                    separated={settings.separatedMeta}
                    stripH={extraMetaH}
                    stripM={stripMeta}
                    onCoverClick={
                      compact ? () => setActionCardId(card.id) : () => setSearchCardId(card.id)
                    }
                    onMetaClick={
                      compact ? () => setActionCardId(card.id) : () => setEditCardId(card.id)
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
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

      {actionCard && (
        <CardActionSheet
          card={actionCard}
          thumbUrl={actionCard.imageId ? thumbUrls.get(actionCard.imageId) ?? null : null}
          onPickCover={() => {
            setActionCardId(null);
            setSearchCardId(actionCard.id);
          }}
          onEdit={() => {
            setActionCardId(null);
            setEditCardId(actionCard.id);
          }}
          onDestroy={() => {
            setActionCardId(null);
            setDestroyCardId(actionCard.id);
          }}
          onClose={() => setActionCardId(null)}
        />
      )}

      <ConfirmModal
        open={destroyCardId !== null}
        title="销毁这张卡片？"
        message="将从卡片墙移除该卡片，其封面图片也会一并删除。此操作不可撤销。"
        confirmLabel="销毁"
        cancelLabel="算了喵"
        danger
        onConfirm={() => {
          if (destroyCardId) deleteCard(destroyCardId);
          setDestroyCardId(null);
        }}
        onCancel={() => setDestroyCardId(null)}
      />

      <ConfirmModal
        open={legacyOpen}
        title="检测到旧版本数据"
        message="本机持久化的卡片数据与当前版本的结构不兼容（开发阶段不做自动迁移）。可重置以继续：将清空本机全部卡片、图片与设置，并重新生成示例画布。"
        confirmLabel="重置"
        cancelLabel="暂不"
        danger
        onConfirm={() => void resetAll()}
        onCancel={() => {
          setLegacyOpen(false);
          toast('旧数据未清除，本次会话的更改不会保存；重置后恢复保存', 'error');
        }}
      />

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
