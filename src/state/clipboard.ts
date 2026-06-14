import { scene } from "../render/scene";
import { uid } from "../util";
import { deleteSelection } from "./actions";
import { $selection, bumpRevision, doc, setSelection } from "./store";
import type { Edge, Shape } from "./types";

const PASTE_OFFSET = 24;

let clipShapes: Shape[] = [];
let clipEdges: Edge[] = [];
let pasteCount = 0;

/** Copy selected shapes (and edges whose both ends are selected) to the clipboard. */
export function copySelection(): void {
  const sel = $selection.get();
  const shapes: Shape[] = [];
  for (const id of sel.shapes) {
    const s = doc.board.shapes[id];
    if (s) shapes.push({ ...s });
  }
  if (!shapes.length) return;
  const ids = new Set(shapes.map((s) => s.id));
  const edges: Edge[] = [];
  for (const e of Object.values(doc.board.edges)) {
    if (ids.has(e.from) && ids.has(e.to)) edges.push({ ...e });
  }
  clipShapes = shapes;
  clipEdges = edges;
  pasteCount = 0;
}

export function cutSelection(): void {
  if (!$selection.get().shapes.size) return;
  copySelection();
  deleteSelection();
}

/** Paste a fresh copy of the clipboard, cascaded so repeats don't stack exactly. */
export function pasteClipboard(): void {
  if (!clipShapes.length) return;
  pasteCount++;
  const d = PASTE_OFFSET * pasteCount;

  const idMap = new Map<string, string>();
  const newShapeIds: string[] = [];
  for (const s of clipShapes) {
    const nid = uid();
    idMap.set(s.id, nid);
    doc.board.shapes[nid] = { ...s, id: nid, x: s.x + d, y: s.y + d };
    doc.board.order.push(nid);
    scene.addNode(nid);
    newShapeIds.push(nid);
  }

  const newEdgeIds: string[] = [];
  for (const e of clipEdges) {
    const from = idMap.get(e.from);
    const to = idMap.get(e.to);
    if (!from || !to) continue;
    const nid = uid();
    const clone: Edge = { ...e, id: nid, from, to };
    if (clone.cx !== undefined) clone.cx += d;
    if (clone.cy !== undefined) clone.cy += d;
    doc.board.edges[nid] = clone;
    scene.addEdge(nid);
    newEdgeIds.push(nid);
  }

  setSelection(newShapeIds, newEdgeIds);
  bumpRevision();
}

export function hasClipboard(): boolean {
  return clipShapes.length > 0;
}
