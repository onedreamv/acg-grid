/** 手绘线性 SVG 图标（24 viewBox，stroke 风格统一） */

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function CardsIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="7" width="13" height="14" rx="3" />
      <path d="M8 4.5A3 3 0 0 1 11 2h6a3 3 0 0 1 3 3v9a3 3 0 0 1-2 2.83" />
    </svg>
  );
}

export function AddIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ClearIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 19 14.5 9.5" />
      <path d="m13 4 7 7-4.5 4.5-7-7z" />
      <path d="M5 19c-1.5.4-2-.1-1.6-1.6" />
    </svg>
  );
}

export function DownloadIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 4v10m0 0 4-4m-4 4-4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

export function ResetIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4.5 8.5A8 8 0 1 1 4 12" />
      <path d="M4 4v4.5h4.5" />
    </svg>
  );
}

/** 白猫爪（标题装饰 / 删除按钮），fill 风格 */
export function PawIcon({ size = 22, className, color = 'currentColor' }: IconProps & { color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      fill={color}
      aria-hidden="true"
    >
      <ellipse cx="7.5" cy="10.5" rx="3" ry="4" transform="rotate(-18 7.5 10.5)" />
      <ellipse cx="13.5" cy="7.5" rx="3" ry="4.2" transform="rotate(-6 13.5 7.5)" />
      <ellipse cx="19.8" cy="7.8" rx="3" ry="4.2" transform="rotate(8 19.8 7.8)" />
      <ellipse cx="25.3" cy="11" rx="3" ry="4" transform="rotate(20 25.3 11)" />
      <path d="M16.2 13.2c-5 0-9.2 3.8-9.2 8.3 0 3.1 2.5 5.4 5.6 5.4 1.4 0 2.5-.6 3.7-.6 1.2 0 2.3.6 3.7.6 3.1 0 5.6-2.3 5.6-5.4-.1-4.5-4.4-8.3-9.4-8.3z" />
    </svg>
  );
}

export function CloseIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
