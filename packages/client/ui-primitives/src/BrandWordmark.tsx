import type { IconProps } from './icons/props.ts'

/**
 * Render the 蚂小财 Harness wordmark.
 * @param props.size - height in px (default 24; width keeps the native ratio).
 * @param props.className - extra class for layout placement.
 * @returns the wordmark SVG with an ant mark and product name.
 */
export function BrandWordmark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={(size * 174) / 24}
      height={size}
      className={className}
      viewBox="0 0 174 24"
      fill="none"
      aria-hidden="true"
    >
      <g fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.7 6.2 6.8 3.5M14.3 6.2l2.9-2.7M8.2 9.4 4.7 7.8 2.5 9.1M7.8 12H2.6M8.4 14.7 5 17.2 2.6 16" strokeWidth="1.5" fill="none" />
        <path d="m15.8 9.4 3.5-1.6 2.2 1.3M16.2 12h5.2M15.6 14.7l3.4 2.5 2.4-1.2" strokeWidth="1.5" fill="none" />
        <circle cx="12" cy="6" r="2.6" stroke="none" />
        <circle cx="12" cy="11.3" r="3.1" stroke="none" />
        <ellipse cx="12" cy="17.5" rx="4.1" ry="4.4" stroke="none" />
      </g>
      <text
        x="29"
        y="17.2"
        fill="currentColor"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
        fontSize="17"
        fontWeight="700"
        letterSpacing="0.2"
      >蚂小财</text>
      <rect x="88" y="5" width="82" height="15" rx="3" fill="currentColor" />
      <text
        x="129"
        y="15.7"
        fill="var(--dsw-alias-label-primary-inverted)"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="9"
        fontWeight="700"
        letterSpacing="1.1"
        textAnchor="middle"
      >HARNESS</text>
    </svg>
  )
}
