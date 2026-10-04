/**
 * Who receives a seña. A seña never reaches a machine whose player can't see it, so there is
 * nothing to intercept: partners always get it; a rival gets it only while the centre of their
 * view is on the signer's face (and that face isn't turned practically away from them), kept
 * there for a moment. Someone who starts looking mid-seña gets the rest of it.
 *
 * Inputs are what clients already send: each player's look (head turn = camera direction) and
 * the signer's gaze. A modified client can lie about where it looks, but one gaze covers one face
 * and must dwell on it: lying buys no more than an honest player who aims well.
 */
import { seesFace, type Gaze, type Sena } from '@la-base/shared';

export const SENA_WINDOW_MS = 1600; // how long a seña stays on the face (client SENA_HOLD)
export const DWELL_MS = 150; // a gaze must rest on a face this long to read it

interface Seat {
  id: string;
  socketId: string;
  team: string;
}
interface SenaRoom {
  roomCode: string;
  players: Seat[];
}
interface Active {
  signerId: string;
  sena: Sena;
  gaze: Gaze;
  t0: number;
  sent: Set<string>;
  caught: boolean; // a rival got it (the signer has been told)
  pending: Map<string, ReturnType<typeof setTimeout>>;
}
export interface SenaPayload {
  playerId: string;
  sena: Sena;
  yaw: number;
  pitch: number;
  elapsed: number; // ms already gone when it reached you
}
type Send = (socketId: string, payload: SenaPayload) => void;
/** Told to the signer when a rival catches their seña (not which rival). */
export interface SenaSeen {
  sena: Sena;
}
type Seen = (signerSocketId: string, info: SenaSeen) => void;

const DEFAULT_GAZE: Gaze = { yaw: 0, pitch: -0.34 };

export class SenaDelivery {
  private looks = new Map<string, Gaze & { t: number }>(); // playerId → last look
  private active = new Map<string, Active[]>(); // roomCode → señas still on a face

  constructor(private send: Send, private now = () => Date.now(), private seen: Seen = () => undefined) {}

  /** A player's look moved: they may be catching a seña that is on someone's face. */
  look(room: SenaRoom, playerId: string, gaze: Gaze) {
    this.looks.set(playerId, { ...gaze, t: this.now() });
    for (const a of this.live(room.roomCode)) this.consider(room, a, playerId);
  }

  /** A player makes a seña (facing `gaze`, or wherever they last looked). */
  make(room: SenaRoom, signerId: string, sena: Sena, gaze?: Gaze) {
    const g = gaze ?? this.looks.get(signerId) ?? DEFAULT_GAZE;
    const a: Active = { signerId, sena, gaze: { yaw: g.yaw, pitch: g.pitch }, t0: this.now(), sent: new Set([signerId]), caught: false, pending: new Map() };
    this.active.set(room.roomCode, [...this.live(room.roomCode), a]);
    for (const p of room.players) this.consider(room, a, p.id);
    setTimeout(() => this.expire(room.roomCode), SENA_WINDOW_MS + 50);
  }

  private live(roomCode: string) {
    const t = this.now();
    return (this.active.get(roomCode) ?? []).filter((a) => t - a.t0 < SENA_WINDOW_MS);
  }

  private expire(roomCode: string) {
    const all = this.active.get(roomCode) ?? [];
    const t = this.now();
    for (const a of all) if (t - a.t0 >= SENA_WINDOW_MS) a.pending.forEach((timer) => clearTimeout(timer));
    const left = all.filter((a) => t - a.t0 < SENA_WINDOW_MS);
    if (left.length) this.active.set(roomCode, left);
    else this.active.delete(roomCode);
  }

  private consider(room: SenaRoom, a: Active, viewerId: string) {
    if (a.sent.has(viewerId)) return;
    const viewer = room.players.find((p) => p.id === viewerId);
    const signer = room.players.find((p) => p.id === a.signerId);
    if (!viewer || !signer) return;
    if (viewer.team === signer.team) return this.deliver(room, a, viewer); // meant for partners
    if (!this.sees(room, a, viewerId)) {
      clearTimeout(a.pending.get(viewerId));
      a.pending.delete(viewerId);
      return;
    }
    const look = this.looks.get(viewerId)!;
    // already resting on that face before this moment: no need to wait
    if (this.now() - look.t >= DWELL_MS) return this.deliver(room, a, viewer);
    if (a.pending.has(viewerId)) return;
    a.pending.set(
      viewerId,
      setTimeout(() => {
        a.pending.delete(viewerId);
        if (this.now() - a.t0 < SENA_WINDOW_MS && this.sees(room, a, viewerId)) this.deliver(room, a, viewer);
      }, DWELL_MS),
    );
  }

  private sees(room: SenaRoom, a: Active, viewerId: string) {
    const look = this.looks.get(viewerId);
    if (!look) return false;
    const n = room.players.length;
    const v = room.players.findIndex((p) => p.id === viewerId);
    const s = room.players.findIndex((p) => p.id === a.signerId);
    return v >= 0 && s >= 0 && seesFace(v, look, s, a.gaze, n);
  }

  private deliver(room: SenaRoom, a: Active, viewer: Seat) {
    a.sent.add(viewer.id);
    const elapsed = Math.max(0, this.now() - a.t0);
    this.send(viewer.socketId, { playerId: a.signerId, sena: a.sena, yaw: a.gaze.yaw, pitch: a.gaze.pitch, elapsed });
    const signer = room.players.find((p) => p.id === a.signerId);
    if (signer && viewer.team !== signer.team && !a.caught) {
      a.caught = true;
      this.seen(signer.socketId, { sena: a.sena });
    }
  }
}
