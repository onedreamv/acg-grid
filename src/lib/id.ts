let counter = 0;

/** 轻量唯一 id（无需引入 uuid 依赖；同页面会话内唯一，配合 createdAt 足够） */
export function genId(prefix = 'c'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
