import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBidClock, clockLeft, pressClock, startClock, BID_CLOCK_OPTIONS } from './bidClock.js';

test('no time chosen: no clock', () => {
  assert.equal(createBidClock(0), null);
  assert.deepEqual(BID_CLOCK_OPTIONS, [0, 60_000, 120_000, 300_000]);
});

test('each team starts with the whole time, stopped', () => {
  const c = createBidClock(60_000)!;
  assert.deepEqual(c.remainingMs, { nosotros: 60_000, ellos: 60_000 });
  assert.equal(c.running, null);
  assert.equal(clockLeft(c, 'nosotros', 5_000), 60_000);
});

test('the running team loses time; pressing passes it to the other team', () => {
  let c = startClock(createBidClock(60_000)!, 'ellos', 1_000);
  assert.equal(clockLeft(c, 'ellos', 11_000), 50_000);
  assert.equal(clockLeft(c, 'nosotros', 11_000), 60_000);
  c = pressClock(c, 11_000, 'nosotros');
  assert.equal(c.remainingMs.ellos, 50_000);
  assert.equal(c.running, 'nosotros');
  assert.equal(clockLeft(c, 'nosotros', 15_000), 56_000);
  // the second press stops it for both (the round is played with the clock stopped)
  c = pressClock(c, 15_000, null);
  assert.equal(c.running, null);
  assert.deepEqual(c.remainingMs, { nosotros: 56_000, ellos: 50_000 });
  assert.equal(clockLeft(c, 'nosotros', 99_000), 56_000);
});

test('time never goes below zero', () => {
  const c = startClock(createBidClock(60_000)!, 'nosotros', 0);
  assert.equal(clockLeft(c, 'nosotros', 90_000), 0);
  assert.equal(pressClock(c, 90_000, 'ellos').remainingMs.nosotros, 0);
});
