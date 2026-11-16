/**
 * Redesign test (task #20): Raft's own icon set, drawn in Figma
 * ("精修 · 组件化" → 图标 · Icons): 24 grid, square caps/joins, 1.3 stroke.
 * Each icon has an outline and a filled style. `c` paints with currentColor,
 * `k` is a knockout painted with the canvas colour.
 */
import type { SVGProps } from "react";

type Part = { d: string; s?: "c" | "k"; f?: "c" | "k" };
type Def = { o: Part[]; f?: Part[] };

const DEFS = {
  search: { o: [{ d: "M16 16L20 20", s: "c" }, { d: "M11 18C14.866 18 18 14.866 18 11C18 7.134 14.866 4 11 4C7.134 4 4 7.134 4 11C4 14.866 7.134 18 11 18Z", s: "c" }] },
  message: {
    o: [{ d: "M4 5H20V16H11L7 20V16H4V5Z", s: "c" }],
    f: [{ d: "M4 5H20V16H11L7 20V16H4V5Z", s: "c", f: "c" }],
  },
  thread: {
    o: [{ d: "M4 5H20V16H11L7 20V16H4V5Z", s: "c" }, { d: "M8 9H16", s: "c" }, { d: "M8 12H13", s: "c" }],
    f: [{ d: "M4 5H20V16H11L7 20V16H4V5Z", s: "c", f: "c" }, { d: "M8 9H16", s: "k" }, { d: "M8 12H13", s: "k" }],
  },
  inbox: {
    o: [{ d: "M6 6H18L20 13V18H4V13L6 6Z", s: "c" }, { d: "M4 13H9V15H15V13H20", s: "c" }],
    f: [{ d: "M6 6H18L20 13V18H4V13L6 6Z", s: "c", f: "c" }, { d: "M4 13H9V15H15V13H20", s: "k" }],
  },
  tasks: {
    o: [{ d: "M5 6H9V10H5V6Z", s: "c" }, { d: "M5 14H9V18H5V14Z", s: "c" }, { d: "M11 8H19", s: "c" }, { d: "M11 16H19", s: "c" }],
    f: [{ d: "M5 6H9V10H5V6Z", s: "c", f: "c" }, { d: "M5 14H9V18H5V14Z", s: "c", f: "c" }, { d: "M11 8H19", s: "c" }, { d: "M11 16H19", s: "c" }],
  },
  artifact: {
    o: [{ d: "M5 4H14.333L19 8V20H5V4Z", s: "c" }, { d: "M14 4V8H19", s: "c" }, { d: "M11 11L9 13.5L11 16", s: "c" }, { d: "M13 11L15 13.5L13 16", s: "c" }],
    f: [{ d: "M5 4H14.333L19 8V20H5V4Z", s: "c", f: "c" }, { d: "M14 4V8H19", s: "k" }, { d: "M11 11L9 13.5L11 16", s: "k" }, { d: "M13 11L15 13.5L13 16", s: "k" }],
  },
  users: {
    o: [
      { d: "M7.5 10C8.881 10 10 8.881 10 7.5C10 6.119 8.881 5 7.5 5C6.119 5 5 6.119 5 7.5C5 8.881 6.119 10 7.5 10Z", s: "c" },
      { d: "M3 19V17.5C3 15.015 5.015 13 7.5 13C9.985 13 12 15.015 12 17.5V19", s: "c" },
      { d: "M15 10C16.105 10 17 9.105 17 8C17 6.895 16.105 6 15 6C13.895 6 13 6.895 13 8C13 9.105 13.895 10 15 10Z", s: "c" },
      { d: "M14 13H15C17.761 13 20 15.239 20 18V19", s: "c" },
    ],
    f: [
      { d: "M7.5 10C8.881 10 10 8.881 10 7.5C10 6.119 8.881 5 7.5 5C6.119 5 5 6.119 5 7.5C5 8.881 6.119 10 7.5 10Z", s: "c", f: "c" },
      { d: "M3 19V17.5C3 15.015 5.015 13 7.5 13C9.985 13 12 15.015 12 17.5V19H3Z", s: "c", f: "c" },
      { d: "M15 10C16.105 10 17 9.105 17 8C17 6.895 16.105 6 15 6C13.895 6 13 6.895 13 8C13 9.105 13.895 10 15 10Z", s: "c", f: "c" },
      { d: "M14 13H15C17.761 13 20 15.239 20 18V19", s: "c" },
    ],
  },
  user: {
    o: [{ d: "M12 10.35C13.85 10.35 15.35 8.85 15.35 7C15.35 5.15 13.85 3.65 12 3.65C10.15 3.65 8.65 5.15 8.65 7C8.65 8.85 10.15 10.35 12 10.35Z", s: "c" }, { d: "M6 19C6 15.686 8.686 13 12 13C15.314 13 18 15.686 18 19", s: "c" }],
    f: [{ d: "M12 10.35C13.85 10.35 15.35 8.85 15.35 7C15.35 5.15 13.85 3.65 12 3.65C10.15 3.65 8.65 5.15 8.65 7C8.65 8.85 10.15 10.35 12 10.35Z", s: "c", f: "c" }, { d: "M6 19C6 15.686 8.686 13 12 13C15.314 13 18 15.686 18 19H6Z", s: "c", f: "c" }],
  },
  hash: { o: [{ d: "M10.5 5L9 19", s: "c" }, { d: "M15.5 5L14 19", s: "c" }, { d: "M6 9.5H19", s: "c" }, { d: "M5 14.5H18", s: "c" }] },
  lock: { o: [{ d: "M8 11H16V18H8V11Z", s: "c", f: "c" }, { d: "M9 11V9.33C9 7.49 10.34 6 12 6C13.66 6 15 7.49 15 9.33V11", s: "c" }] },
  settings: { o: [{ d: "M5 8H19", s: "c" }, { d: "M5 16H19", s: "c" }, { d: "M10 5H8V11H10V5Z", f: "c" }, { d: "M16 13H14V19H16V13Z", f: "c" }] },
  image: {
    o: [{ d: "M4 5H20V19H4V5Z", s: "c" }, { d: "M4 17L9 12L14 17", s: "c" }, { d: "M12 15L15 12L20 17", s: "c" }, { d: "M16 8H14V10H16V8Z", f: "c" }],
    f: [{ d: "M4 5H20V19H4V5Z", s: "c", f: "c" }, { d: "M4 17L9 12L14 17", s: "k" }, { d: "M12 15L15 12L20 17", s: "k" }, { d: "M16 8H14V10H16V8Z", f: "k" }],
  },
  attach: { o: [{ d: "M14 9V16C14 17.1 13.1 18 12 18C10.9 18 10 17.1 10 16V7C10 5.34 11.34 4 13 4C14.66 4 16 5.34 16 7V16C16 18.21 14.21 20 12 20C9.79 20 8 18.21 8 16V9", s: "c" }] },
  send: { o: [{ d: "M12 19V5", s: "c" }, { d: "M6 11L12 5L18 11", s: "c" }] },
  close: { o: [{ d: "M6 6L18 18", s: "c" }, { d: "M18 6L6 18", s: "c" }] },
  more: { o: [{ d: "M7 11H5V13H7V11Z", f: "c" }, { d: "M13 11H11V13H13V11Z", f: "c" }, { d: "M19 11H17V13H19V11Z", f: "c" }] },
  "chevron-down": { o: [{ d: "M6 9L12 15L18 9", s: "c" }] },
  bookmark: { o: [{ d: "M6 4H18V20L12 15.5L6 20V4Z", s: "c" }], f: [{ d: "M6 4H18V20L12 15.5L6 20V4Z", s: "c", f: "c" }] },
  reply: { o: [{ d: "M9 14L4 9L9 4", s: "c" }, { d: "M4 9H14C17.3 9 20 11.7 20 15V20", s: "c" }] },
  plug: {
    o: [{ d: "M9 3V8", s: "c" }, { d: "M15 3V8", s: "c" }, { d: "M6 8H18V12C18 15.3 15.3 18 12 18C8.7 18 6 15.3 6 12V8Z", s: "c" }, { d: "M12 18V21", s: "c" }],
    f: [{ d: "M9 3V8", s: "c" }, { d: "M15 3V8", s: "c" }, { d: "M6 8H18V12C18 15.3 15.3 18 12 18C8.7 18 6 15.3 6 12V8Z", s: "c", f: "c" }, { d: "M12 18V21", s: "c" }],
  },
  bell: {
    o: [{ d: "M6 17V10.5C6 7.2 8.7 4.5 12 4.5C15.3 4.5 18 7.2 18 10.5V17", s: "c" }, { d: "M4 17H20", s: "c" }, { d: "M10 20H14", s: "c" }],
    f: [{ d: "M6 17V10.5C6 7.2 8.7 4.5 12 4.5C15.3 4.5 18 7.2 18 10.5V17H6Z", s: "c", f: "c" }, { d: "M4 17H20", s: "c" }, { d: "M10 20H14", s: "c" }],
  },
} satisfies Record<string, Def>;

export type RIconName = keyof typeof DEFS;

const paint = (v?: "c" | "k") => (v === "c" ? "currentColor" : v === "k" ? "var(--layer-canvas)" : "none");

export function RIcon({ name, filled = false, ...props }: { name: RIconName; filled?: boolean } & SVGProps<SVGSVGElement>) {
  const def: Def = DEFS[name];
  const parts = filled && def.f ? def.f : def.o;
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" strokeLinecap="butt" strokeLinejoin="miter" aria-hidden="true" data-ricon={name} {...props}>
      {parts.map((p, i) => (
        <path key={i} d={p.d} stroke={paint(p.s)} fill={paint(p.f)} strokeWidth={p.s ? 1.3 : undefined} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
