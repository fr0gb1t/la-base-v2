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
 * Validate a Pie bid given Mano's bid and total bases
 * Constraint: sum of bids must NOT equal total bases
 * @param manoBidValue The Mano team's bid
 * @param pieBidValue The Pie team's bid
 * @param totalBases Total bases available
 * @returns true if Pie bid is valid
 */
export function validatePieBid(manoBidValue: number, pieBidValue: number, totalBases: number): boolean {
  const sum = manoBidValue + pieBidValue;
  return sum !== totalBases;
}

/**
 * Get valid bid range for Pie team
 * Returns all valid values from 0 to totalBases
 * @param manoBidValue The Mano team's bid
 * @param totalBases Total bases available
 * @returns Array of valid bid values
 */
export function getPieValidBidRange(manoBidValue: number, totalBases: number): number[] {
  const validBids: number[] = [];
  for (let i = 0; i <= totalBases; i++) {
    if (validatePieBid(manoBidValue, i, totalBases)) {
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
