/**
 * No two players at a table wear the same face. Bots never insist: one that wears a face a person picked (or
 * another bot's) moves to a free one. Two people who arrive with the same face are told so and asked to change;
 * if every one of them would rather keep it ("me la quedo"), the first to sit keeps it and the rest get it in
 * another colour. When the game starts, whatever clash is left is settled the same way.
 */
import { avatarKey, freeAvatar, untangleAvatars, type AvatarSpec } from '@la-base/shared';

export interface Wearer {
  id: string;
  isBot?: boolean;
  avatar?: AvatarSpec;
  avatarKeep?: boolean; // said "me la quedo" while someone else wears the same face
}

const others = (players: readonly Wearer[], p: Wearer) => players.filter((q) => q !== p && q.avatar).map((q) => q.avatar!);

/** The players (other than `p`) wearing the same face as `p`. */
export const clashesWith = (players: readonly Wearer[], p: Wearer) =>
  p.avatar ? players.filter((q) => q !== p && q.avatar && avatarKey(q.avatar) === avatarKey(p.avatar!)) : [];

/** Bots that clash move to a free face (people keep theirs; between two bots, the later one moves). */
export function settleBots(players: Wearer[], rng?: () => number) {
  players.forEach((p, i) => {
    if (!p.isBot || !p.avatar) return;
    const clash = players.some((q, j) => q !== p && q.avatar && avatarKey(q.avatar) === avatarKey(p.avatar!) && (!q.isBot || j < i));
    if (clash) p.avatar = freeAvatar(others(players, p), rng);
  });
}

/** A "me la quedo" means nothing once its clash is gone. */
export function tidyKeeps(players: Wearer[]) {
  for (const p of players) if (p.avatarKeep && clashesWith(players, p).length === 0) p.avatarKeep = false;
}

/** Hands out colour variants to every clash whose people all said "me la quedo". True if anything changed. */
export function settleKept(players: Wearer[]) {
  const groups = new Map<string, Wearer[]>();
  for (const p of players) if (p.avatar) groups.set(avatarKey(p.avatar), [...(groups.get(avatarKey(p.avatar)) ?? []), p]);
  let changed = false;
  for (const g of groups.values()) {
    if (g.length > 1 && g.every((p) => p.isBot || p.avatarKeep)) {
      untangle(players, g);
      changed = true;
    }
  }
  return changed;
}

/** Every clash settled by colour variants (when the game starts). */
export function settleAll(players: Wearer[]) {
  untangle(players, players.filter((p) => p.avatar));
}

function untangle(players: Wearer[], group: Wearer[]) {
  // (in seat order, counting everyone's face, so a variant never lands on somebody else's)
  const order = players.filter((p) => p.avatar);
  const fixed = untangleAvatars(order.map((p) => p.avatar!));
  order.forEach((p, i) => {
    if (group.includes(p)) p.avatar = fixed[i];
  });
  for (const p of group) p.avatarKeep = false;
}
