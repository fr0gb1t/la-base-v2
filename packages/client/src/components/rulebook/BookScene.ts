import * as THREE from 'three';
import { SEG_U, SEG_V, angleFor, gutter, shapeLeaf, type LeafFrame, type LeafShape } from './leafShape';
import type { PageTextures } from './pageTextures';
import { buildLamp, buildRoom } from '../../table3d/table';
import { makePost } from '../../table3d/post';
import { TABLE_Y } from '../../table3d/seats';

// The rulebook as a real little booklet lying on the game table, under the same hanging lamp and
// through the same post-processing as the menus: two stacks of paper on cover boards, every lifted
// leaf casting its shadow, index tabs sticking out of the leaves. Pages are turned by hand: grab a page anywhere
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
const SCALE = 0.19; // a page is 19 cm wide on the table
const TAB_OUT = 0.15; // how far an index tab sticks out of its leaf (× page width)
const TAB_IN = 0.02; // and how much of it is tucked under the leaf
const EXPOSURE = 0.95; // as the menus: paper right under the lamp stays paper-coloured
const ALBEDO = 0.5; // the lamp is strong at arm's length: paper this bright reads as paper, not as a light
const CAM_IN = 0.7; // s for the camera to come down to the booklet

type Side = 'left' | 'right';

/** One physical leaf (a mesh with its own two faces): several can be in the air at once. */
interface Leaf {
  mesh: THREE.Mesh;
  pos: THREE.BufferAttribute;
  front: THREE.MeshLambertMaterial;
  back: THREE.MeshLambertMaterial;
  backMap: THREE.Texture | null; // the back face shows its page mirrored
}

interface Turn {
  leaf: Leaf;
  posed: boolean; // a leaf waiting to start has been shaped once
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

const FADE_S = 0.5; // the room fades in
const LAND_S = 0.8; // s the booklet takes to come down onto the table
const FOLLOW_S = 0.09; // a leaf started while others are in the air follows this far behind
const REVEAL_MAX_MS = 2500; // never keep you waiting longer than this for the pictures

export interface BookOptions {
  count: number;
  tabs: string[]; // the label of each chapter's index tab
  start: number;
  pages: PageTextures;
  onPage: (page: number) => void;
  onTurnStart: () => void;
  onReveal?: () => void; // the booklet comes into view (its first pages are ready)
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

/** An index tab: a slip of card with the chapter's name (the open chapter's in oxblood). */
function tabTexture(label: string, on: boolean) {
  const c = document.createElement('canvas');
  c.width = 288;
  c.height = 112;
  const g = c.getContext('2d')!;
  g.fillStyle = on ? '#602217' : '#dccaa4';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(20, 14, 12, 0.55)';
  g.lineWidth = 4;
  g.strokeRect(2, 2, c.width - 4, c.height - 4);
  g.fillStyle = on ? '#ecdfc2' : '#2a1d16';
  g.font = '44px "IM Fell English SC", Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, c.width / 2, c.height / 2 + 3, c.width - 24);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const hermite = (p0: number, v0: number, p1: number, t: number) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * v0 + (-2 * t3 + 3 * t2) * p1;
};

export class BookScene {
  private renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.03, 30);
  private post = makePost(this.renderer, 1080);
  private lamp: ReturnType<typeof buildLamp>;
  private book = new THREE.Group(); // page-width units inside, scaled to the table
  private tabs: Array<{ mesh: THREE.Mesh; on: boolean; hover: number }> = [];
  private hoverTab = -1;
  private opened = performance.now();
  private introAt: number | null = null; // when the booklet started coming down onto the table
  private muteTurnSound = false;
  private active = false; // on screen: the loop draws every frame
  private warm = 3; // frames drawn while hidden, to compile the shaders and upload the textures
  private reveal = 0; // the timer that waits for the first pages
  private camFrom = new THREE.Vector3();
  private camTo = new THREE.Vector3();
  private lookAt = new THREE.Vector3();
  private paper = solid(PAPER);
  private edge = edgeTexture();
  private mats = {
    left: new THREE.MeshLambertMaterial({ map: this.paper, side: THREE.DoubleSide }),
    right: new THREE.MeshLambertMaterial({ map: this.paper, side: THREE.DoubleSide }),
    edge: new THREE.MeshLambertMaterial({ map: this.edge, side: THREE.DoubleSide }),
    board: new THREE.MeshLambertMaterial({ color: BOARD }),
  };
  private leaves: Leaf[] = []; // every leaf made; the free ones wait here
  private stacks: Record<Side, THREE.Mesh>;
  private heights: Record<Side, number> = { left: 0, right: 0 };
  private boards: Record<Side, THREE.Mesh>;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private page: number; // the open spread; -1 = closed
  private turns: Turn[] = []; // the leaves in the air, in the order they were started (all one direction)
  private queued: number | null = null;
  private raf = 0;
  private last = performance.now();
  private resize: ResizeObserver;

