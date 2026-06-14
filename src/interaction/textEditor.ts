export interface TextEditOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  value: string;
  color: string;
  background: string;
  fontSize: number;
  align?: "left" | "center";
  /** grow with content instead of using a fixed width (text objects) */
  autoGrow?: boolean;
  padding?: number;
  onInput: (v: string) => void;
  onCommit: (v: string) => void;
  onCancel: () => void;
}

/** A single contenteditable overlay used for shape text and edge labels. */
export class TextEditor {
  private el: HTMLDivElement | null = null;
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
    el.contentEditable = "true";
    el.textContent = opts.value;
    Object.assign(el.style, {
      left: `${opts.x}px`,
      top: `${opts.y}px`,
      minHeight: `${opts.h}px`,
      color: opts.color,
      background: opts.background,
      fontSize: `${opts.fontSize}px`,
      textAlign: opts.align ?? "center",
    });
    if (opts.padding != null) el.style.padding = `${opts.padding}px`;
    if (opts.autoGrow) {
      el.style.display = "block";
      el.style.whiteSpace = "pre";
      el.style.width = "auto";
      el.style.minWidth = "8px";
    } else {
      el.style.width = `${opts.w}px`;
    }
    el.addEventListener("input", () => this.opts?.onInput(el.textContent ?? ""));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.cancel();
      }
      e.stopPropagation();
    });
    el.addEventListener("blur", () => this.commit());
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.root.appendChild(el);
    this.el = el;
    requestAnimationFrame(() => {
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    });
  }

  commit(): void {
    if (!this.el || !this.opts) return;
    const v = this.el.textContent ?? "";
    const cb = this.opts.onCommit;
    this.remove();
    cb(v);
  }

  private cancel(): void {
    if (!this.el || !this.opts) return;
    const cb = this.opts.onCancel;
    this.remove();
    cb();
  }

  private remove(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
      this.opts = null;
    }
  }
}
