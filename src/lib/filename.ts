/** 导出文件名清洗：非法字符 → 全角，剔除首尾空格；空或 Windows 保留名 → 回退默认标题 */
export function sanitizeTitleForFilename(title: string): string {
  const FULLWIDTH: Record<string, string> = {
    '<': '＜',
    '>': '＞',
    ':': '：',
    '"': '＂',
    '/': '／',
    '\\': '＼',
    '|': '｜',
    '?': '？',
    '*': '＊',
  };
  let cleaned = title.replace(/[<>:"/\\|?*]/g, (ch) => FULLWIDTH[ch] ?? ch).trim();
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(cleaned)) {
    cleaned = '';
  }
  return cleaned || 'My ACG Grid';
}

export function buildExportFilename(title: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${sanitizeTitleForFilename(title)}-${stamp}.png`;
}