  constructor(
    private host: HTMLElement,
    private o: BookOptions,
  ) {
    const r = this.renderer;
    r.setPixelRatio(1); // the post-processing sets the resolution, as in the menus
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.domElement.className = 'rb-canvas';
    host.appendChild(r.domElement);
    this.post.uniforms.uExposure.value = EXPOSURE;

    // the room of the game: the table (an empty one, no chalk), the chairs in the dark, the lamp
    buildRoom(this.scene, 4, [], false);
    this.lamp = buildLamp(this.scene);
    this.scene.traverse((o) => {
      // a sharper shadow map: the leaves are thin and close to the page under them
      if (o instanceof THREE.SpotLight) o.shadow.mapSize.set(2048, 2048);
    });
    this.book.scale.setScalar(SCALE);
    this.book.position.set(0, TABLE_Y + BOARD_T * SCALE, 0.4); // in front of your seat
    this.book.rotation.y = -0.03; // set down by hand, not squared to the table
    this.scene.add(this.book);
    for (const m of Object.values(this.mats)) if (m !== this.mats.board) m.color.setScalar(ALBEDO);
    this.warm = 3;

    const board = (side: Side) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(W * 1.035, BOARD_T, H * 1.05), this.mats.board);
      m.position.set(side === 'right' ? W * 0.5175 : -W * 0.5175, -BOARD_T / 2, 0);
      m.castShadow = m.receiveShadow = true;
      this.book.add(m);
      return m;
    };
    this.boards = { left: board('left'), right: board('right') };

    const stack = (side: Side) => {
      const m = new THREE.Mesh(stackGeometry(side === 'right' ? 1 : -1, 0.001), [this.mats[side], this.mats.edge]);
      m.castShadow = m.receiveShadow = true;
      this.book.add(m);
      return m;
    };
    this.stacks = { left: stack('left'), right: stack('right') };

    this.makeLeaf().mesh.visible = true; // drawn during the warm-up frames: shaders compiled before it's needed

    // the index tabs: one per chapter, staggered down the outer edge of the leaves
    void document.fonts.load('44px "IM Fell English SC"').catch(() => undefined).then(() => {
      if (this.tabs.length) return;
      this.tabs = o.tabs.map((label, i) => {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(TAB_OUT + TAB_IN, Math.min(0.11, H / o.tabs.length - 0.006)),
          new THREE.MeshLambertMaterial({ map: tabTexture(label, false), color: new THREE.Color().setScalar(ALBEDO) }),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.userData.label = label;
        mesh.userData.chapter = i;
        this.book.add(mesh);
        return { mesh, on: false, hover: 0 };
      });
      this.placeTabs();
    });

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
    o.pages.paused = () => this.turns.length > 0;

