import { useEffect, useRef, useState } from 'react';
import type { CanvasSettings } from '../types';
import { CardsIcon, ClearIcon, DownloadIcon, ResetIcon, AddIcon } from './icons';

/**
 * 顶层横条状控制面板：cards（行高/间距/存储占用设置）、add、clear、download、reset。
 */
export function ControlPanel({
  settings,
  onSettingsChange,
  onAdd,
  onClear,
  onDownload,
  onReset,
  addDisabled,
}: {
  settings: CanvasSettings;
  onSettingsChange: (s: CanvasSettings) => void;
  onAdd: () => void;
  onClear: () => void;
  onDownload: () => void;
  onReset: () => void;
  addDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // 打开设置面板时查询存储占用 / 配额
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void navigator.storage
      ?.estimate?.()
      .then((est) => {
        if (alive) setStorageInfo({ usage: est.usage ?? 0, quota: est.quota ?? 0 });
      })
      .catch(() => {
        if (alive) setStorageInfo(null);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        !popRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const fmtBytes = (b: number) => {
    if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
    if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
    return `${(b / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="control-panel">
      <button
        ref={btnRef}
        className={`panel-btn ${open ? 'active' : ''}`}
        title="卡片设置"
        aria-label="卡片设置"
        onClick={() => setOpen((v) => !v)}
      >
        <CardsIcon />
      </button>
      <button className="panel-btn" title="添加占位卡" aria-label="添加占位卡" onClick={onAdd} disabled={addDisabled}>
        <AddIcon />
      </button>
      <button className="panel-btn" title="清空无封面的卡片" aria-label="清空无封面的卡片" onClick={onClear}>
        <ClearIcon />
      </button>
      <button className="panel-btn" title="导出高清 PNG" aria-label="导出高清 PNG" onClick={onDownload}>
        <DownloadIcon />
      </button>
      <button className="panel-btn panel-btn-danger" title="重置全部" aria-label="重置全部" onClick={onReset}>
        <ResetIcon />
      </button>

      {open && (
        <div className="panel-pop" ref={popRef} role="dialog" aria-label="卡片设置">
          <label className="slider-row">
            <span className="slider-label">卡片行高</span>
            <input
              type="range"
              min={200}
              max={300}
              step={1}
              value={settings.rowHeight}
              onChange={(e) => onSettingsChange({ ...settings, rowHeight: Number(e.target.value) })}
            />
            <span className="slider-value">{settings.rowHeight}px</span>
          </label>
          <label className="slider-row">
            <span className="slider-label">卡片间距</span>
            <input
              type="range"
              min={0}
              max={25}
              step={1}
              value={settings.gap}
              onChange={(e) => onSettingsChange({ ...settings, gap: Number(e.target.value) })}
            />
            <span className="slider-value">{settings.gap}px</span>
          </label>
          <div className="storage-row" title="navigator.storage.estimate()">
            <span className="slider-label">存储占用</span>
            <span className="storage-value">
              {storageInfo
                ? `${fmtBytes(storageInfo.usage)} / ${fmtBytes(storageInfo.quota)}`
                : '查询中…'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
