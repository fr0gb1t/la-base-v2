// The faces other people at your table wear, while you wait for the game to start: the pickers do not offer them
// (two players never wear the same face). Bots do not count: a bot gives its face up to whoever wants it.
import { useMemo } from 'react'
import type { FaceId } from '@la-base/shared'
import { useGameStore } from '../store/gameStore'

/** Face → the name of who wears it. Empty outside a room, or once the game is on. */
export function useTakenFaces(): Map<FaceId, string> {
  const { roomCode, gameState, roomPlayers, currentPlayer } = useGameStore()
  return useMemo(() => {
    const m = new Map<FaceId, string>()
    if (!roomCode || gameState) return m
    for (const p of roomPlayers) if (p.avatar && !p.isBot && p.id !== currentPlayer?.id) m.set(p.avatar.face, p.name)
    return m
  }, [roomCode, gameState, roomPlayers, currentPlayer?.id])
}
