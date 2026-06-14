import { type IconDef, searchIcons } from "../render/icons";

const MAX_ROWS = 8;

/** The "/" command palette for dropping preset icons onto the canvas. */
export class IconPalette {
  private el: HTMLDivElement | null = null;
  private input!: HTMLInputElement;
  private listEl!: HTMLDivElement;
  private results: IconDef[] = [];
  private index = 0;

  constructor(
    private root: HTMLElement,
    private onPick: (key: string) => void,
  ) {}

  get active(): boolean {
    return !!this.el;
  }

  open(prefill = ""): void {
    if (this.el) return;
    const el = document.createElement("div");
    el.className = "icon-palette";
    el.innerHTML = `
      <input class="icon-palette__input" placeholder="Search icons…" spellcheck="false" />
      <div class="icon-palette__list"></div>
      <div class="icon-palette__hint">↑↓ navigate &middot; Enter insert &middot; Esc cancel</div>`;
    this.root.appendChild(el);
    this.el = el;
    this.input = el.querySelector(".icon-palette__input") as HTMLInputElement;
    this.listEl = el.querySelector(".icon-palette__list") as HTMLDivElement;
    this.input.value = prefill;
    this.input.addEventListener("input", () => this.refresh());
    this.input.addEventListener("keydown", (e) => this.onKey(e));
    this.refresh();
    requestAnimationFrame(() => this.input.focus());
  }

  private refresh(): void {
    this.results = searchIcons(this.input.value);
    this.index = 0;
    this.render();
  }

  private render(): void {
    this.listEl.innerHTML = "";
    const rows = this.results.slice(0, MAX_ROWS);
    rows.forEach((icon, i) => {
      const row = document.createElement("div");
      row.className = "icon-row" + (i === this.index ? " is-active" : "");
      row.innerHTML = `<span class="icon-row__key">${icon.key}</span><span class="icon-row__kw">${icon.keywords.slice(0, 3).join(", ")}</span>`;
      row.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.pick(icon.key);
      });
      this.listEl.appendChild(row);
    });
    if (rows.length === 0) {
      this.listEl.innerHTML = `<div class="icon-row icon-row--empty">No matches</div>`;
    }
  }

  private onKey(e: KeyboardEvent): void {
    const max = Math.min(this.results.length, MAX_ROWS);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.index = Math.min(this.index + 1, max - 1);
      this.render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.index = Math.max(this.index - 1, 0);
      this.render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const icon = this.results[this.index];
      if (icon) this.pick(icon.key);
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    }
    e.stopPropagation();
  }

  private pick(key: string): void {
    this.close();
    this.onPick(key);
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
