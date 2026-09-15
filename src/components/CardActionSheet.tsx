import { useEffect } from 'react';
import { TypeBadge } from './TypeBadge';
import type { Card } from '../types';

/**
 * 触屏端（compact）卡片操作面板：缩放画布下封面/元数据双热区过小，
 * 单击卡片任意位置唤出本面板，路由到选择封面 / 编辑元数据 / 销毁卡片。
 * 仅在 compact 模式下由 App 渲染；桌面端保持双热区直击。
 */
export function CardActionSheet({
  card,
  thumbUrl,
  onPickCover,
  onEdit,
  onDestroy,
  onClose,
}: {
  card: Card;
  thumbUrl: string | null;
  onPickCover: () => void;
  onEdit: () => void;
  onDestroy: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="action-sheet-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="action-sheet" role="dialog" aria-modal="true" aria-label="卡片操作">
        <div className="action-sheet-card">
          <span className="action-sheet-thumb">
            {thumbUrl && <img src={thumbUrl} alt="" draggable={false} />}
          </span>
          <span className="action-sheet-meta">
            <span className="action-sheet-attitude">
              {card.attitude || card.name || '未命名卡片'}
            </span>
            {card.attitude && card.name && (
              <span className="action-sheet-name">{card.name}</span>
            )}
          </span>
          {card.type && <TypeBadge type={card.type} badgeH={22} />}
        </div>

        <button className="sheet-action" onClick={onPickCover}>
          <span className="sheet-action-title">选择封面</span>
          <span className="sheet-action-desc">搜索 bangumi 或从本地图片添加</span>
        </button>
        <button className="sheet-action" onClick={onEdit}>
          <span className="sheet-action-title">编辑元数据</span>
          <span className="sheet-action-desc">对象类型、态度与名字</span>
        </button>
        <button className="sheet-action sheet-action-danger" onClick={onDestroy}>
          <span className="sheet-action-title">销毁卡片</span>
          <span className="sheet-action-desc">移除卡片及其封面图片，不可撤销</span>
        </button>
      </div>
    </div>
  );
}
