import type { Shape } from "../state/types";

export interface Pt {
  x: number;
  y: number;
}

export function center(s: Shape): Pt {
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
}

/** Point on the shape's outline along the ray from its center toward `target`. */
export function boundaryPoint(s: Shape, target: Pt): Pt {
  const c = center(s);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (dx === 0 && dy === 0) return c;
  if (s.kind === "circle") {
    const rx = s.w / 2;
    const ry = s.h / 2;
    const t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    return { x: c.x + dx * t, y: c.y + dy * t };
  }
  // rect / icon: intersect ray with the half-extent box
  const hw = s.w / 2;
  const hh = s.h / 2;
  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

export function pointInShape(s: Shape, p: Pt): boolean {
  if (s.kind === "circle") {
    const rx = s.w / 2;
    const ry = s.h / 2;
    const nx = (p.x - (s.x + rx)) / rx;
    const ny = (p.y - (s.y + ry)) / ry;
    return nx * nx + ny * ny <= 1;
  }
  return p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h;
}

export function rectIntersectsShape(
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
  s: Shape,
): boolean {
  // bounding-box overlap is enough for marquee selection
  return !(s.x > rx1 || s.x + s.w < rx0 || s.y > ry1 || s.y + s.h < ry0);
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const len2 = vx * vx + vy * vy;
  let t = len2 === 0 ? 0 : (wx * vx + wy * vy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = a.x + t * vx;
  const cy = a.y + t * vy;
  return Math.hypot(p.x - cx, p.y - cy);
}

/** Sample a quadratic bezier into n+1 points. */
export function quadPoints(a: Pt, ctrl: Pt, b: Pt, n = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    out.push({
      x: mt * mt * a.x + 2 * mt * t * ctrl.x + t * t * b.x,
      y: mt * mt * a.y + 2 * mt * t * ctrl.y + t * t * b.y,
    });
  }
  return out;
}

/** Resolved endpoints + control + label anchor for an edge. */
export interface EdgeGeometry {
  p1: Pt;
  p2: Pt;
  ctrl: Pt | null;
  mid: Pt;
}

export function edgeGeometry(
  from: Shape,
  to: Shape,
  cx: number | undefined,
  cy: number | undefined,
): EdgeGeometry {
  const hasCtrl = cx !== undefined && cy !== undefined;
  const ctrl = hasCtrl ? { x: cx as number, y: cy as number } : null;
  const targetA = ctrl ?? center(to);
  const targetB = ctrl ?? center(from);
  const p1 = boundaryPoint(from, targetA);
  const p2 = boundaryPoint(to, targetB);
  const mid = ctrl ?? { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  return { p1, p2, ctrl, mid };
}

export function hexToNumber(hex: string): number {
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return parseInt(hex, 16) || 0;
}

/** Pick a readable text color (dark or light) for a given background hex. */
export function readableText(bgHex: string): number {
  const n = hexToNumber(bgHex);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? 0x0f172a : 0xf1f5f9;
}
