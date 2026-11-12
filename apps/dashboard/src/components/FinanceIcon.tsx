import type { SVGProps } from "react";

const paths = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  transactions: "M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4",
  wallet:
    "M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v11H6a3 3 0 0 1-3-3V6m17 7h-5v4h5m-3-2h.01",
  categories: "M3 3h7l11 11-7 7L3 10V3Zm4 4h.01",
  reports: "M4 20V10m8 10V4m8 16v-7",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  up: "M7 17 17 7M7 7h10v10",
  down: "M7 7 17 17M7 17h10V7",
  logout: "M9 4H4v16h5m5-13 5 5-5 5m-6-5h12",
  calendar: "M8 2v4m8-4v4M3 10h18M3 4h18v17H3z",
  refresh:
    "M20 7v5h-5M4 17v-5h5m-5-1a8 8 0 0 1 14-5l2 2M4 16l2 2a8 8 0 0 0 14-5",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
} as const;

export type FinanceIconName = keyof typeof paths;

export default function FinanceIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: FinanceIconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
