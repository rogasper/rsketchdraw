export interface TextEditOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  value: string;
  color: string;
  background: string;
  fontSize: number;
  /** match the rendered text weight (e.g. "500", "600") */
  fontWeight?: string;
  /** line height in px (already scaled for zoom), to match the rendered text */
  lineHeight?: number;
  align?: "left" | "center";
  /** grow with content instead of using a fixed width (text objects) */
  autoGrow?: boolean;
  padding?: number;
  /** strip the border/background/shadow so editing looks like the plain text itself */
  chromeless?: boolean;
  /** select all existing text on open (so typing overwrites) instead of placing the caret at the end */
  selectAll?: boolean;
  onInput: (v: string) => void;
  onCommit: (v: string) => void;
  onCancel: () => void;
}

/** A contenteditable overlay used for shape text and edge labels. */
export class TextEditor {
  /** outer wrapper — owns positioning, sizing, chrome, and flex centering */
  private el: HTMLDivElement | null = null;
  /** inner contenteditable — MUST be display:block so Enter can insert newlines.
   *  A contenteditable that is itself a flex container can't create new lines in
   *  Chromium/WebKit, so the flex centering lives on the wrapper, never here. */
  private input: HTMLDivElement | null = null;
  private opts: TextEditOptions | null = null;

  constructor(private root: HTMLElement) {}

  get active(): boolean {
    return !!this.el;
  }

  open(opts: TextEditOptions): void {
    this.remove();
    this.opts = opts;

    const el = document.createElement("div");
    el.className = "text-editor";
    Object.assign(el.style, {
      left: `${opts.x}px`,
      top: `${opts.y}px`,
      minHeight: `${opts.h}px`,
      background: opts.background,
    });
    if (opts.chromeless) {
      el.style.border = "none";
      el.style.background = "transparent";
      el.style.boxShadow = "none";
      el.style.borderRadius = "0";
    }
    if (opts.autoGrow) {
      // grow with content: drop the flex centering so the inner block flows
      // from the top-left and the wrapper hugs it.
      el.style.display = "block";
      el.style.width = "auto";
      el.style.minWidth = "8px";
    } else {
      el.style.width = `${opts.w}px`;
    }

    const input = document.createElement("div");
    input.className = "text-editor__input";
    input.contentEditable = "true";
    input.textContent = opts.value;
    Object.assign(input.style, {
      color: opts.color,
      fontSize: `${opts.fontSize}px`,
      textAlign: opts.align ?? "center",
    });
    if (opts.fontWeight != null) input.style.fontWeight = opts.fontWeight;
    if (opts.lineHeight != null) input.style.lineHeight = `${opts.lineHeight}px`;
    if (opts.padding != null) input.style.padding = `${opts.padding}px`;
    // autoGrow: keep everything on one line and grow horizontally (no wrap)
    if (opts.autoGrow) input.style.whiteSpace = "pre";

    // Read with innerText, not textContent: pressing Enter makes the browser
    // store the break as a <br>/<div> element, which textContent drops (it just
    // concatenates text nodes) — innerText renders those boundaries back to "\n"
    // so multi-line labels survive both the live preview and commit.
    input.addEventListener("input", () => this.opts?.onInput(input.innerText));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        // Cmd/Ctrl+Enter finishes editing, for keyboard users who don't want to
        // click away to commit.
        e.preventDefault();
        this.commit();
      } else if (e.key === "Enter") {
        // Plain Enter inserts a newline so multi-line labels are easy to type —
        // no Shift needed. The edit commits on blur (clicking away) or ⌘/Ctrl+↵.
        // insertText keeps the native undo stack and writes a literal "\n" that
        // round-trips through textContent under `white-space: pre-wrap`.
        e.preventDefault();
        document.execCommand("insertText", false, "\n");
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.cancel();
      }
      e.stopPropagation();
    });
    input.addEventListener("blur", () => this.commit());
    // Keep clicks inside the editor from reaching the canvas, which would
    // hit-test the shape and re-open editing — wiping the browser's native
    // double-click-to-select-word (and triple-click-to-select-all). We only
    // stop propagation, never preventDefault, so the native selection stands.
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.addEventListener("click", (e) => e.stopPropagation());
    el.addEventListener("dblclick", (e) => e.stopPropagation());

    el.appendChild(input);
    this.root.appendChild(el);
    this.el = el;
    this.input = input;
    requestAnimationFrame(() => {
      input.focus();
      const sel = window.getSelection();
      if (sel) {
        const r = document.createRange();
        r.selectNodeContents(input);
        if (!opts.selectAll) r.collapse(false); // caret at end unless we want everything selected
        sel.removeAllRanges();
        sel.addRange(r);
      }
    });
  }

  commit(): void {
    if (!this.input || !this.opts) return;
    // innerText (not textContent) so <br>/<div> line breaks become "\n" — see the
    // input listener in open() for why textContent would flatten to one line.
    const v = this.input.innerText;
    const cb = this.opts.onCommit;
    this.remove();
    cb(v);
  }

  private cancel(): void {
    if (!this.input || !this.opts) return;
    const cb = this.opts.onCancel;
    this.remove();
    cb();
  }

  private remove(): void {
    // Clear refs BEFORE detaching: removing a focused editor fires a synchronous
    // `blur`, whose handler re-enters commit()/remove(). Nulling first makes that
    // re-entrant call a no-op instead of trying to detach an already-removed node.
    const el = this.el;
    this.el = null;
    this.input = null;
    this.opts = null;
    el?.remove();
  }
}
