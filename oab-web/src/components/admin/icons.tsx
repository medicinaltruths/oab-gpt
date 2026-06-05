import type { SVGProps } from "react";

export type IconName =
  | "activity"
  | "analytics"
  | "arrow"
  | "check"
  | "chevron"
  | "clock"
  | "document"
  | "download"
  | "filter"
  | "home"
  | "logout"
  | "menu"
  | "patients"
  | "search"
  | "shield"
  | "sparkles"
  | "user"
  | "x";

const paths: Record<IconName, React.ReactNode> = {
  activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  analytics: (
    <>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M22 19V3" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  document: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  filter: (
    <>
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  logout: (
    <>
      <path d="M10 5H5v14h5" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  patients: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M3 21v-2a6 6 0 0 1 12 0v2" />
      <path d="M16 3.5a4 4 0 0 1 0 7.5" />
      <path d="M18 14a5 5 0 0 1 3 5v2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4 6v5c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2z" />
      <path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z" />
      <path d="m5 14 .7 1.3L7 16l-1.3.7L5 18l-.7-1.3L3 16l1.3-.7z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
};

export function Icon({
  name,
  className = "size-5",
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
