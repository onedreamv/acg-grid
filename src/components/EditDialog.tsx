import { useEffect, useRef, useState } from 'react';
import { TYPE_PRESETS, attitudesForType } from '../constants';
import type { Card } from '../types';
import { ChevronDownIcon, CloseIcon } from './icons';

/**
 * 点击卡片元数据层唤出的手动编辑会话框。
 * 顺序约束：必须先填写对象类型，再填写态度（类型未选时态度下拉禁用）。
 */
export function EditDialog({
  card,
  onSave,
  onClose,
}: {
  card: Card;
  onSave: (fields: { type: string; name: string; attitude: string }) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState(card.type);
  const [name, setName] = useState(card.name);
  const [attitude, setAttitude] = useState(card.attitude);
  const [typeMenu, setTypeMenu] = useState(false);
  const [attMenu, setAttMenu] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  const attRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (typeMenu && !typeRef.current?.contains(e.target as Node)) setTypeMenu(false);
      if (attMenu && !attRef.current?.contains(e.target as Node)) setAttMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [typeMenu, attMenu, onClose]);

  // 按对象类型过滤态度预设；下拉始终包含当前已填的态度值（类型与态度不匹配视为用户自由）
  const attitudeOptions = (() => {
    const presets = attitudesForType(type);
    if (attitude && !presets.includes(attitude)) return [attitude, ...presets];
    return presets;
  })();

  const attitudeLocked = !type.trim();

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="edit-modal" role="dialog" aria-modal="true" aria-label="编辑元数据">
        <button className="modal-close" aria-label="关闭" onClick={onClose}>
          <CloseIcon />
        </button>
        <h2 className="edit-title">编辑元数据</h2>

        <div className="field-row">
          <label className="field-label" htmlFor="edit-type">对象类型</label>
          <div className="field-combo" ref={typeRef}>
            <input
              id="edit-type"
              className="field-input"
              value={type}
              maxLength={10}
              placeholder="Book / Anime / 自定义…"
              onChange={(e) => setType(e.target.value)}
              onFocus={() => setTypeMenu(false)}
            />
            <button
              type="button"
              className="combo-btn"
              aria-label="展开类型预设"
              aria-expanded={typeMenu}
              onClick={() => setTypeMenu((v) => !v)}
            >
              <ChevronDownIcon />
            </button>
            {typeMenu && (
              <ul className="combo-menu" role="listbox" aria-label="类型预设">
                {TYPE_PRESETS.map((t) => (
                  <li key={t}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={type === t}
                      className={`combo-item ${type === t ? 'selected' : ''}`}
                      onClick={() => {
                        setType(t);
                        setTypeMenu(false);
                      }}
                    >
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="field-row">
          <label className="field-label" htmlFor="edit-name">对象名</label>
          <input
            id="edit-name"
            className="field-input field-input-solo"
            value={name}
            maxLength={100}
            placeholder="对象名"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field-row">
          <label className="field-label" htmlFor="edit-attitude">态度</label>
          <div className={`field-combo ${attitudeLocked ? 'combo-disabled' : ''}`} ref={attRef}>
            <input
              id="edit-attitude"
              className="field-input"
              value={attitude}
              maxLength={10}
              placeholder={attitudeLocked ? '先选择对象类型' : '最喜欢…'}
              disabled={attitudeLocked}
              onChange={(e) => setAttitude(e.target.value)}
              onFocus={() => setAttMenu(false)}
            />
            <button
              type="button"
              className="combo-btn"
              aria-label="展开态度预设"
              aria-expanded={attMenu}
              disabled={attitudeLocked}
              onClick={() => setAttMenu((v) => !v)}
            >
              <ChevronDownIcon />
            </button>
            {attMenu && !attitudeLocked && (
              <ul className="combo-menu" role="listbox" aria-label="态度预设">
                {attitudeOptions.map((a) => (
                  <li key={a}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={attitude === a}
                      className={`combo-item ${attitude === a ? 'selected' : ''}`}
                      onClick={() => {
                        setAttitude(a);
                        setAttMenu(false);
                      }}
                    >
                      {a}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="edit-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSave({ type: type.trim(), name: name.trim(), attitude: attitude.trim() })}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
