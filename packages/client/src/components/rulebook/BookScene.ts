import * as THREE from 'three';
import { SEG_U, SEG_V, angleFor, gutter, shapeLeaf, type LeafFrame, type LeafShape } from './leafShape';
import type { PageTextures } from './pageTextures';

// The rulebook as a real little booklet on a desk: two stacks of paper on cover boards, lit by a
// lamp that makes every lifted leaf cast a shadow. Pages are turned by hand: grab a page anywhere
// and drag it over the spine (where you hold it decides how it bends, see leafShape.ts), or click
// it and it turns by itself; a page turning by itself can be caught and dragged again.
// Page pictures come from PageTextures: 'cover', 'L<n>' / 'R<n>' = left / right page of spread n.

const W = 1; // page width (spine to edge)
const H = 1.195; // page height (the DOM pages are 528 × 631)
const LEAF_T = 0.0055; // thickness of one leaf in the stacks
const BOARD_T = 0.014; // the cover boards
const CLICK_MS = 260;
const CLICK_PX = 6;
const TOP_SEG_V = 4;
const PAPER = '#ecdfc2';
const BOARD = '#3a1d16';

type Side = 'left' | 'right';

interface Turn {
  from: number; // spread (-1 = the closed cover)
  to: number;
  dir: 1 | -1;
  shape: LeafShape;
  grabTo: { u: number; v: number }; // where the hand moved to (the shape follows it softly)
  mode: 'drag' | 'auto';
  // auto: a cubic from where it was to the target, leaving with the speed it had
  t0: number;
  dur: number;
  a0: number;
  v0: number;
  target: number;
  // drag
  pointer: number;
  downAt: number;
  downX: number;
  downY: number;
  moved: boolean;
}

export interface BookOptions {
  count: number;
  start: number;
  pages: PageTextures;
  onPage: (page: number) => void;
  onTurnStart: () => void;
  reducedMotion: boolean;
}

