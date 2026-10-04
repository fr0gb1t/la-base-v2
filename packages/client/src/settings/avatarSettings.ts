// The player's own avatar (the face of their mask): chosen in the settings, kept per browser, and sent to the
// table whenever they create or join a room. The first time it is a random face, drawn once and then kept,
// so everybody starts with a different one and nobody has to design it from scratch.
import { useSyncExternalStore } from 'react'
import { freeAvatar, randomAvatar, sameAvatar, sanitizeAvatar, type AvatarSpec } from '@la-base/shared'

const KEY = 'laBase.avatar'

function load(): AvatarSpec {
  try {
    const saved = sanitizeAvatar(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
    if (saved) return saved
  } catch {
    /* nothing saved, or storage is blocked */
  }
  const fresh = randomAvatar()
  save(fresh)
  return fresh
}

function save(a: AvatarSpec) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a))
  } catch {
    /* this session only */
  }
}

let current = load()
const listeners = new Set<(a: AvatarSpec) => void>()

export const getAvatar = () => current

export function setAvatar(patch: Partial<AvatarSpec>) {
  const next = sanitizeAvatar({ ...current, ...patch })
  if (!next || sameAvatar(next, current)) return
  current = next
  save(current)
  listeners.forEach((l) => l(current))
}

/** True while restoreAvatar is telling the listeners (the one that sends faces to the table must not resend it). */
let quiet = false
export const restoring = () => quiet

/** Puts back a face the table refused, without sending it again. */
export function restoreAvatar(a: AvatarSpec) {
  current = { face: a.face }
  save(current)
  quiet = true
  try {
    listeners.forEach((l) => l(current))
  } finally {
    quiet = false
  }
}

/** A new random face (the «Al azar» button): never the one you have, nor one somebody at your table wears. */
export function rerollAvatar(taken: readonly AvatarSpec[] = []) {
  current = freeAvatar([...taken, current])
  save(current)
  listeners.forEach((l) => l(current))
}

export function onAvatar(fn: (a: AvatarSpec) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** The avatar, live (re-renders when it changes). */
export const useAvatar = () => useSyncExternalStore(onAvatar, getAvatar)
