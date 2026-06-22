// Small inline icon set, Lucide-style (even-weight outline, 1.9px stroke) per
// DESIGN.md. currentColor so they inherit text color. Kept inline to avoid a
// dependency and keep the bundle lean.
import type { ReactNode } from 'react';

function Svg({ children, size = 18, fill = 'none' }: { children: ReactNode; size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {children}
    </svg>
  );
}

export const IconSun = () => <Svg><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
export const IconMoon = () => <Svg><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Svg>;
export const IconChevronsLeft = () => <Svg><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" /></Svg>;
export const IconChevronsRight = () => <Svg><path d="M13 17l5-5-5-5M6 17l5-5-5-5" /></Svg>;
export const IconPlus = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>;
export const IconX = () => <Svg><path d="M18 6L6 18M6 6l12 12" /></Svg>;
export const IconFile = () => <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></Svg>;
export const IconCopy = () => <Svg><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>;
export const IconCheck = () => <Svg><path d="M20 6L9 17l-5-5" /></Svg>;
export const IconTrash = () => <Svg><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Svg>;
export const IconPlay = () => <Svg fill="currentColor"><path d="M7 4l13 8-13 8z" stroke="none" /></Svg>;
export const IconStop = () => <Svg fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5" stroke="none" /></Svg>;
export const IconReset = () => <Svg><path d="M3 2v6h6" /><path d="M3.5 13a9 9 0 1 0 2.4-7.4L3 8" /></Svg>;
export const IconArrowUpRight = () => <Svg><path d="M7 17L17 7M7 7h10v10" /></Svg>;
export const IconClock = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconBars = () => <Svg><path d="M3 6h18M3 12h18M3 18h18" /></Svg>;
export const IconSearch = () => <Svg><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Svg>;
export const IconBook = () => <Svg><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></Svg>;
export const IconGrid = () => <Svg><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></Svg>;
export const IconClipboard = () => <Svg><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></Svg>;
export const IconMic = ({ size = 18 }: { size?: number }) => <Svg size={size}><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" /></Svg>;
export const IconDownload = () => <Svg><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></Svg>;
