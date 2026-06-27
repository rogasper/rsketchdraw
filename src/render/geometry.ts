import type { Edge, ID, Shape } from "../state/types";
import { $theme, type Theme } from "../state/store";

export interface Pt {
  x: number;
  y: number;
}

export function center(s: Shape): Pt {
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
}

/** Transform a world point to the shape's local coordinate space (top-left at 0,0, rotation removed). */
export function worldToLocal(s: Shape, p: Pt): Pt {
  const c = center(s);
  const angle = -(s.rotation ?? 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return {
    x: dx * cos - dy * sin + s.w / 2,
    y: dx * sin + dy * cos + s.h / 2,
  };
}

/** Transform a shape-local point back to world space. */
export function localToWorld(s: Shape, lp: Pt): Pt {
  const c = center(s);
  const angle = s.rotation ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = lp.x - s.w / 2;
  const dy = lp.y - s.h / 2;
  return {
    x: c.x + dx * cos - dy * sin,
    y: c.y + dx * sin + dy * cos,
  };
}

/** Point on the shape's outline along the ray from its center toward `target`. */
export function boundaryPoint(s: Shape, target: Pt): Pt {
  const c = center(s);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const rot = s.rotation ?? 0;

  if (s.kind === "circle") {
    const rx = s.w / 2;
    const ry = s.h / 2;
    const t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    return { x: c.x + dx * t, y: c.y + dy * t };
  }

  const lt = (ldx: number, ldy: number): Pt => {
    const hw = s.w / 2;
    const hh = s.h / 2;
    const t = Math.min(
      ldx !== 0 ? hw / Math.abs(ldx) : Infinity,
      ldy !== 0 ? hh / Math.abs(ldy) : Infinity,
    );
    const lc = s.kind === "triangle" ? { x: s.w / 2, y: s.h / 2 + s.h * 0.08 } : { x: s.w / 2, y: s.h / 2 };
    return { x: lc.x + ldx * t, y: lc.y + ldy * t };
  };

  if (rot !== 0) {
    const cos = Math.cos(-rot);
    const sin = Math.sin(-rot);
    const ldx = dx * cos - dy * sin;
    const ldy = dx * sin + dy * cos;
    const lp = lt(ldx, ldy);
    const cos2 = Math.cos(rot);
    const sin2 = Math.sin(rot);
    const wdx = lp.x - s.w / 2;
    const wdy = lp.y - s.h / 2;
    return { x: c.x + wdx * cos2 - wdy * sin2, y: c.y + wdx * sin2 + wdy * cos2 };
  }

  const lp = lt(dx, dy);
  return { x: c.x + lp.x - s.w / 2, y: c.y + lp.y - s.h / 2 };
}

function pointInTriangle(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  const d1 = cross({ x: px, y: py }, { x: ax, y: ay }, { x: bx, y: by });
  const d2 = cross({ x: px, y: py }, { x: bx, y: by }, { x: cx, y: cy });
  const d3 = cross({ x: px, y: py }, { x: cx, y: cy }, { x: ax, y: ay });
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function pointInConvexPolygon(px: number, py: number, verts: number[]): boolean {
  let sign = 0;
  for (let i = 0; i < verts.length; i += 2) {
    const ax = verts[i], ay = verts[i + 1];
    const bx = verts[(i + 2) % verts.length], by = verts[(i + 3) % verts.length];
    const d = cross({ x: px, y: py }, { x: ax, y: ay }, { x: bx, y: by });
    if (d !== 0) {
      if (sign === 0) sign = d > 0 ? 1 : -1;
      else if ((d > 0 ? 1 : -1) !== sign) return false;
    }
  }
  return true;
}

export function pointInShape(s: Shape, p: Pt): boolean {
  const rot = s.rotation ?? 0;
  if (rot !== 0) {
    const lp = worldToLocal(s, p);
    const tmp: Shape = { ...s, x: 0, y: 0, rotation: 0 };
    return pointInShape(tmp, lp);
  }
  if (s.kind === "circle") {
    const rx = s.w / 2;
    const ry = s.h / 2;
    const nx = (p.x - (s.x + rx)) / rx;
    const ny = (p.y - (s.y + ry)) / ry;
    return nx * nx + ny * ny <= 1;
  }
  if (s.kind === "triangle") {
    const bx = s.x, by = s.y + s.h;
    const tx = s.x + s.w / 2, ty = s.y;
    const cx = s.x + s.w, cy = s.y + s.h;
    return pointInTriangle(p.x, p.y, bx, by, tx, ty, cx, cy);
  }
  if (s.kind === "diamond") {
    const x = s.x, y = s.y, w = s.w, h = s.h;
    return pointInConvexPolygon(p.x, p.y, [
      x + w / 2, y, x + w, y + h / 2, x + w / 2, y + h, x, y + h / 2,
    ]);
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

/** Signed area sign of triangle abc (orientation test). */
function cross(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Do segments p1→p2 and p3→p4 properly cross? (ignores collinear-overlap). */
function segIntersectsSeg(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/** Does segment a→b touch or pass through the axis-aligned rect? */
export function segIntersectsRect(
  a: Pt,
  b: Pt,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
): boolean {
  // either endpoint inside the rect → hit (covers a segment fully contained)
  if (
    (a.x >= rx0 && a.x <= rx1 && a.y >= ry0 && a.y <= ry1) ||
    (b.x >= rx0 && b.x <= rx1 && b.y >= ry0 && b.y <= ry1)
  ) {
    return true;
  }
  // otherwise the segment must cross one of the rect's four edges
  const tl = { x: rx0, y: ry0 };
  const tr = { x: rx1, y: ry0 };
  const br = { x: rx1, y: ry1 };
  const bl = { x: rx0, y: ry1 };
  return (
    segIntersectsSeg(a, b, tl, tr) ||
    segIntersectsSeg(a, b, tr, br) ||
    segIntersectsSeg(a, b, br, bl) ||
    segIntersectsSeg(a, b, bl, tl)
  );
}

/** Point on a quadratic bezier at parameter t (0 = start, 1 = end). */
export function quadPointAt(a: Pt, ctrl: Pt, b: Pt, t: number): Pt {
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * ctrl.x + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * ctrl.y + t * t * b.y,
  };
}

/** Sample a quadratic bezier into n+1 points. */
export function quadPoints(a: Pt, ctrl: Pt, b: Pt, n = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(quadPointAt(a, ctrl, b, i / n));
  return out;
}

/** Resolved endpoints + control + label anchor for an edge. */
export interface EdgeGeometry {
  p1: Pt;
  p2: Pt;
  ctrl: Pt | null;
  mid: Pt;
}

/** One end of an edge: a shape it anchors to, or a fixed world point. */
type EdgeEnd = { shape: Shape; point?: undefined } | { shape?: undefined; point: Pt };

/** The free point of an end, or the center of its shape — i.e. where it "aims from". */
function endCenter(end: EdgeEnd): Pt {
  return end.shape ? center(end.shape) : end.point;
}

/** The drawn endpoint: a shape's boundary toward `target`, or the fixed free point. */
function endPoint(end: EdgeEnd, target: Pt): Pt {
  return end.shape ? boundaryPoint(end.shape, target) : end.point;
}

export function edgeGeometry(from: EdgeEnd, to: EdgeEnd, ctrl: Pt | null): EdgeGeometry {
  const targetA = ctrl ?? endCenter(to);
  const targetB = ctrl ?? endCenter(from);
  const p1 = endPoint(from, targetA);
  const p2 = endPoint(to, targetB);
  const mid = ctrl
    ? quadPointAt(p1, ctrl, p2, 0.5)
    : { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  return { p1, p2, ctrl, mid };
}

/** Resolve an edge's two ends to shapes or fixed points, given the board's shapes. */
function edgeEnds(shapes: Record<ID, Shape>, edge: Edge): { from: EdgeEnd; to: EdgeEnd } {
  const resolve = (id: ID | undefined, fx: number | undefined, fy: number | undefined): EdgeEnd => {
    const shape = id !== undefined ? shapes[id] : undefined;
    if (shape) return { shape };
    return { point: { x: fx ?? 0, y: fy ?? 0 } };
  };
  return {
    from: resolve(edge.from, edge.x1, edge.y1),
    to: resolve(edge.to, edge.x2, edge.y2),
  };
}

/** world-space lateral spacing between adjacent parallel edges at their apex */
const LANE_GAP = 28;

/** All edges connecting the same unordered pair of shapes as `edge` (incl. itself). */
export function pairSiblings(edges: Record<ID, Edge>, edge: Edge): Edge[] {
  const a = edge.from;
  const b = edge.to;
  // free / half-anchored edges have no shape pair to fan against
  if (a === undefined || b === undefined) return [edge];
  const out: Edge[] = [];
  for (const e of Object.values(edges)) {
    if ((e.from === a && e.to === b) || (e.from === b && e.to === a)) out.push(e);
  }
  return out;
}

/**
 * Auto control point so parallel edges fan out instead of stacking. Returns null
 * for a lone edge (and the first edge of a pair), which stay straight. Edges rank
 * by creation order — `siblings` arrives in board insertion order — and stack
 * cumulatively to one side: the first line stays on top and each newly added line
 * sits strictly below the previous ones, never above them. The offset side is
 * forced "down" the screen (to the right for vertical edges) and is shared by all
 * siblings (both directions), so the stack stays consistent.
 */
function autoControl(edge: Edge, from: Shape, to: Shape, siblings: Edge[]): Pt | null {
  if (siblings.length <= 1) return null;
  if (edge.from === undefined || edge.to === undefined) return null;
  const rank = siblings.findIndex((e) => e.id === edge.id);
  if (rank <= 0) return null; // first-created edge stays straight; others stack below

  const firstIsFrom = edge.from < edge.to;
  const ca = center(firstIsFrom ? from : to);
  const cb = center(firstIsFrom ? to : from);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const len = Math.hypot(dx, dy) || 1;
  let px = -dy / len;
  let py = dx / len;
  if (py < 0 || (py === 0 && px < 0)) {
    px = -px;
    py = -py;
  }
  const mx = (ca.x + cb.x) / 2;
  const my = (ca.y + cb.y) / 2;
  // control offset is ~2× the apex offset for a quadratic bezier
  const off = 2 * rank * LANE_GAP;
  return { x: mx + px * off, y: my + py * off };
}

/**
 * Geometry for an edge honoring (a) a manual bend (edge.cx/cy) or (b) the auto
 * parallel-edge fan. Label anchor (`mid`) always sits on the curve (t = 0.5);
 * the bend handle uses the control point for manual bends and `mid` for auto-curves.
 */
export function resolveEdgeGeometry(
  edges: Record<ID, Edge>,
  shapes: Record<ID, Shape>,
  edge: Edge,
): EdgeGeometry {
  const { from, to } = edgeEnds(shapes, edge);
  if (edge.cx !== undefined && edge.cy !== undefined) {
    return edgeGeometry(from, to, { x: edge.cx, y: edge.cy });
  }
  // auto-fan only applies between two shapes; free edges stay straight
  const ctrl =
    from.shape && to.shape
      ? autoControl(edge, from.shape, to.shape, pairSiblings(edges, edge))
      : null;
  return edgeGeometry(from, to, ctrl);
}

/** Where the bend handle is drawn / hit-tested for an edge. */
export function edgeBendHandle(edge: Edge, geo: EdgeGeometry): Pt {
  if (geo.ctrl && edge.cx !== undefined && edge.cy !== undefined) return geo.ctrl;
  return geo.mid;
}

/** Sentinel `fill`/`stroke` value meaning "no paint" — the shape renders as outline only. */
export const NO_FILL = "transparent";

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

export function numToHex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}

export function canvasLabelHex(): string {
  return numToHex(canvasLabelColor());
}

export function canvasLabelHexForTheme(theme: Theme): string {
  return theme === "light" ? numToHex(TEXT_DARK) : numToHex(TEXT_LIGHT);
}

/** Label colors paired with fills; their luminance is precomputed below. */
export const TEXT_DARK = 0x0f172a;
export const TEXT_LIGHT = 0xf1f5f9;

/** WCAG relative luminance of a 0xRRGGBB color (sRGB → linear, Rec. 709 weights). */
function relativeLuminance(n: number): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

const L_TEXT_DARK = relativeLuminance(TEXT_DARK);
const L_TEXT_LIGHT = relativeLuminance(TEXT_LIGHT);

function contrast(lA: number, lB: number): number {
  return (Math.max(lA, lB) + 0.05) / (Math.min(lA, lB) + 0.05);
}

/**
 * Pick the label color (dark or light) with the HIGHER WCAG contrast over the
 * given background, so every fill — preset or custom — gets the most readable
 * text rather than relying on a luminance threshold that can mis-pick mid-tones.
 */
export function canvasLabelColor(): number {
  return $theme.get() === "light" ? TEXT_DARK : TEXT_LIGHT;
}

export function readableText(bgHex: string): number {
  if (bgHex === NO_FILL) return $theme.get() === "light" ? TEXT_DARK : TEXT_LIGHT;
  const bg = relativeLuminance(hexToNumber(bgHex));
  return contrast(bg, L_TEXT_DARK) >= contrast(bg, L_TEXT_LIGHT) ? TEXT_DARK : TEXT_LIGHT;
}