    // The booklet is built and its first pages photographed while the menu is idle (the canvas
    // stays transparent and nothing is drawn but a couple of frames, to compile and upload);
    // present() then only has to play the entrance.
    o.pages.want(['cover', `R${o.start}`, `L${o.start}`]);
    r.domElement.style.opacity = '0';
    r.domElement.style.transition = `opacity ${FADE_S}s ease-out`;
    this.loop();
  }

  private makeLeaf(): Leaf {
    const mat = (side: THREE.Side) => {
      const m = new THREE.MeshLambertMaterial({ map: this.paper, side, shadowSide: THREE.DoubleSide });
      m.color.setScalar(ALBEDO);
      return m;
    };
    const front = mat(THREE.FrontSide);
    const back = mat(THREE.BackSide);
    const geo = leafGeometry();
    const mesh = new THREE.Mesh(geo, [front, back]);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.book.add(mesh);
    const leaf: Leaf = { mesh, pos: geo.getAttribute('position') as THREE.BufferAttribute, front, back, backMap: null };
    this.leaves.push(leaf);
    return leaf;
  }

  /** A leaf nobody is using (made on demand). */
  private freeLeaf(): Leaf {
    return this.leaves.find((l) => !this.turns.some((t) => t.leaf === l) && !l.mesh.visible) ?? this.makeLeaf();
  }

  /** The spread the book will be showing when every leaf in the air has landed. */
  private logical() {
    const l = this.turns[this.turns.length - 1];
    return l ? l.to : this.page;
  }

  /** Come up now: wait (briefly) for the cover and first spread if they are not ready, then enter. */
  present() {
    this.active = true;
    const first = ['cover', `R${this.o.start}`, `L${this.o.start}`];
    this.o.pages.want(first);
    const waited = performance.now();
    window.clearInterval(this.reveal);
    this.reveal = window.setInterval(() => {
      const ready = first.every((k) => this.o.pages.has(k));
      if (!ready && performance.now() - waited < REVEAL_MAX_MS) return;
      window.clearInterval(this.reveal);
      this.begin();
    }, 40);
  }

  /**
   * The entrance. The booklet is set down on the table: it comes in from above, a little askew,
   * and settles squared under the lamp while the room fades in and you lean over it; once it has
   * landed the cover opens by itself (it can be caught like any page).
   */
  private begin() {
    const now = performance.now();
    this.opened = now; // the lean-in starts now
    this.introAt = this.o.reducedMotion ? null : now;
    const wait = this.o.reducedMotion ? 0.05 : LAND_S + 0.15;
    // the cover lies closed (the leaf at rest, showing the cover) until the booklet has landed
    this.muteTurnSound = true;
    this.startTurn(-1, this.o.start, { u: 0.92, v: 0.82 }, 'auto', wait);
    this.muteTurnSound = false;
    window.setTimeout(() => this.o.onTurnStart(), wait * 1000);
    this.o.onReveal?.();
    // fade in on the next frame, once the first picture of the cover has been drawn
    requestAnimationFrame(() => requestAnimationFrame(() => (this.renderer.domElement.style.opacity = '1')));
  }

  // ---- layout -------------------------------------------------------------------------------

  private fit() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.post.resize(w, h);
    const cam = this.camera;
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    this.book.updateMatrixWorld(true);
    const centre = this.book.localToWorld(new THREE.Vector3(0, 0, 0.04));
    const tilt = 0.5; // from your seat, leaning over the booklet: the table and the lamp's pool beyond
    // as close as it can be with the booklet, its tabs, and a leaf standing up all in view
    const pts = [
      ...[-1, 1].flatMap((x) => [-1, 1].map((z) => new THREE.Vector3(x * (W + TAB_OUT), 0, z * H * 0.55))),
      new THREE.Vector3(0, W * 0.45, -H / 2),
    ].map((p) => this.book.localToWorld(p));
    const place = (d: number) => {
      cam.position.set(centre.x, centre.y + Math.cos(tilt) * d, centre.z + Math.sin(tilt) * d);
      cam.lookAt(centre);
      cam.updateMatrixWorld();
    };
    let lo = 0.1;
    let hi = 4;
    for (let k = 0; k < 24; k++) {
      const d = (lo + hi) / 2;
      place(d);
      const fits = pts.every((c) => {
        const p = c.clone().project(cam);
        return Math.abs(p.x) < 0.94 && Math.abs(p.y) < 0.86;
      });
      if (fits) hi = d;
      else lo = d;
    }
    place(hi);
    this.camTo.copy(cam.position);
    this.lookAt.copy(centre);
    // it comes down onto the table from higher up, as if you leaned over the booklet
    this.camFrom.set(centre.x, centre.y + hi * 1.7, centre.z + hi * 0.9);
    // page pictures about as sharp as the page on screen (sharper only blurs when minified)
    const a = this.screenOf('right', 0, 0.5);
    const b = this.screenOf('right', 1, 0.5);
    this.o.pages.ratio = Math.min(2.5, Math.max(1, (Math.abs(b.x - a.x) * 1.15) / 528));
  }

  private leftCount(p: number) {
    return p < 0 ? 0 : p + 1;
  }

  private rightCount(p: number) {
    return this.o.count - Math.max(0, p);
  }

  /** Each chapter's tab sticks out of its leaf: on the left once read, on the right ahead. */
  private placeTabs() {
    const n = this.tabs.length;
    const shown = this.turns.length ? this.turns[0].from : this.page;
    this.tabs.forEach((t, i) => {
      const left = shown >= 0 && i < shown;
      const depth = left ? shown - 1 - i : i - Math.max(0, shown); // leaves above it on that side
      const top = left ? this.heights.left : this.heights.right;
      const y = Math.max(0.0008, top - depth * LEAF_T - LEAF_T * 0.5) + t.hover * 0.004;
      const x = (left ? -1 : 1) * (W + (TAB_OUT - TAB_IN) / 2);
      t.mesh.position.set(x + (left ? -1 : 1) * t.hover * 0.012, y, -H / 2 + ((i + 0.5) * H) / n);
      const on = i === shown;
      if (on !== t.on) {
        t.on = on;
        const mat = t.mesh.material as THREE.MeshLambertMaterial;
        mat.map?.dispose();
        mat.map = tabTexture(t.mesh.userData.label as string, on);
        mat.needsUpdate = true;
      }
    });
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

  /** Puts the right pictures on the stacks and the leaves (also when a picture gets ready). */
  refresh(): void {
    const ts = this.turns;
    let left: string | null;
    let right: string | null;
    if (!ts.length) {
      left = this.page >= 0 ? `L${this.page}` : null;
      right = `R${Math.max(0, this.page)}`;
    } else {
      // all in the air go one way: the side they leave shows what's under the last of them, the
      // side they land on shows the page under the first (the last one already landed)
      const first = ts[0];
      const last = ts[ts.length - 1];
      if (first.dir > 0) {
        left = first.from >= 0 ? `L${first.from}` : null;
        right = `R${last.to}`;
      } else {
        left = `L${last.to}`;
        right = `R${first.from}`;
      }
    }
    this.show(this.mats.left, left);
    this.show(this.mats.right, right);
    this.stacks.left.visible = this.boards.left.visible = left !== null;
    for (const t of ts) this.dress(t);
  }

  /** The faces of a turning leaf: its front is the page it lifts off, its back the one it lands on. */
  private dress(t: Turn) {
    const front = t.dir > 0 ? (t.from < 0 ? 'cover' : `R${t.from}`) : `R${t.to}`;
    const back = t.dir > 0 ? `L${t.to}` : `L${t.from}`;
    this.show(t.leaf.front, front);
    const lf = t.leaf;
    const tex = this.o.pages.get(back);
    if (tex && lf.backMap?.source !== tex.source) {
      lf.backMap?.dispose();
      lf.backMap = tex.clone();
      lf.backMap.repeat.x = -1;
      lf.backMap.offset.x = 1;
      lf.backMap.needsUpdate = true;
    }
    const map = tex && lf.backMap ? lf.backMap : this.paper;
    if (lf.back.map !== map) {
      lf.back.map = map;
      lf.back.needsUpdate = true;
    }
  }

  // ---- turning ------------------------------------------------------------------------------

  /** Turns to a spread (arrows, tabs): the leaf goes over by itself, as if taken by its corner. */
  go(to: number): void {
    const target = Math.max(0, Math.min(this.o.count - 1, to));
    const from = this.logical();
    if (this.turns.some((t) => t.mode === 'drag')) return; // a leaf is in your hand
    if (this.page < 0 && !this.turns.length) return;
    if (target === from) return;
    const dir = target > from ? 1 : -1;
    const last = this.turns[this.turns.length - 1];
    if (last && last.dir !== dir) {
      this.queued = target; // the other way: once the leaves in the air have landed
      return;
    }
    // another leaf starts while the others are still in the air, a beat behind them
    this.startTurn(from, target, { u: 0.93, v: 0.8 }, 'auto', last ? FOLLOW_S : 0);
  }

  /** Turns one spread from wherever the book is heading (so quick presses add leaves). */
  step1(delta: 1 | -1): void {
    this.go(this.logical() + delta);
  }

  private startTurn(from: number, to: number, grab: { u: number; v: number }, mode: Turn['mode'], delay = 0) {
    const dir = to > from ? 1 : -1;
    const startA = dir > 0 ? 0 : Math.PI;
    const leaf = this.freeLeaf();
    const t: Turn = {
      leaf,
      posed: false,
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
    this.turns.push(t);
    if (mode === 'auto') this.release(t, Math.PI - startA, delay);
    const keys = dir > 0 ? [`R${to}`, `L${to}`] : [`L${to}`, `R${to}`];
    this.o.pages.want(keys);
    leaf.mesh.visible = true;
    this.refresh();
  }

  /** Lets the leaf go: it falls to `target` (π = over to the left), keeping the speed it had. */
  private release(t: Turn, target: number, delay = 0) {
    t.mode = 'auto';
    t.a0 = t.shape.angle;
    t.v0 = t.shape.omega;
    t.target = target;
    t.t0 = performance.now() + delay * 1000;
    t.dur = this.o.reducedMotion ? 0.001 : 0.3 + (0.55 * Math.abs(target - t.a0)) / Math.PI;
    if (target !== (t.dir > 0 ? 0 : Math.PI) && !this.muteTurnSound) this.o.onTurnStart();
  }

  private finish(t: Turn) {
    const done = t.target === (t.dir > 0 ? Math.PI : 0);
    this.turns = this.turns.filter((x) => x !== t);
    t.leaf.mesh.visible = false;
    if (done) {
      this.page = t.to;
      this.o.onPage(t.to);
    }
    this.refresh();
    this.placeTabs();
    const p = Math.max(0, this.page);
    this.o.pages.want([p + 1, p - 1].filter((n) => n >= 0 && n < this.o.count).flatMap((n) => [`R${n}`, `L${n}`]));
    if (this.turns.length) return;
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

  /** What's under the pointer: a moving leaf, or the top page of a stack (as leaf coordinates). */
  private pick(): { what: 'leaf' | Side; u: number; v: number; turn?: Turn } | null {
    const hits = this.raycaster.intersectObjects(
      [...this.turns.map((t) => t.leaf.mesh), this.stacks.left, this.stacks.right].filter((m) => m.visible),
      false,
    );
    for (const h of hits) {
      if (!h.uv) continue;
      const turn = this.turns.find((t) => t.leaf.mesh === h.object);
      if (turn) return { what: 'leaf', u: h.uv.x, v: 1 - h.uv.y, turn };
      if (h.face && h.face.materialIndex !== 0) continue; // the edge of the stack
      const side: Side = h.object === this.stacks.left ? 'left' : 'right';
      // leaf coordinates count from the spine
      return { what: side, u: side === 'left' ? 1 - h.uv.x : h.uv.x, v: 1 - h.uv.y };
    }
    return null;
  }

  /** The index tab under the pointer (-1: none). */
  private pickTab() {
    const hit = this.raycaster.intersectObjects(this.tabs.map((t) => t.mesh), false)[0];
    return hit ? (hit.object.userData.chapter as number) : -1;
  }

  private grabbable(hit: ReturnType<BookScene['pick']>) {
    if (!hit) return false;
    if (this.turns.some((t) => t.mode === 'drag')) return false; // one leaf in hand at a time
    // a leaf in the air can be caught only if it is the last one started (the rest are ahead of it)
    if (hit.what === 'leaf') return hit.turn === this.turns[this.turns.length - 1];
    const at = this.logical();
    if (at < 0) return false;
    const dir = this.turns[0]?.dir;
    // the stack the leaves are leaving: another one joins them
    if (hit.what === 'right') return (dir === undefined || dir > 0) && at < this.o.count - 1;
    return (dir === undefined || dir < 0) && at > 0;
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.aim(e);
    const tab = this.turns.length ? -1 : this.pickTab();
    if (tab >= 0) {
      this.go(tab); // an index tab: straight to its chapter
      return;
    }
    const hit = this.pick();
    if (!hit || !this.grabbable(hit)) return;
    let t: Turn;
    if (hit.what === 'leaf') {
      // catch the leaf that is turning: it is now held where you took it
      t = hit.turn!;
      t.mode = 'drag';
      t.grabTo = { u: hit.u, v: hit.v };
    } else {
      const at = this.logical();
      this.startTurn(at, hit.what === 'right' ? at + 1 : at - 1, { u: hit.u, v: hit.v }, 'drag');
      t = this.turns[this.turns.length - 1];
    }
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
    const t = this.turns.find((x) => x.mode === 'drag');
    if (t && e.pointerId === t.pointer) {
      if (Math.hypot(e.clientX - t.downX, e.clientY - t.downY) > CLICK_PX) t.moved = true;
      // the pointer on the booklet's plane, in the booklet's own units
      const ray = this.raycaster.ray.clone().applyMatrix4(this.book.matrixWorld.clone().invert());
      const p = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.heights.right), new THREE.Vector3());
      if (p) this.dragX = p.x;
      return;
    }
    this.hoverTab = this.turns.length ? -1 : this.pickTab();
    this.renderer.domElement.style.cursor = this.hoverTab >= 0 ? 'pointer' : this.grabbable(this.pick()) ? 'grab' : '';
  };

  private onUp = (e: PointerEvent) => {
    const t = this.turns.find((x) => x.mode === 'drag');
    if (!t || e.pointerId !== t.pointer) return;
    this.renderer.domElement.style.cursor = '';
    const over = t.dir > 0 ? Math.PI : 0;
    const back = Math.PI - over;
    const quick = !t.moved && performance.now() - t.downAt < CLICK_MS;
    if (quick) {
      this.release(t, over); // a click: it turns by itself from where you took it
      return;
    }
    // a flick decides; otherwise whichever side of the spine it is on
    const fling = t.shape.omega;
    if (Math.abs(fling) > 3) this.release(t, fling > 0 ? Math.PI : 0);
    else this.release(t, t.shape.angle > Math.PI / 2 ? Math.PI : 0);
    if (t.target === back) t.dur *= 0.8;
  };

  // ---- frame --------------------------------------------------------------------------------

  private frame(): LeafFrame {
    return { w: W, h: H, rightTop: this.heights.right, leftTop: this.heights.left };
  }

  private step(dt: number) {
    // the stacks settle to their size: the side the leaves leave counts the last of them gone, the
    // side they land on counts only those that have landed
    const ts = this.turns;
    let lc = this.leftCount(this.page);
    let rc = this.rightCount(this.page);
    if (ts.length) {
      const first = ts[0];
      const last = ts[ts.length - 1];
      lc = first.dir > 0 ? this.leftCount(first.from) : this.leftCount(last.to);
      rc = first.dir > 0 ? this.rightCount(last.to) : this.rightCount(first.from);
    }
    for (const [side, n] of [['left', lc], ['right', rc]] as const) {
      const goal = n * LEAF_T;
      const h = this.heights[side];
      if (Math.abs(goal - h) < 1e-5) continue;
      this.heights[side] = h + (goal - h) * Math.min(1, dt * 8);
      const m = this.stacks[side];
      m.geometry.dispose();
      m.geometry = stackGeometry(side === 'right' ? 1 : -1, Math.max(0.001, this.heights[side]));
      this.placeTabs();
    }
    for (const t of [...ts]) this.stepTurn(t, dt, ts.indexOf(t));
  }

  private stepTurn(t: Turn, dt: number, index: number) {
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
        // waiting to start (the opening, or a leaf following another): shape it once so it lies
        // in place instead of showing its first pose
        if (!t.posed) {
          t.posed = true;
          this.poseLeaf(t, index);
        }
        return;
      }
      const u = Math.min(1, (now - t.t0) / 1000 / t.dur);
      s.angle = Math.max(0, Math.min(Math.PI, hermite(t.a0, t.v0 * t.dur, t.target, u)));
      if (u >= 1) {
        this.finish(t);
        return;
      }
    }
    s.omega += ((s.angle - prev) / Math.max(dt, 1e-3) - s.omega) * Math.min(1, dt * 12);
    this.poseLeaf(t, index);
  }

  private poseLeaf(t: Turn, index: number) {
    const lf = t.leaf;
    shapeLeaf(t.shape, this.frame(), lf.pos.array as Float32Array);
    lf.pos.needsUpdate = true;
    lf.mesh.geometry.computeVertexNormals();
    lf.mesh.geometry.computeBoundingSphere();
    lf.mesh.position.y = index * LEAF_T * 0.6; // leaves in the air never share a plane (no z-fighting)
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.active) {
      if (this.warm <= 0) return; // parked: nothing to draw
      this.warm--;
      if (this.warm === 0) for (const l of this.leaves) if (!this.turns.some((t) => t.leaf === l)) l.mesh.visible = false; // end of the warm-up
    }
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    // tabs lean out a little under the pointer
    let moved = false;
    this.tabs.forEach((t, i) => {
      const goal = i === this.hoverTab && !this.turns.length ? 1 : 0;
      if (Math.abs(goal - t.hover) < 0.01) return;
      t.hover += (goal - t.hover) * Math.min(1, dt * 14);
      moved = true;
    });
    if (moved) this.placeTabs();
    // you lean over the booklet as it comes up
    const u = Math.min(1, (now - this.opened) / 1000 / CAM_IN);
    const k = this.o.reducedMotion ? 1 : 1 - (1 - u) ** 3;
    this.camera.position.copy(this.camFrom).lerp(this.camTo, k);
    this.camera.lookAt(this.lookAt);
    this.land(now);
    this.lamp.update(now / 1000);
    this.post.render(this.scene, this.camera, now / 1000);
  };

  /** The booklet coming down: from above and askew to its place (ease-out, no bounce). */
  private land(now: number) {
    if (this.introAt === null) return;
    const u = Math.min(1, (now - this.introAt) / 1000 / LAND_S);
    const left = (1 - u) ** 3;
    this.book.position.y = TABLE_Y + BOARD_T * SCALE + left * 0.3;
    this.book.rotation.set(-0.3 * left, -0.03 + 0.55 * left, 0.08 * left);
    if (u >= 1) this.introAt = null;
  }

  /** For tests: where things are. */
  debug() {
    const t = this.turns[0];
    return { page: this.page, leaves: this.turns.length, turning: t ? { from: t.from, to: t.to, mode: t.mode, angle: t.shape.angle } : null };
  }

  /** For tests: the screen point of a chapter's index tab (null until the tabs are made). */
  tabScreen(i: number) {
    const t = this.tabs[i];
    if (!t) return null;
    const p = t.mesh.getWorldPosition(new THREE.Vector3()).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** For tests: the screen point (px, relative to the canvas) of a page point. */
  screenOf(side: Side, u: number, v: number) {
    const x = side === 'right' ? u * W : -u * W;
    this.book.updateMatrixWorld(true);
    const p = this.book.localToWorld(new THREE.Vector3(x, this.heights[side], (v - 0.5) * H)).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  dispose(): void {
    window.clearInterval(this.reveal);
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
    for (const t of this.tabs) {
      const mat = t.mesh.material as THREE.MeshLambertMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this.paper.dispose();
    this.edge.dispose();
    for (const l of this.leaves) {
      l.backMap?.dispose();
      l.front.dispose();
      l.back.dispose();
    }
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
  }
}
