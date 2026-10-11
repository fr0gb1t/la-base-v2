// Which mood the score should be in, from how the game is going for YOUR team. A pure function of the game state, so the
// rules can be read (and tested) apart from the sound.

import type { AssignedTeam, Bid, GamePhase } from '@la-base/shared'
import type { Mood } from '../table3d/music'

export interface MoodInput {
  /** Whether the table (the game page) is on screen; anything else is the menu. */
  inGame: boolean
  phase: GamePhase | null
  myTeam: AssignedTeam
  scores: Record<AssignedTeam, number>
  roundIndex: number
  totalRounds: number
  tiebreak: boolean
  bids: readonly Bid[]
  basesWon: Record<AssignedTeam, number>
  /** Bases in the round being played. */
  basesInRound: number
  kamikazeTeam: AssignedTeam | null
}

/** A round met pays 10 + bases, a miss costs a few points: a lead of this many points is about a round ahead. */
const AHEAD = 8
/** Two rounds ahead or behind, near the end, is the game's outcome. */
const DECIDED = 14
/** The last rounds of the game (the current one and two more). */
const LATE_ROUNDS = 2
/** The Mano's team loses at once if it ends the round two bases or more away from what it asked, with no kamikaze. */
const AUTOMATIC_LOSS_GAP = 2

const rivalOf = (team: AssignedTeam): AssignedTeam => (team === 'nosotros' ? 'ellos' : 'nosotros')

/** Whether the team has already lost the game by missing its bid by two or more (it can no longer be saved). */
export function isLostToTheBid(team: AssignedTeam, i: MoodInput): boolean {
  const mano = i.bids[0]
  if (!mano || mano.team !== team || mano.isKamikaze || i.phase !== 'playing') return false
  const left = i.basesInRound - i.basesWon.nosotros - i.basesWon.ellos
  const won = i.basesWon[team]
  return won >= mano.value + AUTOMATIC_LOSS_GAP || won + left <= mano.value - AUTOMATIC_LOSS_GAP
}

export function musicMood(i: MoodInput): Mood {
  if (!i.inGame || !i.phase || i.phase === 'lobby' || i.phase === 'config' || i.phase === 'game_over') return 'menu'
  if (i.phase === 'initial_draw' || i.phase === 'round_setup') return 'calm'

  const lead = i.scores[i.myTeam] - i.scores[rivalOf(i.myTeam)]
  const late = i.tiebreak || i.totalRounds - 1 - i.roundIndex <= LATE_ROUNDS

  if (isLostToTheBid(i.myTeam, i) || (late && lead <= -DECIDED)) return 'danger'
  if (isLostToTheBid(rivalOf(i.myTeam), i) || (late && lead >= DECIDED)) return 'winning'
  if (i.kamikazeTeam || (late && Math.abs(lead) < DECIDED) || lead <= -AHEAD - 2) return 'tension'
  if (lead >= AHEAD) return 'promising'
  return 'calm'
}
