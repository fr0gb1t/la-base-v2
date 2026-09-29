/**
 * Unit tests for game structures
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  getStructure,
  getTotalBases,
  getBasesForRound,
  isValidStructure,
  isValidCustomStructure,
} from './structures.js';

describe('Game Structures', () => {
  test('Clásica structure has correct sequence', () => {
    const seq = getStructure('clasica');
    assert.deepEqual(seq, [1, 3, 5, 5, 3, 1, 1, 3, 5, 5, 3, 1]);
  });

  test('Alternativa structure has correct sequence', () => {
    const seq = getStructure('alternativa');
    assert.deepEqual(seq, [1, 3, 5, 6, 6, 5, 3, 1, 1, 3, 5, 6, 6, 5, 3, 1]);
  });

  test('Postpandemia structure has correct sequence', () => {
    const seq = getStructure('postpandemia');
    assert.deepEqual(seq, [1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1]);
  });

  test('Custom structure can be provided', () => {
    const custom = [1, 2, 3, 4, 5];
    const seq = getStructure('custom', custom);
    assert.deepEqual(seq, custom);
  });

  test('Custom structure without array falls back to Clásica', () => {
    const seq = getStructure('custom');
    assert.deepEqual(seq, [1, 3, 5, 5, 3, 1, 1, 3, 5, 5, 3, 1]);
  });

  test('getTotalBases sums all bases in structure', () => {
    assert.equal(getTotalBases('clasica'), 36); // sum([1,3,5,5,3,1,1,3,5,5,3,1]) = 36
    assert.equal(getTotalBases('alternativa'), 60); // sum([1,3,5,6,6,5,3,1,1,3,5,6,6,5,3,1]) = 60
    assert.equal(getTotalBases('postpandemia'), 42); // sum([1,2,3,4,5,6,6,5,4,3,2,1]) = 42
  });

  test('getTotalBases works with custom structure', () => {
    const custom = [2, 4, 6, 8];
    assert.equal(getTotalBases('custom', custom), 20);
  });

  test('getBasesForRound returns correct number for each round', () => {
    assert.equal(getBasesForRound('clasica', 0), 1);
    assert.equal(getBasesForRound('clasica', 1), 3);
    assert.equal(getBasesForRound('clasica', 2), 5);
    assert.equal(getBasesForRound('clasica', 5), 1);
    assert.equal(getBasesForRound('clasica', 11), 1);
  });

  test('getBasesForRound handles out of bounds gracefully', () => {
    assert.equal(getBasesForRound('clasica', 999), 0);
  });

  test('isValidStructure checks predefined structures', () => {
    assert.ok(isValidStructure('clasica'));
    assert.ok(isValidStructure('alternativa'));
    assert.ok(isValidStructure('postpandemia'));
    assert.ok(!isValidStructure('invalid'));
    assert.ok(!isValidStructure('custom'));
  });

  test('isValidCustomStructure validates custom arrays', () => {
    assert.ok(isValidCustomStructure([1, 2, 3]));
    assert.ok(isValidCustomStructure([5, 5, 5, 5, 5, 5]));
    assert.ok(isValidCustomStructure([1]));
    assert.ok(isValidCustomStructure(new Array(20).fill(1))); // max 20 rounds

    assert.ok(!isValidCustomStructure([])); // empty
    assert.ok(!isValidCustomStructure(new Array(21).fill(1))); // too many rounds
    assert.ok(!isValidCustomStructure([0, 1, 2])); // 0 is invalid
    assert.ok(!isValidCustomStructure([13, 1, 2])); // > 12 is invalid
    assert.ok(!isValidCustomStructure('not-an-array' as any));
  });
});

describe('Clásica Structure Properties', () => {
  test('Clásica has 12 rounds', () => {
    const seq = getStructure('clasica');
    assert.equal(seq.length, 12);
  });

  test('Clásica is symmetric (palindrome-like)', () => {
    const seq = getStructure('clasica');
    // [1,3,5,5,3,1,1,3,5,5,3,1] - has two symmetric halves
    assert.deepEqual(seq.slice(0, 6), [1, 3, 5, 5, 3, 1]);
    assert.deepEqual(seq.slice(6), [1, 3, 5, 5, 3, 1]);
  });

  test('Clásica has peak at middle rounds', () => {
    const seq = getStructure('clasica');
    assert.equal(seq[2], 5); // peak
    assert.equal(seq[3], 5); // peak
  });
});

describe('Postpandemia Structure Properties', () => {
  test('Postpandemia has 12 rounds', () => {
    const seq = getStructure('postpandemia');
    assert.equal(seq.length, 12);
  });

  test('Postpandemia has progressive increase then decrease', () => {
    const seq = getStructure('postpandemia');
    // [1,2,3,4,5,6,6,5,4,3,2,1] - pyramid shape
    assert.deepEqual(seq, [1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1]);
  });
});
