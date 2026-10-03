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
  test("strict (default): the sum is one less or one more than the round's bases", () => {
    // 5 bases
    assert.deepEqual(getPieValidBidRange(3, 5), [1, 3]); // 3+1=4, 3+3=6
    assert.deepEqual(getPieValidBidRange(2, 5), [2, 4]); // 2+2=4, 2+4=6
    assert.deepEqual(getPieValidBidRange(0, 5), [4]); // 0+4=4 (0+6 is out of range)
    assert.deepEqual(getPieValidBidRange(5, 5), [1]); // 5+1=6 (5-1 would be negative)
    assert.deepEqual(getPieValidBidRange(4, 5), [0, 2]); // 4+0=4, 4+2=6
  });

  test('strict: 3 bases, the Mano asks 3: only 1 (a bid cannot be negative)', () => {
    assert.deepEqual(getPieValidBidRange(3, 3), [1]);
    assert.ok(validatePieBid(3, 1, 3));
    assert.ok(!validatePieBid(3, 0, 3)); // sum = total
  });

  test('strict: there is always an option, for any bases and any Mano bid', () => {
    for (let total = 1; total <= 8; total++) {
      for (let mano = 0; mano <= total; mano++) {
        assert.ok(getPieValidBidRange(mano, total).length > 0, `bases ${total}, Mano ${mano}`);
      }
    }
  });

  test('strict is the default rule', () => {
    assert.ok(validatePieBid(3, 2, 6)); // 5 = 6 - 1
    assert.ok(validatePieBid(3, 4, 6)); // 7 = 6 + 1
    assert.ok(!validatePieBid(3, 1, 6)); // 4
    assert.ok(!validatePieBid(3, 3, 6)); // 6
  });
});

describe('Pie Bid Validation (amplia, the looser house rule)', () => {
  test('any bid, as long as the sum is not exactly the total', () => {
    assert.ok(!validatePieBid(3, 3, 6, 'amplia')); // sum=6
    assert.ok(validatePieBid(3, 2, 6, 'amplia'));
    assert.ok(validatePieBid(3, 4, 6, 'amplia'));
    assert.deepEqual(getPieValidBidRange(3, 6, 'amplia'), [0, 1, 2, 4, 5, 6]);
    assert.deepEqual(getPieValidBidRange(2, 5, 'amplia'), [0, 1, 2, 4, 5]);
    assert.deepEqual(getPieValidBidRange(0, 5, 'amplia'), [0, 1, 2, 3, 4]);
    assert.deepEqual(getPieValidBidRange(6, 6, 'amplia'), [1, 2, 3, 4, 5, 6]);
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
