import { deleteBoard, listBoards, saveBoard } from "../persistence/db";
import { emptyBoard, $theme, type Theme } from "../state/store";
import type { BoardMeta } from "../state/types";
import type { MountedView } from "./editor";
import { clear, h } from "./dom";
import { navigate } from "./nav";

function formatDate(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  const min = 60_000;
  if (diff < min) return "just now";
  if (diff < 60 * min) return `${Math.round(diff / min)}m ago`;
  if (diff < 24 * 60 * min) return `${Math.round(diff / (60 * min))}h ago`;
  return d.toLocaleDateString();
}

export async function mountDashboard(appRoot: HTMLElement): Promise<MountedView> {
  clear(appRoot);

  const themeBtn = h("button", {
    class: "btn btn--icon",
    title: "Toggle theme",
    onclick: () => $theme.set($theme.get() === "dark" ? "light" : "dark"),
  });
  const syncTheme = (t: Theme) => {
    themeBtn.innerHTML = t === "dark"
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
  };
  syncTheme($theme.get());
  $theme.subscribe(syncTheme);

  const newBtn = h(
    "button",
    { class: "btn btn--accent", onclick: () => createBoard() },
    "+ New board",
  );

  const header = h(
    "header",
    { class: "dash__header" },
    h(
      "div",
      { class: "dash__brand" },
      h("span", { class: "dash__logo" }),
      h("h1", null, "Sketch Lab"),
    ),
    themeBtn,
    newBtn,
  );

  const grid = h("div", { class: "dash__grid" });
  const root = h("div", { class: "dash" }, header, grid);
  appRoot.appendChild(root);

  async function createBoard(): Promise<void> {
    const board = emptyBoard("Untitled board");
    await saveBoard(board);
    navigate(`#/board/${board.id}`);
  }

  async function refresh(): Promise<void> {
    const boards = await listBoards();
    clear(grid);
    if (boards.length === 0) {
      grid.appendChild(
        h(
          "div",
          { class: "dash__empty" },
          h("p", null, "No boards yet."),
          h(
            "button",
            { class: "btn btn--accent", onclick: () => createBoard() },
            "Create your first board",
          ),
        ),
      );
      return;
    }
    for (const meta of boards) grid.appendChild(card(meta));
  }

  function card(meta: BoardMeta): HTMLElement {
    const thumb = meta.thumbnail
      ? h("img", { class: "card__thumb", src: meta.thumbnail, alt: "" })
      : h("div", { class: "card__thumb card__thumb--empty" }, "✎");

    const del = h(
      "button",
      {
        class: "card__delete",
        title: "Delete board",
        onclick: async (e: Event) => {
          e.stopPropagation();
          if (confirm(`Delete "${meta.name}"? This cannot be undone.`)) {
            await deleteBoard(meta.id);
            await refresh();
          }
        },
      },
      "🗑",
    );

    return h(
      "div",
      { class: "card", onclick: () => navigate(`#/board/${meta.id}`) },
      thumb,
      del,
      h(
        "div",
        { class: "card__meta" },
        h("div", { class: "card__name" }, meta.name),
        h(
          "div",
          { class: "card__sub" },
          `${meta.shapeCount} shape${meta.shapeCount === 1 ? "" : "s"} · ${formatDate(meta.updatedAt)}`,
        ),
      ),
    );
  }

  void refresh();

  return {
    destroy() {
      clear(appRoot);
    },
  };
}
