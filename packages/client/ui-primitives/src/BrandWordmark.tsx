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
      <path
        d="M9.45 5.75C8.75 4.05 7.55 2.95 5.9 2.5M14.55 5.75c.7-1.7 1.9-2.8 3.55-3.25"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <circle cx="5.55" cy="2.35" r="1.05" fill="currentColor" />
      <circle cx="18.45" cy="2.35" r="1.05" fill="currentColor" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 4.75c-3.7 0-6.35 2.65-6.35 6.3v2.4c0 4.7 2.75 7.75 6.35 7.75s6.35-3.05 6.35-7.75v-2.4c0-3.65-2.65-6.3-6.35-6.3ZM8.4 11.1a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0Zm4.7 0a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0Zm-4.05 4c.65 1.75 1.7 2.65 2.95 2.65s2.3-.9 2.95-2.65c-.8.7-1.8 1.05-2.95 1.05s-2.15-.35-2.95-1.05Z"
      />
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
