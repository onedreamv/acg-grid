import { BADGE_COLORS } from '../constants';
import { badgeSpec, metaMetrics, overlayMode, type MetaMetrics } from '../lib/metrics';
import type { Card } from '../types';
import { TypeBadge } from './TypeBadge';

/**
 * 屏幕端卡片：封面区（占位/图片）+ 元数据层。
 * 默认（叠加模式）：元数据亚克力层压在封面底部，按宽高比自适应（ratio < 1.5 通栏 / ≥ 1.5 胶囊）。
 * 分离模式（separated）：元数据条为不透明实心条，追加在封面下方，不遮挡模糊封面；恒为通栏形态。
 * 布局参数取自 metrics.ts（与 canvas 导出同一份设计规格）。
 */
export function CardTile({
  card,
  x,
  y,
  w,
  h,
  thumbUrl,
  staged,
  animationDelay,
  separated,
  stripH,
  stripM,
  onCoverClick,
  onMetaClick,
}: {
  card: Card;
  x: number;
  y: number;
  w: number;
  h: number;
  thumbUrl: string | null;
  staged: boolean;
  animationDelay: number;
  /** 元数据分离模式 */
  separated: boolean;
  /** 分离模式：元数据条高度（逻辑像素，由行高目标值决定） */
  stripH: number;
  /** 分离模式：元数据条文字度量（基于行高目标值） */
  stripM: MetaMetrics;
  onCoverClick: () => void;
  onMetaClick: () => void;
}) {
  const m = metaMetrics(h);
  const mode = overlayMode(w, h);
  const badge = badgeSpec(card.type, m);
  const radius = Math.min(18, h * 0.06);
  const hasMeta = !!(card.attitude || card.name || card.type);
  const blank = !hasMeta;

  const fallbackColor = BADGE_COLORS[card.type as keyof typeof BADGE_COLORS] ?? '#66CCFF';

  const stripBadge = separated ? badgeSpec(card.type, stripM) : null;

  return (
    <div
      className={`card-tile ${staged ? 'jelly-in' : 'card-fade'} ${separated ? 'card-tile-separated' : ''}`}
      style={{
        left: x,
        top: y,
        width: w,
        height: separated ? h + stripH : h,
        borderRadius: radius,
        animationDelay: `${animationDelay}ms`,
      }}
    >
      {/* 封面区：点击唤出会话窗口 */}
      <div
        className="card-cover"
        style={{
          borderRadius: separated ? `${radius}px ${radius}px 0 0` : radius,
          height: h,
        }}
        onClick={onCoverClick}
        role="button"
        aria-label={`选择封面：${card.name || '未填写卡片'}`}
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt={card.name || ''} draggable={false} />
        ) : card.imageId ? (
          // 已设置封面但加载失败/加载中：回退类型色渐变占位块
          <div
            className="cover-fallback"
            style={{ background: `linear-gradient(160deg, ${fallbackColor}aa, #ffffff 88%)` }}
          />
        ) : (
          <div className="cover-placeholder">
            <div className="cover-gloss" />
          </div>
        )}
      </div>

      {/* 分离模式：不透明元数据条追加在封面下方，恒为通栏形态 */}
      {separated ? (
        <div
          className={`meta-strip ${blank ? 'meta-strip-empty' : ''}`}
          style={{
            top: h,
            height: stripH,
            borderRadius: `0 0 ${radius}px ${radius}px`,
            padding: `${stripM.padTop}px ${stripM.padX}px ${stripM.padBottom}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onMetaClick();
          }}
          role="button"
          aria-label="编辑元数据"
        >
          {blank ? (
            <span className="meta-empty-hint">编辑元数据</span>
          ) : (
            <>
              <MetaText
                card={card}
                attitudeFS={stripM.attitudeFS}
                nameFS={stripM.nameFS}
                lineGap={stripM.lineGap}
                nameMaxW={w - stripM.padX * 2 - (stripBadge ? stripBadge.width + stripM.innerGap : 0)}
              />
              {stripBadge && (
                <div className="meta-badge" style={{ right: stripM.padX * 0.7 }}>
                  <TypeBadge type={card.type} badgeH={stripM.badgeH} />
                </div>
              )}
            </>
          )}
        </div>
      ) : !hasMeta ? (
        /* 叠加模式空白卡：空态磨砂条（通栏形态），保证始终有点击入口 */
        <div
          className="meta-layer meta-empty"
          style={{
            height: m.metaH,
            maskImage: `linear-gradient(to bottom, transparent 0, #000 ${m.fadeH}px)`,
            WebkitMaskImage: `linear-gradient(to bottom, transparent 0, #000 ${m.fadeH}px)`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onMetaClick();
          }}
          role="button"
          aria-label="编辑元数据"
        >
          <span className="meta-empty-hint">编辑元数据</span>
        </div>
      ) : mode === 'full' ? (
        <div
          className="meta-layer meta-full"
          style={{
            height: m.metaH + m.fadeH,
            maskImage: `linear-gradient(to bottom, transparent 0, #000 ${m.fadeH}px)`,
            WebkitMaskImage: `linear-gradient(to bottom, transparent 0, #000 ${m.fadeH}px)`,
            // 渐隐带占据元素顶部 fadeH：文字相对可见实心区排布（与导出端一致），
            // 否则文字会上浮一个渐隐带高度
            padding: `${m.padTop + m.fadeH}px ${m.padX}px ${m.padBottom}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onMetaClick();
          }}
          role="button"
          aria-label="编辑元数据"
        >
          <MetaText
            card={card}
            attitudeFS={m.attitudeFS}
            nameFS={m.nameFS}
            lineGap={m.lineGap}
            nameMaxW={w - m.padX * 2 - (badge ? badge.width + m.innerGap : 0)}
          />
          {badge && (
            <div className="meta-badge" style={{ right: m.padX * 0.7 }}>
              <TypeBadge type={card.type} badgeH={m.badgeH} />
            </div>
          )}
        </div>
      ) : (
        <div
          className="meta-layer meta-capsule"
          style={{
            bottom: m.capsuleBottom,
            maxWidth: `calc(100% - ${m.edgeMargin * 2}px)`,
            padding: `${m.padTop}px ${m.padX}px ${m.padBottom}px`,
            gap: m.innerGap,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onMetaClick();
          }}
          role="button"
          aria-label="编辑元数据"
        >
          <MetaText
            card={card}
            attitudeFS={m.attitudeFS}
            nameFS={m.nameFS}
            lineGap={m.lineGap}
            nameMaxW={w - m.edgeMargin * 2 - m.padX * 2 - (badge ? badge.width + m.innerGap : 0)}
          />
          {badge && (
            <div
              className="meta-badge meta-badge-inline"
              style={{ marginTop: m.padTop + m.attitudeFS * 0.61 - m.badgeH / 2 }}
            >
              <TypeBadge type={card.type} badgeH={m.badgeH} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetaText({
  card,
  attitudeFS,
  nameFS,
  lineGap,
  nameMaxW,
}: {
  card: Card;
  attitudeFS: number;
  nameFS: number;
  lineGap: number;
  nameMaxW: number;
}) {
  return (
    <div className="meta-lines" style={{ gap: lineGap }}>
      {card.attitude && (
        <div className="meta-attitude" style={{ fontSize: attitudeFS }}>
          {card.attitude}
        </div>
      )}
      {card.name && (
        <div
          className="meta-name"
          style={{ fontSize: nameFS, maxWidth: nameMaxW }}
          title={card.name}
        >
          {card.name}
        </div>
      )}
    </div>
  );
}
