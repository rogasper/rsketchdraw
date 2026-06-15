import { scene } from "../render/scene";
import { uid } from "../util";
import { deleteSelection } from "./actions";
import { $selection, bumpRevision, doc, setSelection } from "./store";
import type { Edge, Shape } from "./types";

const PASTE_OFFSET = 24;

let clipShapes: Shape[] = [];
let clipEdges: Edge[] = [];
let pasteCount = 0;

/**
 * Copy the current selection to the clipboard: every selected shape, plus every
 * edge that is either explicitly selected or fully spanned by the selected shapes
 * (so duplicating a subgraph keeps its internal connectors).
 */
export function copySelection(): void {
  const sel = $selection.get();
  const shapes: Shape[] = [];
  for (const id of sel.shapes) {
    const s = doc.board.shapes[id];
    if (s) shapes.push({ ...s });
  }
  const ids = new Set(shapes.map((s) => s.id));
  const edges: Edge[] = [];
  for (const e of Object.values(doc.board.edges)) {
    const spanned = ids.has(e.from) && ids.has(e.to);
    if (sel.edges.has(e.id) || spanned) edges.push({ ...e });
  }
  if (!shapes.length && !edges.length) return;
  clipShapes = shapes;
  clipEdges = edges;
  pasteCount = 0;
}

export function cutSelection(): void {
  const sel = $selection.get();
  if (!sel.shapes.size && !sel.edges.size) return;
  copySelection();
  deleteSelection();
}

/** Paste a fresh copy of the clipboard, cascaded so repeats don't stack exactly. */
export function pasteClipboard(): void {
  if (!clipShapes.length && !clipEdges.length) return;
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
    // an endpoint resolves to its pasted copy, or — for a standalone edge whose
    // endpoints weren't copied — back onto the original shape if it still exists.
    const fromCopied = idMap.has(e.from);
    const toCopied = idMap.has(e.to);
    const from = fromCopied ? idMap.get(e.from)! : doc.board.shapes[e.from] ? e.from : undefined;
    const to = toCopied ? idMap.get(e.to)! : doc.board.shapes[e.to] ? e.to : undefined;
    if (!from || !to) continue;
    const nid = uid();
    const clone: Edge = { ...e, id: nid, from, to };
    // only shift a manual bend when both endpoints also moved by d, so an edge
    // re-attached to existing shapes keeps its shape relative to them.
    if (fromCopied && toCopied) {
      if (clone.cx !== undefined) clone.cx += d;
      if (clone.cy !== undefined) clone.cy += d;
    }
    doc.board.edges[nid] = clone;
    scene.addEdge(nid);
    newEdgeIds.push(nid);
  }

  setSelection(newShapeIds, newEdgeIds);
  bumpRevision();
}

export function hasClipboard(): boolean {
  return clipShapes.length > 0 || clipEdges.length > 0;
}
