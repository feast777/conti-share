/** 미니멀 선 아이콘 모음 — 이모지 대신 써서 톤을 통일한다.
 *  색은 style 로 넘겨서 폴더·기능 탭마다 다르게 줄 수 있다. */

import type { CSSProperties } from "react";

type IconProps = { className?: string; style?: CSSProperties };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LogoMark({ className = "h-5 w-5", style }: IconProps) {
  // Worship 의 W 이자 소리 파형 — 브랜드 심볼
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} {...base} strokeWidth={1.9} aria-hidden>
      <path d="M3 7l3.2 10L12 9l5.8 8L21 7" />
    </svg>
  );
}

export function FolderIcon({ className = "h-5 w-5", style, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      {...base}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      aria-hidden
    >
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2a1.5 1.5 0 0 1 1.06.44l1.24 1.24H19.5A1.5 1.5 0 0 1 21 9.18V17.5A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
    </svg>
  );
}

export function HomeIcon({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} {...base} aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function PlusIcon({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} {...base} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CopyIcon({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} {...base} aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a1 1 0 0 1 1-1h9" />
    </svg>
  );
}

export function GripIcon({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden fill="currentColor">
      {[8, 12, 16].flatMap((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />))}
    </svg>
  );
}

export function ChevronRight({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} {...base} aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function SunIcon({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} {...base} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} {...base} aria-hidden>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  );
}

export function VideoIcon({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} {...base} aria-hidden>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m10.5 9.5 4.5 3-4.5 3z" />
    </svg>
  );
}

export function NoteIcon({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} {...base} aria-hidden>
      <path d="M5 4.5h9L19 9v10.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" />
      <path d="M14 4.5V9h4.5M8 13h7M8 16.5h5" />
    </svg>
  );
}

export function ChordIcon({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} {...base} aria-hidden>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
      <circle cx="8.5" cy="6.5" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="17.5" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TempoIcon({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} {...base} aria-hidden>
      <path d="M9 3.5h6l3.5 17H5.5z" />
      <path d="M12 8.5v8" />
    </svg>
  );
}

export function StarIcon({
  className = "h-4 w-4",
  filled = false,
  style,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      {...base}
      fill={filled ? "currentColor" : "none"}
      aria-hidden
    >
      <path d="m12 3.6 2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 17.05 6.75 19.8l1-5.85L3.5 9.8l5.9-.9z" />
    </svg>
  );
}
