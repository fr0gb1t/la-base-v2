/**
 * Scoring logic for La Base
 *
 * - If bid is met: +10 + number of bases won
 * - If bid is NOT met: -difference (how many bases off)
 * - Kamikaze penalty: if Mano didn't declare Kamikaze but lost by 2+ bases → automatic loss (game over)
 */

import type { Bid, Team } from './types.js';

/**
 * Calculate score for a single team after a round
 * @param bid The team's bid
 * @param basesWon Number of bases won by the team
 * @returns The score (positive if met, negative if missed)
 */
export function calculateScore(bid: Bid, basesWon: number): number {
  if (bid.value === basesWon) {
    // Bid met: +10 + bases won
    return 10 + basesWon;
  } else {
    // Bid missed: -difference
    const difference = Math.abs(bid.value - basesWon);
    return -difference;
  }
}

/**
 * Check if a team violated Kamikaze rule
 * @param manoBid The Mano team's bid
 * @param manoBasesWon Bases won by Mano
 * @param totalBases Total bases available in the round
 * @returns true if Kamikaze violation (game over)
 */
export function checkKamikazeViolation(
  manoBid: Bid,
  manoBasesWon: number,
  totalBases: number
): boolean {
  // Only applies if Mano didn't declare Kamikaze
  if (manoBid.isKamikaze) {
    return false;
  }

  // If lost by 2+ bases without declaring Kamikaze → automatic loss
  const difference = Math.abs(manoBid.value - manoBasesWon);
  return difference >= 2;
}

/**
 * How the Pie (the team that answers) may bid:
 *  - 'estricta' (the real rule, the default): the two bids must add up to one less or one more than
 *    the round's bases. With 5 bases and the Mano asking 3, the Pie can ask 1 or 3; with 3 bases and
 *    the Mano asking 3, only 1 (a bid can't be negative).
 *  - 'amplia' (the looser house rule): any bid from 0 to the total, as long as the sum is not
 *    exactly the total.
 */
export type PieBidRule = 'estricta' | 'amplia';
export const PIE_BID_RULES: readonly PieBidRule[] = ['estricta', 'amplia'];
export const isPieBidRule = (v: unknown): v is PieBidRule => v === 'estricta' || v === 'amplia';

/** Validate a Pie bid given Mano's bid and the round's bases. */
export function validatePieBid(manoBidValue: number, pieBidValue: number, totalBases: number, rule: PieBidRule = 'estricta'): boolean {
  if (pieBidValue < 0 || pieBidValue > totalBases) return false;
  const sum = manoBidValue + pieBidValue;
  if (rule === 'amplia') return sum !== totalBases;
  return sum === totalBases - 1 || sum === totalBases + 1;
}

/** Every bid the Pie may make (ascending). */
export function getPieValidBidRange(manoBidValue: number, totalBases: number, rule: PieBidRule = 'estricta'): number[] {
  const validBids: number[] = [];
  for (let i = 0; i <= totalBases; i++) {
    if (validatePieBid(manoBidValue, i, totalBases, rule)) {
      validBids.push(i);
    }
  }
  return validBids;
}

/**
 * Determine which team won a round based on bids and bases won
 * @param manoBid Mano team's bid
 * @param pieBid Pie team's bid
 * @param manoBasesWon Bases won by Mano
 * @param pieBasesWon Bases won by Pie
 * @returns 'nosotros', 'ellos', or 'both_lost' if both missed
 */
export function determineRoundWinner(
  manoBid: Bid,
  pieBid: Bid,
  manoBasesWon: number,
  pieBasesWon: number
): Team | 'both_lost' {
  const manoBidMet = manoBid.value === manoBasesWon;
  const pieBidMet = pieBid.value === pieBasesWon;

  if (manoBidMet && !pieBidMet) {
    return manoBid.team;
  } else if (!manoBidMet && pieBidMet) {
    return pieBid.team;
  } else if (manoBidMet && pieBidMet) {
    // Both met bid - whoever got more points wins
    const manoScore = calculateScore(manoBid, manoBasesWon);
    const pieScore = calculateScore(pieBid, pieBasesWon);
    return manoScore > pieScore ? manoBid.team : pieBid.team;
  } else {
    // Both missed
    return 'both_lost';
  }
}
