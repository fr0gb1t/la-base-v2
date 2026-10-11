import { useEffect, useMemo, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { musicMood } from '../lib/musicMood'
import { MOODS, type Mood } from '../table3d/music'
import { musicStinger, setMusicMood } from '../table3d/audio'

/** A calmer mood waits this long after the last change, so a score that hovers on a threshold does not flap. */
const SETTLE_MS = 12_000

/** Keeps the score in step with the game: the mood from how your team is doing, and the closing phrase at game over. */
export function useMusicMood() {
  const currentPage = useGameStore((s) => s.currentPage)
  const gameState = useGameStore((s) => s.gameState)
  const roomPlayers = useGameStore((s) => s.roomPlayers)
  const myId = useGameStore((s) => s.currentPlayer?.id)
  const gameOver = useGameStore((s) => s.gameOver)

  const myTeam = roomPlayers.find((p) => p.id === myId)?.team === 'ellos' ? 'ellos' : 'nosotros'

  const mood = useMemo(
    () =>
      musicMood({
        inGame: currentPage === 'game',
        phase: gameState?.phase ?? null,
        myTeam,
        scores: gameState?.scores ?? { nosotros: 0, ellos: 0 },
        roundIndex: gameState?.roundIndex ?? 0,
        totalRounds: gameState?.structureSequence.length ?? 0,
        tiebreak: Boolean(gameState?.tiebreak),
        bids: gameState?.bids ?? [],
        basesWon: gameState?.basesWon ?? { nosotros: 0, ellos: 0 },
        basesInRound: gameState?.structureSequence[gameState.roundIndex] ?? 0,
        kamikazeTeam: gameState?.kamikazeTeam ?? null,
      }),
    [currentPage, gameState, myTeam],
  )

  // a rise is immediate; a fall waits until the current mood has had its time
  const shown = useRef<{ mood: Mood; since: number }>({ mood: 'menu', since: 0 })
  useEffect(() => {
    const apply = () => {
      shown.current = { mood, since: Date.now() }
      setMusicMood(mood)
    }
    const falling = MOODS.indexOf(mood) < MOODS.indexOf(shown.current.mood) && mood !== 'menu'
    const wait = shown.current.since + SETTLE_MS - Date.now()
    if (!falling || wait <= 0) {
      if (mood !== shown.current.mood) apply()
      return
    }
    const timer = window.setTimeout(apply, wait)
    return () => window.clearTimeout(timer)
  }, [mood])

  useEffect(() => {
    if (!gameOver) return
    if (gameOver.winner === 'nosotros' || gameOver.winner === 'ellos') musicStinger(gameOver.winner === myTeam ? 'victory' : 'defeat')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per game over, not when the team lookup changes
  }, [gameOver])
}
