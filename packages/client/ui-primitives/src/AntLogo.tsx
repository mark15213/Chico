import type { IconProps } from './icons/props.ts'

/**
 * Render the 蚂小财 ant mark.
 * @param props.size - width and height in px (default 24).
 * @param props.className - extra class for layout placement.
 * @returns the ant logo SVG.
 */
export function AntLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
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
    </svg>
  )
}