function solid(color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 4;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, 4, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The edge of a stack of paper: thin lines, one per leaf. */
function edgeTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e2d3b2';
  g.fillRect(0, 0, 8, 8);
  g.fillStyle = '#b9a47c';
  g.fillRect(0, 6, 8, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A stack of paper whose top dips into the binding: top (group 0, the page) + edges (group 1). */
function stackGeometry(sign: 1 | -1, height: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const xAt = (i: number) => (sign * i * W) / SEG_U;
  const topAt = (i: number) => height - gutter(xAt(i), W, height);
  // top: a grid
  for (let j = 0; j <= TOP_SEG_V; j++) {
    for (let i = 0; i <= SEG_U; i++) {
      pos.push(xAt(i), topAt(i), (j / TOP_SEG_V - 0.5) * H);
      uv.push(sign > 0 ? i / SEG_U : 1 - i / SEG_U, 1 - j / TOP_SEG_V);
    }
  }
  const row = SEG_U + 1;
  for (let j = 0; j < TOP_SEG_V; j++) {
    for (let i = 0; i < SEG_U; i++) {
      const a = j * row + i;
      if (sign > 0) idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
      else idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const topCount = idx.length;
  // edges: front and back strips along the profile, and the outer side
  const strip = (z: number) => {
    const base = pos.length / 3;
    for (let i = 0; i <= SEG_U; i++) {
      pos.push(xAt(i), topAt(i), z, xAt(i), 0, z);
      uv.push(i / SEG_U, topAt(i) / LEAF_T, i / SEG_U, 0);
    }
    for (let i = 0; i < SEG_U; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  };
  strip(H / 2);
  strip(-H / 2);
  const o = pos.length / 3;
  const x = sign * W;
  pos.push(x, height, -H / 2, x, 0, -H / 2, x, height, H / 2, x, 0, H / 2);
  uv.push(0, height / LEAF_T, 0, 0, 1, height / LEAF_T, 1, 0);
  idx.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.addGroup(0, topCount, 0);
  geo.addGroup(topCount, idx.length - topCount, 1);
  geo.computeVertexNormals();
  return geo;
}

function leafGeometry(): THREE.BufferGeometry {
  const row = SEG_U + 1;
  const n = row * (SEG_V + 1);
  const uv = new Float32Array(n * 2);
  const idx: number[] = [];
  for (let j = 0; j <= SEG_V; j++) {
    for (let i = 0; i <= SEG_U; i++) {
      const k = j * row + i;
      uv[k * 2] = i / SEG_U;
      uv[k * 2 + 1] = 1 - j / SEG_V;
      if (i < SEG_U && j < SEG_V) idx.push(k, k + row, k + 1, k + 1, k + row, k + row + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  // both faces over the same triangles: the front (right page) and the back (next left page)
  geo.addGroup(0, idx.length, 0);
  geo.addGroup(0, idx.length, 1);
  return geo;
}

const hermite = (p0: number, v0: number, p1: number, t: number) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * v0 + (-2 * t3 + 3 * t2) * p1;
};

export class BookScene {
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
  private paper = solid(PAPER);
  private edge = edgeTexture();
  private mats = {
    left: new THREE.MeshLambertMaterial({ map: this.paper, side: THREE.DoubleSide }),
    right: new THREE.MeshLambertMaterial({ map: this.paper, side: THREE.DoubleSide }),
    edge: new THREE.MeshLambertMaterial({ map: this.edge, side: THREE.DoubleSide }),
    front: new THREE.MeshLambertMaterial({ map: this.paper, side: THREE.FrontSide, shadowSide: THREE.DoubleSide }),
    back: new THREE.MeshLambertMaterial({ map: this.paper, side: THREE.BackSide, shadowSide: THREE.DoubleSide }),
    board: new THREE.MeshLambertMaterial({ color: BOARD }),
  };
  private backMap: THREE.Texture | null = null; // the back face shows its page mirrored
  private stacks: Record<Side, THREE.Mesh>;
  private heights: Record<Side, number> = { left: 0, right: 0 };
  private boards: Record<Side, THREE.Mesh>;
  private leaf: THREE.Mesh;
  private leafPos: THREE.BufferAttribute;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private page: number; // the open spread; -1 = closed
  private turn: Turn | null = null;
  private queued: number | null = null;
  private dirty = true;
  private raf = 0;
  private last = performance.now();
  private resize: ResizeObserver;

  constructor(
    private host: HTMLElement,
    private o: BookOptions,
  ) {
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.domElement.className = 'rb-canvas';
    host.appendChild(r.domElement);

    // the lamp: up front and to the left, so a lifted leaf throws its shadow over the right page
    const lamp = new THREE.DirectionalLight('#fff4e0', 2.0);
    lamp.position.set(-1.1, 3.2, 1.5);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    const sc = lamp.shadow.camera;
    sc.left = -1.6;
    sc.right = 1.6;
    sc.top = 1.6;
    sc.bottom = -1.6;
    sc.near = 0.5;
    sc.far = 8;
    lamp.shadow.bias = -0.0004;
    lamp.shadow.normalBias = 0.012;
    lamp.shadow.radius = 4;
    this.scene.add(lamp, new THREE.AmbientLight('#fff1dc', 1.4));

    // where the booklet rests: only its shadow shows, over the blurred table
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.45 }));
    desk.rotation.x = -Math.PI / 2;
    desk.position.y = -BOARD_T;
    desk.receiveShadow = true;
    this.scene.add(desk);

    const board = (side: Side) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(W * 1.035, BOARD_T, H * 1.05), this.mats.board);
      m.position.set(side === 'right' ? W * 0.5175 : -W * 0.5175, -BOARD_T / 2, 0);
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    this.boards = { left: board('left'), right: board('right') };

    const stack = (side: Side) => {
      const m = new THREE.Mesh(stackGeometry(side === 'right' ? 1 : -1, 0.001), [this.mats[side], this.mats.edge]);
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    this.stacks = { left: stack('left'), right: stack('right') };

    const geo = leafGeometry();
    this.leafPos = geo.getAttribute('position') as THREE.BufferAttribute;
    this.leaf = new THREE.Mesh(geo, [this.mats.front, this.mats.back]);
    this.leaf.castShadow = this.leaf.receiveShadow = true;
    this.leaf.frustumCulled = false;
    this.leaf.visible = false;
    this.scene.add(this.leaf);

    this.page = -1;
    this.heights = { left: 0, right: this.rightCount(o.start) * LEAF_T };

    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();

    const el = r.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    o.pages.paused = () => this.turn !== null;

    // the cover opens by itself when the booklet comes up (and can be caught like any page)
    o.pages.want(['cover', `R${o.start}`, `L${o.start}`]);
    this.startTurn(-1, o.start, { u: 0.92, v: 0.82 }, 'auto', 0.25);
    this.loop();
  }

  // ---- layout -------------------------------------------------------------------------------

  private fit() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const cam = this.camera;
    cam.aspect = w / h;
    const tilt = 0.36; // from straight above, toward you
    // as close as it can be with the whole booklet (boards included) in view
    const corners = [-1, 1].flatMap((x) => [-1, 1].map((z) => new THREE.Vector3(x * W * 1.04, 0, z * H * 0.53)));
    const place = (d: number) => {
      cam.position.set(0, Math.cos(tilt) * d, Math.sin(tilt) * d + 0.06);
      cam.lookAt(0, 0, 0.06);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
    };
    let lo = 1;
    let hi = 12;
    for (let k = 0; k < 24; k++) {
      const d = (lo + hi) / 2;
      place(d);
      const fits = corners.every((c) => {
        const p = c.clone().project(cam);
        return Math.abs(p.x) < 0.97 && Math.abs(p.y) < 0.95;
      });
      if (fits) hi = d;
      else lo = d;
    }
    place(hi);
    cam.updateProjectionMatrix();
    this.dirty = true;
    // page pictures about as sharp as the page on screen (sharper only blurs when minified)
    const a = this.screenOf('right', 0, 0.5);
    const b = this.screenOf('right', 1, 0.5);
    this.o.pages.ratio = Math.min(2.5, Math.max(1, (Math.abs(b.x - a.x) * Math.min(devicePixelRatio, 2) * 1.15) / 528));
  }

  private leftCount(p: number) {
    return p < 0 ? 0 : p + 1;
  }

  private rightCount(p: number) {
    return this.o.count - Math.max(0, p);
  }

  // ---- what each surface shows --------------------------------------------------------------

  private show(mat: THREE.MeshLambertMaterial, key: string | null) {
    const t = key ? this.o.pages.get(key) : null;
    const map = t ?? this.paper;
    if (mat.map !== map) {
      mat.map = map;
      mat.needsUpdate = true;
    }
  }

  /** Puts the right pictures on the stacks and the leaf (also when a picture gets ready). */
  refresh(): void {
    const t = this.turn;
    let left: string | null;
    let right: string | null;
    if (!t) {
      left = this.page >= 0 ? `L${this.page}` : null;
      right = `R${Math.max(0, this.page)}`;
    } else if (t.dir > 0) {
      left = t.from >= 0 ? `L${t.from}` : null;
      right = `R${t.to}`;
    } else {
      left = `L${t.to}`;
      right = `R${t.from}`;
    }
    this.show(this.mats.left, left);
    this.show(this.mats.right, right);
    this.stacks.left.visible = this.boards.left.visible = left !== null || (t?.from ?? 0) >= 0;
    if (t) {
      const front = t.dir > 0 ? (t.from < 0 ? 'cover' : `R${t.from}`) : `R${t.to}`;
      const back = t.dir > 0 ? `L${t.to}` : `L${t.from}`;
      this.show(this.mats.front, front);
      const tex = this.o.pages.get(back);
      if (tex && this.backMap?.source !== tex.source) {
        this.backMap?.dispose();
        this.backMap = tex.clone();
        this.backMap.repeat.x = -1;
        this.backMap.offset.x = 1;
        this.backMap.needsUpdate = true;
      }
      const map = tex && this.backMap ? this.backMap : this.paper;
      if (this.mats.back.map !== map) {
        this.mats.back.map = map;
        this.mats.back.needsUpdate = true;
      }
    }
    this.dirty = true;
  }

  // ---- turning ------------------------------------------------------------------------------

  /** Turns to a spread (arrows, tabs): the leaf goes over by itself, as if taken by its corner. */
  go(to: number): void {
    const target = Math.max(0, Math.min(this.o.count - 1, to));
    if (this.turn) {
      if (this.turn.mode === 'auto') this.queued = target;
      return;
    }
    if (target === this.page || this.page < 0) return;
    this.startTurn(this.page, target, { u: 0.93, v: 0.8 }, 'auto');
  }

  private startTurn(from: number, to: number, grab: { u: number; v: number }, mode: Turn['mode'], delay = 0) {
    const dir = to > from ? 1 : -1;
    const startA = dir > 0 ? 0 : Math.PI;
    this.turn = {
      from,
      to,
      dir,
      shape: { angle: startA, omega: 0, grabU: grab.u, grabV: grab.v, rigid: from < 0 },
      grabTo: grab,
      mode,
      t0: performance.now() + delay * 1000,
      dur: 0,
      a0: startA,
      v0: 0,
      target: startA,
      pointer: -1,
      downAt: 0,
      downX: 0,
      downY: 0,
      moved: false,
    };
    if (mode === 'auto') this.release(Math.PI - startA, delay);
    const keys = dir > 0 ? [`R${to}`, `L${to}`] : [`L${to}`, `R${to}`];
    this.o.pages.want(keys);
    this.leaf.visible = true;
    this.refresh();
  }

  /** Lets the leaf go: it falls to `target` (π = over to the left), keeping the speed it had. */
  private release(target: number, delay = 0) {
    const t = this.turn!;
    t.mode = 'auto';
    t.a0 = t.shape.angle;
    t.v0 = t.shape.omega;
    t.target = target;
    t.t0 = performance.now() + delay * 1000;
    t.dur = this.o.reducedMotion ? 0.001 : 0.3 + (0.55 * Math.abs(target - t.a0)) / Math.PI;
    if (target !== (t.dir > 0 ? 0 : Math.PI)) this.o.onTurnStart();
  }

  private finish() {
    const t = this.turn!;
    const done = t.target === (t.dir > 0 ? Math.PI : 0);
    this.turn = null;
    this.leaf.visible = false;
    if (done) {
      this.page = t.to;
      this.o.onPage(t.to);
    } else if (t.from >= 0) this.page = t.from;
    this.refresh();
    const p = Math.max(0, this.page);
    this.o.pages.want([p + 1, p - 1].filter((n) => n >= 0 && n < this.o.count).flatMap((n) => [`R${n}`, `L${n}`]));
    if (this.page < 0) this.startTurn(-1, this.o.start, { u: 0.92, v: 0.82 }, 'auto', 0.4);
    else if (this.queued !== null) {
      const q = this.queued;
      this.queued = null;
      this.go(q);
    }
  }

  // ---- pointer ------------------------------------------------------------------------------

  private aim(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  /** What's under the pointer: the moving leaf, or the top page of a stack (as leaf coordinates). */
  private pick(): { what: 'leaf' | Side; u: number; v: number } | null {
    const hits = this.raycaster.intersectObjects(
      [this.leaf, this.stacks.left, this.stacks.right].filter((m) => m.visible),
      false,
    );
    for (const h of hits) {
      if (!h.uv) continue;
      if (h.object === this.leaf) return { what: 'leaf', u: h.uv.x, v: 1 - h.uv.y };
      if (h.face && h.face.materialIndex !== 0) continue; // the edge of the stack
      const side: Side = h.object === this.stacks.left ? 'left' : 'right';
      // leaf coordinates count from the spine
      return { what: side, u: side === 'left' ? 1 - h.uv.x : h.uv.x, v: 1 - h.uv.y };
    }
    return null;
  }

  private grabbable(hit: ReturnType<BookScene['pick']>) {
    if (!hit) return false;
    if (hit.what === 'leaf') return true;
    if (this.turn || this.page < 0) return false;
    return hit.what === 'right' ? this.page < this.o.count - 1 : this.page > 0;
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.aim(e);
    const hit = this.pick();
    if (!hit || !this.grabbable(hit)) return;
    if (hit.what === 'leaf') {
      // catch the leaf that is turning: it is now held where you took it
      this.turn!.mode = 'drag';
      this.turn!.grabTo = { u: hit.u, v: hit.v };
    } else {
      const to = hit.what === 'right' ? this.page + 1 : this.page - 1;
      this.startTurn(this.page, to, { u: hit.u, v: hit.v }, 'drag');
    }
    const t = this.turn!;
    t.pointer = e.pointerId;
    t.downAt = performance.now();
    t.downX = e.clientX;
    t.downY = e.clientY;
    t.moved = hit.what === 'leaf'; // catching a moving leaf is never a click
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.renderer.domElement.style.cursor = 'grabbing';
  };

  private dragX = 0;

  private onMove = (e: PointerEvent) => {
    this.aim(e);
    const t = this.turn;
    if (t && t.mode === 'drag' && e.pointerId === t.pointer) {
      if (Math.hypot(e.clientX - t.downX, e.clientY - t.downY) > CLICK_PX) t.moved = true;
      const p = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.heights.right), new THREE.Vector3());
      if (p) this.dragX = p.x;
      this.dirty = true;
      return;
    }
    this.renderer.domElement.style.cursor = this.grabbable(this.pick()) ? 'grab' : '';
  };

  private onUp = (e: PointerEvent) => {
    const t = this.turn;
    if (!t || t.mode !== 'drag' || e.pointerId !== t.pointer) return;
    this.renderer.domElement.style.cursor = '';
    const over = t.dir > 0 ? Math.PI : 0;
    const back = Math.PI - over;
    const quick = !t.moved && performance.now() - t.downAt < CLICK_MS;
    if (quick) {
      this.release(over); // a click: it turns by itself from where you took it
      return;
    }
    // a flick decides; otherwise whichever side of the spine it is on
    const fling = t.shape.omega;
    if (Math.abs(fling) > 3) this.release(fling > 0 ? Math.PI : 0);
    else this.release(t.shape.angle > Math.PI / 2 ? Math.PI : 0);
    if (t.target === back) t.dur *= 0.8;
  };

  // ---- frame --------------------------------------------------------------------------------

  private frame(): LeafFrame {
    return { w: W, h: H, rightTop: this.heights.right, leftTop: this.heights.left };
  }

  private step(dt: number) {
    // the stacks settle to their size
    const t = this.turn;
    const lc = t ? (t.dir > 0 ? this.leftCount(t.from) : this.leftCount(t.to)) : this.leftCount(this.page);
    const rc = t ? (t.dir > 0 ? this.rightCount(t.to) : this.rightCount(t.from)) : this.rightCount(this.page);
    for (const [side, n] of [['left', lc], ['right', rc]] as const) {
      const goal = n * LEAF_T;
      const h = this.heights[side];
      if (Math.abs(goal - h) < 1e-5) continue;
      this.heights[side] = h + (goal - h) * Math.min(1, dt * 8);
      const m = this.stacks[side];
      m.geometry.dispose();
      m.geometry = stackGeometry(side === 'right' ? 1 : -1, Math.max(0.001, this.heights[side]));
      this.dirty = true;
    }
    if (!t) return;

    const s = t.shape;
    // the hand moves along the leaf softly when you catch it somewhere else
    const k = Math.min(1, dt * 10);
    s.grabU += (t.grabTo.u - s.grabU) * k;
    s.grabV += (t.grabTo.v - s.grabV) * k;
    const prev = s.angle;
    if (t.mode === 'drag') {
      const goal = angleFor(this.dragX, s, this.frame());
      s.angle += (goal - s.angle) * Math.min(1, dt * 18);
    } else {
      const now = performance.now();
      if (now < t.t0) {
        this.dirty = true;
        return;
      }
      const u = Math.min(1, (now - t.t0) / 1000 / t.dur);
      s.angle = Math.max(0, Math.min(Math.PI, hermite(t.a0, t.v0 * t.dur, t.target, u)));
      if (u >= 1) {
        this.finish();
        return;
      }
    }
    s.omega += ((s.angle - prev) / Math.max(dt, 1e-3) - s.omega) * Math.min(1, dt * 12);
    shapeLeaf(s, this.frame(), this.leafPos.array as Float32Array);
    this.leafPos.needsUpdate = true;
    this.leaf.geometry.computeVertexNormals();
    this.leaf.geometry.computeBoundingSphere();
    this.dirty = true;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    if (!this.dirty) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
  };

  /** For tests: where things are. */
  debug() {
    const t = this.turn;
    return { page: this.page, turning: t ? { from: t.from, to: t.to, mode: t.mode, angle: t.shape.angle } : null };
  }

  /** For tests: the screen point (px, relative to the canvas) of a page point. */
  screenOf(side: Side, u: number, v: number) {
    const x = side === 'right' ? u * W : -u * W;
    const p = new THREE.Vector3(x, this.heights[side], (v - 0.5) * H).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onUp);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of Object.values(this.mats)) m.dispose();
    this.paper.dispose();
    this.edge.dispose();
    this.backMap?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
  }
}
