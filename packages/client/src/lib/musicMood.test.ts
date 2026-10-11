import { describe, expect, it } from 'vitest'
import { musicMood, isLostToTheBid, type MoodInput } from './musicMood'

const base: MoodInput = {
  inGame: true, phase: 'playing', myTeam: 'nosotros', scores: { nosotros: 0, ellos: 0 },
  roundIndex: 3, totalRounds: 12, tiebreak: false, bids: [], basesWon: { nosotros: 0, ellos: 0 },
  basesInRound: 5, kamikazeTeam: null,
}
const with_ = (patch: Partial<MoodInput>): MoodInput => ({ ...base, ...patch })

describe('musicMood', () => {
  it('is the menu outside the table and before the game starts', () => {
    expect(musicMood(with_({ inGame: false }))).toBe('menu')
    expect(musicMood(with_({ phase: 'lobby' }))).toBe('menu')
    expect(musicMood(with_({ phase: 'game_over' }))).toBe('menu')
    expect(musicMood(with_({ phase: null }))).toBe('menu')
  })

  it('is calm while the cards are drawn and an even game goes on', () => {
    expect(musicMood(with_({ phase: 'initial_draw' }))).toBe('calm')
    expect(musicMood(base)).toBe('calm')
  })

  it('turns promising when your team is a round ahead', () => {
    expect(musicMood(with_({ scores: { nosotros: 20, ellos: 11 } }))).toBe('promising')
    expect(musicMood(with_({ scores: { nosotros: 15, ellos: 11 } }))).toBe('calm')
  })

  it('does not celebrate the rival being ahead', () => {
    expect(musicMood(with_({ scores: { nosotros: 11, ellos: 20 } }))).toBe('calm')
  })

  it('is tense when you fall well behind, or when somebody calls a kamikaze', () => {
    expect(musicMood(with_({ scores: { nosotros: 5, ellos: 20 } }))).toBe('tension')
    expect(musicMood(with_({ kamikazeTeam: 'ellos' }))).toBe('tension')
  })

  it('is tense in the last rounds of an even game', () => {
    expect(musicMood(with_({ roundIndex: 10, scores: { nosotros: 30, ellos: 28 } }))).toBe('tension')
    expect(musicMood(with_({ roundIndex: 3, tiebreak: true, scores: { nosotros: 30, ellos: 30 } }))).toBe('tension')
  })

  it('is almost won near the end with a big lead, and in danger with a big deficit', () => {
    expect(musicMood(with_({ roundIndex: 10, scores: { nosotros: 50, ellos: 30 } }))).toBe('winning')
    expect(musicMood(with_({ roundIndex: 10, scores: { nosotros: 30, ellos: 50 } }))).toBe('danger')
  })

  it('reads the scores from the point of view of the other team too', () => {
    expect(musicMood(with_({ myTeam: 'ellos', roundIndex: 10, scores: { nosotros: 50, ellos: 30 } }))).toBe('danger')
  })

  it('is danger when your Mano can no longer get within one base of its bid', () => {
    const bids = [{ team: 'nosotros' as const, value: 4, isKamikaze: false }]
    // asked 4 of 5 and lost the first 3: at most 2 can still be won, two short of the 4 asked
    expect(isLostToTheBid('nosotros', with_({ bids, basesWon: { nosotros: 0, ellos: 3 } }))).toBe(true)
    expect(isLostToTheBid('nosotros', with_({ bids, basesWon: { nosotros: 1, ellos: 2 } }))).toBe(false)
    expect(musicMood(with_({ bids, basesWon: { nosotros: 0, ellos: 3 } }))).toBe('danger')
  })

  it('is danger when your Mano wins too many bases, and not at all after calling kamikaze', () => {
    const bids = [{ team: 'nosotros' as const, value: 1, isKamikaze: false }]
    expect(isLostToTheBid('nosotros', with_({ bids, basesWon: { nosotros: 3, ellos: 0 } }))).toBe(true)
    const kamikaze = [{ team: 'nosotros' as const, value: 1, isKamikaze: true }]
    expect(isLostToTheBid('nosotros', with_({ bids: kamikaze, basesWon: { nosotros: 3, ellos: 0 } }))).toBe(false)
  })

  it('feels near victory when the rival can no longer save its bid', () => {
    const bids = [{ team: 'ellos' as const, value: 1, isKamikaze: false }]
    expect(musicMood(with_({ bids, basesWon: { nosotros: 0, ellos: 3 } }))).toBe('winning')
  })
})
