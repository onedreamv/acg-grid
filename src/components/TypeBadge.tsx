import { badgeSpecForHeight } from '../lib/metrics';

/**
 * 屏幕端类型徽章：圆角胶囊 + 首字母大写单词水平垂直居中（内联 SVG）。
 * 设计参数与 canvas 导出共用一份规格（metrics.ts）。
 */
export function TypeBadge({ type, badgeH }: { type: string; badgeH: number }) {
  const spec = badgeSpecForHeight(type, badgeH);
  if (!spec) return null;
  return (
    <svg
      width={spec.width}
      height={spec.height}
      viewBox={`0 0 ${spec.width} ${spec.height}`}
      className="type-badge"
      role="img"
      aria-label={spec.label}
    >
      <rect x={0} y={0} width={spec.width} height={spec.height} rx={spec.radius} fill={spec.bg} />
      <text
        x={spec.width / 2}
        y={spec.height / 2 + spec.fontSize * 0.03}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={spec.fontSize}
        fontWeight={600}
        fill="#333"
        style={{ fontFamily: 'inherit' }}
      >
        {spec.label}
      </text>
    </svg>
  );
}
