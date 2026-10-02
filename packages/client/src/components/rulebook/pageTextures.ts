import * as THREE from 'three';
import { rasterize } from './rasterize';

// Pictures of the booklet's pages, made on demand from their DOM (kept offscreen) and turned into
// textures. Only the pages around the open spread are kept on the GPU; the rest are made again if
// you come back to them. Work waits while a page is being turned, so the turn never stutters.

const KEEP = 12;

export class PageTextures {
  private ready = new Map<string, THREE.CanvasTexture>();
  private queue: string[] = [];
  private running = false;
  private disposed = false;
  private used: string[] = []; // least recently wanted first
  paused = () => false;
  ratio = 1.5; // picture pixels per CSS pixel of the page

  constructor(
    private root: HTMLElement,
    private onReady: (key: string) => void,
    private anisotropy = 4,
  ) {}

  /** The texture for a page, or null if it isn't made yet (it is queued). */
  get(key: string): THREE.Texture | null {
    this.touch(key);
    const t = this.ready.get(key);
    if (!t) this.want([key]);
    return t ?? null;
  }

  has(key: string): boolean {
    return this.ready.has(key);
  }

  /** Make these first (in this order). */
  want(keys: string[]): void {
    const fresh = keys.filter((k) => !this.ready.has(k));
    this.queue = [...fresh, ...this.queue.filter((k) => !fresh.includes(k))];
    for (const k of keys) this.touch(k);
    void this.run();
  }

  private touch(key: string) {
    this.used = [...this.used.filter((k) => k !== key), key];
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length && !this.disposed) {
        if (this.paused()) {
          await new Promise((r) => setTimeout(r, 80));
          continue;
        }
        const key = this.queue.shift()!;
        if (this.ready.has(key)) continue;
        const node = this.root.querySelector<HTMLElement>(`[data-key="${key}"] > *`);
        if (!node) continue;
        try {
          const canvas = await rasterize(node, this.ratio);
          if (this.disposed) return;
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = this.anisotropy;
          this.ready.set(key, tex);
          this.evict();
          this.onReady(key);
        } catch (err) {
          console.warn('[rulebook] could not draw page', key, err);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private evict() {
    const keep = new Set(this.used.slice(-KEEP));
    for (const [k, t] of this.ready) {
      if (keep.has(k)) continue;
      t.dispose();
      this.ready.delete(k);
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const t of this.ready.values()) t.dispose();
    this.ready.clear();
  }
}
