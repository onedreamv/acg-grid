import { BADGE_COLORS } from '../constants';
import { badgeSpec, metaMetrics, overlayMode } from '../lib/metrics';
import type { Card } from '../types';
import { TypeBadge } from './TypeBadge';

/**
 * 屏幕端卡片：封面区（占位/图片）+ 元数据亚克力叠加层。
 * 元数据层形态按宽高比自适应：ratio < 1.5 通栏贴底；ratio ≥ 1.5 居中胶囊。
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
  onCoverClick: () => void;
  onMetaClick: () => void;
}) {
  const m = metaMetrics(h);
  const mode = overlayMode(w, h);
  const badge = badgeSpec(card.type, m);
  const radius = Math.min(18, h * 0.06);
  const hasMeta = !!(card.attitude || card.name || card.type);

  const fallbackColor = BADGE_COLORS[card.type as keyof typeof BADGE_COLORS] ?? '#66CCFF';

  return (
    <div
      className={`card-tile ${staged ? 'jelly-in' : 'card-fade'}`}
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: radius,
        animationDelay: `${animationDelay}ms`,
      }}
    >
      {/* 封面区：点击唤出会话窗口 */}
      <div
        className="card-cover"
        style={{ borderRadius: radius }}
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

      {/* 元数据层：点击唤出元数据编辑。空白卡渲染空态磨砂条（通栏形态），保证始终有点击入口 */}
      {!hasMeta ? (
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
              <div
                className="meta-badge"
                style={{ right: m.padX * 0.7 }}
              >
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
        )
      }
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
