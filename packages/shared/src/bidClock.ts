import type { AssignedTeam } from './types.js';

/**
 * The bidding clock (a chess clock): each team has a total time for the whole game, spent only
 * while it is that team's turn to bid. The round's Mano team runs first; its bid presses the
 * clock and the other team's time runs; the second bid stops it for both until the next round.
 * A team whose time runs out while bidding loses the game.
 */
export type BidClock = {
  totalMs: number;
  remainingMs: Record<AssignedTeam, number>;
  /** whose time is running (null: stopped) */
  running: AssignedTeam | null;
  /** when it started running (server ms) */
  since: number | null;
};

/** The times the host can pick (0 = no clock). */
export const BID_CLOCK_OPTIONS = [0, 60_000, 120_000, 300_000] as const;

export function createBidClock(totalMs: number): BidClock | null {
  if (!(totalMs > 0)) return null;
  return { totalMs, remainingMs: { nosotros: totalMs, ellos: totalMs }, running: null, since: null };
}

export function startClock(c: BidClock, team: AssignedTeam, now: number): BidClock {
  return { ...c, running: team, since: now };
}

/** Time left for a team at `now`. */
export function clockLeft(c: BidClock, team: AssignedTeam, now: number): number {
  const spent = c.running === team && c.since !== null ? now - c.since : 0;
  return Math.max(0, c.remainingMs[team] - spent);
}

/** The running team presses: its time is charged, and `next` runs (null: stop). */
export function pressClock(c: BidClock, now: number, next: AssignedTeam | null): BidClock {
  const remainingMs = c.running ? { ...c.remainingMs, [c.running]: clockLeft(c, c.running, now) } : c.remainingMs;
  return { ...c, remainingMs, running: next, since: next ? now : null };
}
