// What's new, for players: a short list (the technical history is docs/CHANGELOG.md). The last
// entry seen is kept per browser; whatever is newer than it is "new" (the menu's television calls
// attention to it until it's opened).
import { useSyncExternalStore } from 'react';
import { NOVEDADES } from './entries';

export interface Novedad {
  id: string; // unique and stable: what we remember having seen
  date: string; // YYYY-MM-DD
  title: string;
  items: string[];
}

const KEY = 'laBase.novedades';

/** How many entries are newer than `lastSeenId` (entries are newest first). Unknown or never seen: all of them. */
export function unseenCount(entries: Novedad[], lastSeenId: string | null): number {
  const i = lastSeenId === null ? -1 : entries.findIndex((e) => e.id === lastSeenId);
  return i === -1 ? entries.length : i;
}

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let lastSeen = readLastSeen();
const listeners = new Set<() => void>();

/** The player opened the list: everything up to the newest entry is seen. */
export function markNovedadesSeen() {
  lastSeen = NOVEDADES[0]?.id ?? null;
  try {
    if (lastSeen) localStorage.setItem(KEY, lastSeen);
  } catch {
    /* this session only */
  }
  listeners.forEach((l) => l());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** How many entries this player hasn't seen yet (re-renders when they open the list). */
export function useUnseenNovedades(): number {
  return useSyncExternalStore(subscribe, () => unseenCount(NOVEDADES, lastSeen));
}

export { NOVEDADES };
