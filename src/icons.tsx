// 線條圖示：24×24、1.5 線寬、圓角端點，顏色跟隨文字
import type { ReactNode } from 'react'

const P: Record<string, ReactNode> = {
  food: <><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10" /><path d="M17 21V3c-2 1.2-3 3.5-3 6.5V13h3" /></>,
  body: <><rect x="3.5" y="4" width="17" height="16" rx="3.5" /><path d="M8 9.5a5.5 5.5 0 0 1 8 0" /><path d="M12 9.5l1.6-2" /></>,
  walk: <><circle cx="13.5" cy="4.5" r="1.6" /><path d="M10.5 21l2.2-5.5-2.2-2.5.9-4.3" /><path d="M7.5 11.5l2.4-2.8 3.4-.5 2.2 3.4 2.5 1" /><path d="M12.7 15.5l2.6 1.8.8 3.7" /></>,
  sparkle: <><path d="M10 3.5l1.6 4.4L16 9.5l-4.4 1.6L10 15.5l-1.6-4.4L4 9.5l4.4-1.6z" /><path d="M17.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chevron: <path d="M9.5 6l6 6-6 6" />,
  chevronLeft: <path d="M14.5 6l-6 6 6 6" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  cup: <><path d="M6 4h12l-1.4 15.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8z" /><path d="M6.6 10.5c2.2-1 4.6 1 6.8 0s3.2-.6 4.2 0" /></>,
  scale: <><rect x="3.5" y="4" width="17" height="16" rx="3.5" /><path d="M8 9.5a5.5 5.5 0 0 1 8 0" /><path d="M12 9.5l1.6-2" /></>,
  bean: <><path d="M15.8 4.2c3 1.6 4.5 5.4 2.6 8.8-1.3 2.4-3.6 2.7-5.2 4.5-1.7 1.9-4 3.6-6.6 2.2-3-1.6-3-5.7-.8-8 1.6-1.6 2.5-2.4 3.3-4.6 1.1-2.9 4-4.3 6.7-2.9z" /><path d="M14.5 7.5c-1.2 1.6-1.8 3.7-4 5" /></>,
  drop: <path d="M12 3.5c3 3.6 5.5 6.6 5.5 10a5.5 5.5 0 0 1-11 0c0-3.4 2.5-6.4 5.5-10z" />,
  wheat: <><path d="M12 21V8" /><path d="M12 8c-2-.4-3.2-2-3.2-4.2C10.8 4.2 12 5.8 12 8zM12 8c2-.4 3.2-2 3.2-4.2C13.2 4.2 12 5.8 12 8z" /><path d="M12 13c-2.3-.3-3.8-2-3.8-4.4 2.3.3 3.8 2 3.8 4.4zM12 13c2.3-.3 3.8-2 3.8-4.4-2.3.3-3.8 2-3.8 4.4z" /><path d="M12 18c-2.3-.3-3.8-2-3.8-4.4 2.3.3 3.8 2 3.8 4.4zM12 18c2.3-.3 3.8-2 3.8-4.4-2.3.3-3.8 2-3.8 4.4z" /></>,
  camera: <><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.5" /></>,
  barcode: <><path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17" /><path d="M8 8v8M11 8v8M13.5 8v8M16 8v8" /></>,
  pencil: <><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z" /><path d="M13.5 7l3 3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8l2 1.2 2.3-.2 1.2 2 2 1.2-.2 2.3 1.2 2-1.2 2 .2 2.3-2 1.2-1.2 2-2.3-.2-2 1.2-2-1.2-2.3.2-1.2-2-2-1.2.2-2.3-1.2-2 1.2-2-.2-2.3 2-1.2 1.2-2 2.3.2z" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  shield: <><path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6z" /><path d="M8.8 12l2.2 2.2 4.2-4.4" /></>,
  book: <><path d="M3.5 5.5c3-.8 5.8-.6 8.5 1 2.7-1.6 5.5-1.8 8.5-1v13c-3-.8-5.8-.6-8.5 1-2.7-1.6-5.5-1.8-8.5-1z" /><path d="M12 6.5v13" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M8.5 14.5l2 2 4-4" /></>,
  dumbbell: <><path d="M3 12h2M19 12h2M8.5 12h7" /><rect x="5" y="8" width="3.5" height="8" rx="1" /><rect x="15.5" y="8" width="3.5" height="8" rx="1" /></>,
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-4 3.4-5.6 3.9-9.8 2.6 1.8 3.6 3.8 3.4 6.2 1.1-.6 1.8-1.7 2-3.1 2.2 1.9 3.7 4.3 3.7 6.9 0 3.5-2.6 6-6.5 6z" />,
  leaf: <><path d="M5 19c-.6-7 3.6-13 14-14 .8 9.6-4.6 14.4-11.2 13.4" /><path d="M5 19c2.6-4.6 5.6-7.6 9.5-9.8" /></>,
  sprout: <><path d="M12 21v-8.5" /><path d="M12 12.5C12 8.6 9.3 6 5 6c0 4 2.7 6.5 7 6.5zM12 10.5c0-3.6 2.6-6 6.8-6 0 3.8-2.6 6-6.8 6z" /></>,
  footprints: <><path d="M7.5 3.5c1.7 0 2.7 1.8 2.7 4.4 0 2.2-.8 3.6-2.6 3.6S5 10.2 5 8c0-2.7.8-4.5 2.5-4.5zM5.5 14h4.4c-.1 2-.9 3.3-2.3 3.3S5.5 16 5.5 14z" /><path d="M16.5 7.5c1.7 0 2.5 1.8 2.5 4.5 0 2.2-.9 3.5-2.6 3.5s-2.6-1.4-2.6-3.6c0-2.6 1-4.4 2.7-4.4zM14.1 18h4.4c0 2-.8 3.3-2.2 3.3s-2.2-1.3-2.2-3.3z" /></>,
  trendDown: <><path d="M3.5 7l6 6 3.5-3.5 7.5 7.5" /><path d="M15 17h5.5v-5.5" /></>,
  trophy: <><path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" /><path d="M7.5 6H4.5c0 2.6 1.3 4 3.4 4.2M16.5 6h3c0 2.6-1.3 4-3.4 4.2" /><path d="M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z" /></>,
  star: <path d="M12 3.8l2.5 5.2 5.6.7-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.7z" />,
  crown: <><path d="M4 8l4 4 4-6.5 4 6.5 4-4-1.6 10H5.6z" /><path d="M6 20.5h12" /></>,
  medal: <><circle cx="12" cy="15" r="5" /><path d="M8.5 11.4L6 3.5h4.2L12 8M15.5 11.4L18 3.5h-4.2L12 8" /><path d="M12 12.8l.8 1.5 1.6.2-1.2 1.1.3 1.6-1.5-.8-1.5.8.3-1.6-1.2-1.1 1.6-.2z" /></>,
  egg: <path d="M12 3.5c3.5 0 6 5.2 6 9.5a6 6 0 0 1-12 0c0-4.3 2.5-9.5 6-9.5z" />,
  bowl: <><path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" /><path d="M9 20.5h6" /><path d="M8 8.5c0-1.4 1-1.6 1-3M12 8.5c0-1.4 1-1.6 1-3M16 8.5c0-1.4 1-1.6 1-3" /></>,
  moon: <path d="M19.5 14.5A7.8 7.8 0 0 1 9.5 4.5a7.8 7.8 0 1 0 10 10z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M4 17.5l5-4.5 4 3.5 2.5-2 4.5 4" /></>,
  trash: <><path d="M4.5 7h15M10 4h4M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: <><path d="M12 4l9 15.5H3z" /><path d="M12 10v4M12 16.8v.2" /></>,
  download: <><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M4.5 19.5h15" /></>,
  upload: <><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4.5 19.5h15" /></>,
  users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5c.9-3.1 3.2-4.8 6-4.8s5.1 1.7 6 4.8" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 14.9c1.6.6 2.8 2.2 3.5 4.6" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="M16 10.5l5-3v9l-5-3z" /></>,
  phone: <><rect x="6.5" y="3" width="11" height="18" rx="2.5" /><path d="M10.5 18h3" /></>
}

export type IconName = keyof typeof P

export function Icon({ name, size = 22, className, label }: { name: string; size?: number; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className={className}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    >
      {P[name] ?? P.leaf}
    </svg>
  )
}

/** 六角形徽章 */
export function Hex({ icon, got, size = 64 }: { icon: string; got: boolean; size?: number }) {
  return (
    <span className={got ? 'hex got' : 'hex'} style={{ width: size, height: size * 1.08 }}>
      <svg viewBox="0 0 60 65" width={size} height={size * 1.08} aria-hidden="true">
        <path d="M30 2.5l24.5 14v32L30 62.5 5.5 48.5v-32z" className="hex-bg" />
        <path d="M30 7.5l20 11.5v27L30 57.5 10 46V19z" className="hex-in" />
      </svg>
      <Icon name={icon} size={size * 0.4} className="hex-icon" />
    </span>
  )
}
