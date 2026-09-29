/**
 * Unit tests for scoring logic
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  calculateScore,
  checkKamikazeViolation,
  validatePieBid,
  getPieValidBidRange,
  determineRoundWinner,
} from './scoring.js';
import type { Bid } from './types.js';

describe('Score Calculation', () => {
  test('Bid met: score = 10 + bases won', () => {
    const bid3: Bid = { team: 'nosotros', value: 3, isKamikaze: false };
    const bid0: Bid = { team: 'nosotros', value: 0, isKamikaze: false };

    assert.equal(calculateScore(bid3, 3), 13); // bid 3, won 3 → 10 + 3
    assert.equal(calculateScore(bid0, 0), 10); // bid 0, won 0 → 10 + 0 (special case: safe 0)
  });

  test('Bid missed: score = -difference', () => {
    const bid: Bid = { team: 'nosotros', value: 5, isKamikaze: false };

    assert.equal(calculateScore(bid, 3), -2); // -(5-3)
    assert.equal(calculateScore(bid, 2), -3); // -(5-2)
    assert.equal(calculateScore(bid, 0), -5); // -(5-0)
  });

  test('Bid of 0 can be met (0 bases won)', () => {
    const bid: Bid = { team: 'ellos', value: 0, isKamikaze: false };

    assert.equal(calculateScore(bid, 0), 10); // 10 + 0
    assert.equal(calculateScore(bid, 1), -1); // -(1-0)
  });

  test('Large bid misses penalty proportional', () => {
    const bid: Bid = { team: 'nosotros', value: 8, isKamikaze: false };

    assert.equal(calculateScore(bid, 0), -8);
    assert.equal(calculateScore(bid, 2), -6);
  });
});

describe('Kamikaze Rule', () => {
  test('Kamikaze violation: Mano not declared but lost by 2+ bases', () => {
    const manoBid: Bid = { team: 'nosotros', value: 5, isKamikaze: false };

    assert.ok(checkKamikazeViolation(manoBid, 3, 6)); // diff=2 → violation
    assert.ok(checkKamikazeViolation(manoBid, 2, 6)); // diff=3 → violation
    assert.ok(checkKamikazeViolation(manoBid, 1, 6)); // diff=4 → violation
  });

  test('No violation if difference is only 1', () => {
    const manoBid: Bid = { team: 'nosotros', value: 5, isKamikaze: false };

    assert.ok(!checkKamikazeViolation(manoBid, 4, 6)); // diff=1 → no violation
    assert.ok(!checkKamikazeViolation(manoBid, 6, 6)); // diff=1 (over) → no violation
  });

  test('No violation if Kamikaze was declared', () => {
    const manoBid: Bid = { team: 'nosotros', value: 6, isKamikaze: true };

    // Even with large miss, Kamikaze declared so no automatic loss
    assert.ok(!checkKamikazeViolation(manoBid, 0, 6)); // diff=6 but Kamikaze → no violation
  });

  test('No violation if bid is met', () => {
    const manoBid: Bid = { team: 'nosotros', value: 5, isKamikaze: false };

    assert.ok(!checkKamikazeViolation(manoBid, 5, 6)); // bid met → no violation
  });
});

describe('Pie Bid Validation', () => {
  test('Constraint: sum of bids cannot equal total bases', () => {
    // 6 total bases available
    assert.ok(!validatePieBid(3, 3, 6)); // sum=6 → invalid
    assert.ok(validatePieBid(3, 2, 6)); // sum=5 → valid
    assert.ok(validatePieBid(3, 4, 6)); // sum=7 → valid
  });

  test('Valid ranges for Pie given Mano bid', () => {
    // Mano bids 3, total = 6
    // Valid: sum must NOT equal 6
    // So Pie can bid: 0 (sum=3), 1 (sum=4), 2 (sum=5), 3 (sum=6 INVALID), 4 (sum=7), 5 (sum=8), 6 (sum=9)
    const validBids = getPieValidBidRange(3, 6);
    assert.deepEqual(validBids, [0, 1, 2, 4, 5, 6]); // everything except 3

    // Mano bids 2, total = 5
    // Valid: sum must NOT equal 5
    // So Pie can bid: 0 (sum=2), 1 (sum=3), 2 (sum=4), 3 (sum=5 INVALID), 4 (sum=6), 5 (sum=7)
    const validBids2 = getPieValidBidRange(2, 5);
    assert.deepEqual(validBids2, [0, 1, 2, 4, 5]); // everything except 3
  });

  test('Edge case: Mano bids 0', () => {
    // Mano bids 0, total = 5
    // Valid: sum must NOT equal 5
    // So Pie can bid: 0 (sum=0), 1 (sum=1), 2 (sum=2), 3 (sum=3), 4 (sum=4), 5 (sum=5 INVALID)
    const validBids = getPieValidBidRange(0, 5);
    assert.deepEqual(validBids, [0, 1, 2, 3, 4]); // everything except 5
  });

  test('Edge case: Mano bids maximum', () => {
    // Mano bids 6, total = 6
    // Valid: sum must NOT equal 6
    // So Pie can bid: 0 (sum=6 INVALID), 1 (sum=7), 2 (sum=8), 3 (sum=9), 4 (sum=10), 5 (sum=11), 6 (sum=12)
    const validBids = getPieValidBidRange(6, 6);
    assert.deepEqual(validBids, [1, 2, 3, 4, 5, 6]); // everything except 0
  });
});

describe('Round Winner Determination', () => {
  test('Mano wins if only Mano meets bid', () => {
    const manoBid: Bid = { team: 'nosotros', value: 3, isKamikaze: false };
    const pieBid: Bid = { team: 'ellos', value: 2, isKamikaze: false };

    const winner = determineRoundWinner(manoBid, pieBid, 3, 1); // Mano: 3/3, Pie: 1/2
    assert.equal(winner, 'nosotros');
  });

  test('Pie wins if only Pie meets bid', () => {
    const manoBid: Bid = { team: 'nosotros', value: 3, isKamikaze: false };
    const pieBid: Bid = { team: 'ellos', value: 2, isKamikaze: false };

    const winner = determineRoundWinner(manoBid, pieBid, 2, 2); // Mano: 2/3, Pie: 2/2
    assert.equal(winner, 'ellos');
  });

  test('Both lost if both miss their bids', () => {
    const manoBid: Bid = { team: 'nosotros', value: 3, isKamikaze: false };
    const pieBid: Bid = { team: 'ellos', value: 2, isKamikaze: false };

    const winner = determineRoundWinner(manoBid, pieBid, 2, 1); // Mano: 2/3, Pie: 1/2
    assert.equal(winner, 'both_lost');
  });

  test('Both met: higher score wins', () => {
    const manoBid: Bid = { team: 'nosotros', value: 3, isKamikaze: false };
    const pieBid: Bid = { team: 'ellos', value: 2, isKamikaze: false };

    // Mano: 3/3 = 10+3 = 13
    // Pie: 2/2 = 10+2 = 12
    const winner = determineRoundWinner(manoBid, pieBid, 3, 2);
    assert.equal(winner, 'nosotros');

    // Mano: 2/3 = -1
    // Pie: 1/2 = -1 (but wins if scores are same due to Pie higher bid met)
    // Actually this case shows both met their bid, let me recalculate...
    // Let me check: Mano bid 3 but won 2 → didn't meet. Pie bid 2 but won 1 → didn't meet
    // So actually both_lost
  });
});

describe('Edge Cases', () => {
  test('Score with Kamikaze declared and won all', () => {
    const bid: Bid = { team: 'nosotros', value: 6, isKamikaze: true };

    assert.equal(calculateScore(bid, 6), 16); // 10 + 6
  });

  test('Score with Kamikaze declared and won none', () => {
    const bid: Bid = { team: 'nosotros', value: 0, isKamikaze: true };

    assert.equal(calculateScore(bid, 0), 10); // 10 + 0 (Kamikaze all-or-nothing met)
  });

  test('Kamikaze all-or-nothing: bid 6 or bid 0 only', () => {
    // When Kamikaze is declared, only 0 or max (6) are valid
    // This is enforced in UI, not in scoring logic
    // But scoring should handle it
    const kamikazeFull: Bid = { team: 'nosotros', value: 6, isKamikaze: true };
    const kamikazeNone: Bid = { team: 'nosotros', value: 0, isKamikaze: true };

    assert.equal(calculateScore(kamikazeFull, 6), 16); // win all: 10+6
    assert.equal(calculateScore(kamikazeFull, 5), -1); // lose 1: -(6-5)
    assert.equal(calculateScore(kamikazeNone, 0), 10); // win none: 10+0
    assert.equal(calculateScore(kamikazeNone, 1), -1); // lose 1: -(1-0)
  });
});
