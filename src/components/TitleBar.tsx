import { useEffect, useRef, useState } from 'react';
import { PawIcon } from './icons';

/**
 * 标题栏：大字居中，标题左方小小的白猫爪；标题与猫爪整体可点击编辑。
 */
export function TitleBar({ title, onTitleChange }: { title: string; onTitleChange: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(title);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== title) onTitleChange(t);
  };

  return (
    <div className="title-bar">
      <button className="paw-btn" title="点我改标题喵" aria-label="编辑标题" onClick={startEdit}>
        <PawIcon size={22} color="#ffffff" className="paw-white" />
      </button>
      {editing ? (
        <input
          ref={inputRef}
          className="title-input"
          value={draft}
          maxLength={25}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label="标题"
        />
      ) : (
        <h1 className="title-text" onClick={startEdit} title="点击修改标题">
          {title || 'My ACG Grid'}
        </h1>
      )}
    </div>
  );
}
