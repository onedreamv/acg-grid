import { useEffect, useRef, useState } from 'react';
import type { CanvasSettings } from '../types';
import {
  CardsIcon,
  ClearIcon,
  DownloadIcon,
  ResetIcon,
  AddIcon,
  InfoIcon,
} from './icons';

/** 当前展开的弹层（同一时刻只有一个，互斥） */
type OpenPanel = 'settings' | 'about' | null;

/**
 * 顶层横条状控制面板：cards（行高/间距/存储占用设置）、add、clear、download、reset、about。
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
  const [open, setOpen] = useState<OpenPanel>(null);
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const aboutPopRef = useRef<HTMLDivElement>(null);
  const aboutBtnRef = useRef<HTMLButtonElement>(null);

  // 打开设置面板时查询存储占用 / 配额与持久化授权。Storage API 仅在安全上下文
  // （HTTPS / localhost）暴露：API 缺失或查询失败、或持久化未获授予（persist
  // 申请被拒），一律显示「持久化存储不可用」
  useEffect(() => {
    if (open !== 'settings') return;
    let alive = true;
    const storage = navigator.storage;
    if (!storage?.estimate || !storage.persisted) {
      setStorageUnavailable(true);
      return;
    }
    Promise.all([storage.estimate(), storage.persisted()])
      .then(([est, persisted]) => {
        if (!alive) return;
        if (persisted) setStorageInfo({ usage: est.usage ?? 0, quota: est.quota ?? 0 });
        else setStorageUnavailable(true);
      })
      .catch(() => {
        if (alive) setStorageUnavailable(true);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        !popRef.current?.contains(t) &&
        !btnRef.current?.contains(t) &&
        !aboutPopRef.current?.contains(t) &&
        !aboutBtnRef.current?.contains(t)
      ) {
        setOpen(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
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
        className={`panel-btn ${open === 'settings' ? 'active' : ''}`}
        title="卡片设置"
        aria-label="卡片设置"
        onClick={() => setOpen((v) => (v === 'settings' ? null : 'settings'))}
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
      <button
        ref={aboutBtnRef}
        className={`panel-btn ${open === 'about' ? 'active' : ''}`}
        title="关于"
        aria-label="关于"
        onClick={() => setOpen((v) => (v === 'about' ? null : 'about'))}
      >
        <InfoIcon />
      </button>

      {open === 'about' && (
        <div className="panel-pop about-pop" ref={aboutPopRef} role="dialog" aria-label="关于">
          <div className="about-title">关于</div>
          <div className="about-body">
            Made by{' '}
            <a
              className="about-link"
              href="https://github.com/onedreamv/acg-grid"
              target="_blank"
              rel="noreferrer"
            >
              一梦
            </a>
          </div>
        </div>
      )}

      {open === 'settings' && (
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
                : storageUnavailable
                  ? '持久化存储不可用'
                  : '查询中…'}
            </span>
          </div>
          <label className="switch-row" title="元数据条追加在卡片下方，不遮挡模糊封面">
            <span className="slider-label">元数据分离</span>
            <input
              type="checkbox"
              role="switch"
              checked={settings.separatedMeta}
              onChange={(e) => onSettingsChange({ ...settings, separatedMeta: e.target.checked })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
