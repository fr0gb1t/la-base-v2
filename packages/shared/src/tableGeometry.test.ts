import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eyePosition, gazeDirection, gazeToward, headPosition, seatSpot, seatUnderAim, seesFace } from './tableGeometry.js';

test('a seat with no head turn looks at the table centre', () => {
  for (const n of [4, 6, 8]) {
    for (let s = 0; s < n; s++) {
      const d = gazeDirection(s, n, { yaw: 0, pitch: 0 });
      const a = Math.PI / 2 + (s / n) * Math.PI * 2;
      assert.ok(Math.abs(d.x + Math.cos(a)) < 1e-9 && Math.abs(d.z + Math.sin(a)) < 1e-9);
    }
  }
});

test('looking straight at a face that looks back: seen, at every table size', () => {
  for (const n of [4, 6, 8]) {
    for (let s = 1; s < n; s++) assert.ok(seesFace(0, gazeToward(0, s, n), s, gazeToward(s, 0, n), n), `n=${n} seat ${s}`);
  }
});

test('looking elsewhere: not seen', () => {
  assert.ok(!seesFace(0, { yaw: 0, pitch: -0.34 }, 1, gazeToward(1, 0, 4), 4)); // eyes on the table
  assert.ok(!seesFace(0, gazeToward(0, 3, 4), 1, gazeToward(1, 0, 4), 4)); // the other neighbour
});

test('a profile still shows the seña; a face turned practically away does not', () => {
  const look = gazeToward(0, 1, 4);
  assert.ok(seesFace(0, look, 1, { yaw: 0, pitch: 0 }, 4)); // the neighbour looks at the centre: ¾ / profile
  assert.ok(seesFace(0, look, 1, gazeToward(1, 2, 4), 4)); // looking at their partner across
  const away = gazeToward(1, 0, 4).yaw > 0 ? -1.5 : 1.5; // as far from you as a head turns
  assert.ok(!seesFace(0, look, 1, { yaw: away, pitch: 0 }, 4));
});

// pointing at where someone sits is enough: their chest, or their place on the table
const gazeAt = (viewer: number, p: { x: number; y: number; z: number }, n: number) => {
  const e = eyePosition(viewer, n);
  let yaw = Math.atan2(-(p.x - e.x), -(p.z - e.z)) - (Math.PI / 2 - (Math.PI / 2 + (viewer / n) * Math.PI * 2));
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  return { yaw, pitch: Math.atan2(p.y - e.y, Math.hypot(p.x - e.x, p.z - e.z)) };
};

test('aiming at the neighbour\'s place on the table reads their face (not only the exact face)', () => {
  for (const n of [4, 6, 8]) {
    const look = gazeAt(0, seatSpot(1, n), n);
    assert.ok(seesFace(0, look, 1, gazeToward(1, 0, n), n), `n=${n}: their place on the table`);
    const chest = { ...headPosition(1, n), y: 1.05 }; // their body, a little under the head
    assert.ok(seesFace(0, gazeAt(0, chest, n), 1, gazeToward(1, 0, n), n), `n=${n}: their chest`);
  }
});

test('the zone is wider than the face but never reaches the next player, with 8 at the table', () => {
  const n = 8;
  // looking at the seat-2 place from seat 0 must not read seat 1 or seat 3 (their neighbours)
  const look = gazeAt(0, seatSpot(2, n), n);
  assert.ok(seesFace(0, look, 2, gazeToward(2, 0, n), n));
  assert.ok(!seesFace(0, look, 1, gazeToward(1, 0, n), n));
  assert.ok(!seesFace(0, look, 3, gazeToward(3, 0, n), n));
});

test('you never read your own seat, and a seat behind you is never aimed at', () => {
  const n = 4;
  const e = eyePosition(0, n);
  const toCentre = gazeDirection(0, n, { yaw: 0, pitch: -0.5 });
  assert.notEqual(seatUnderAim(e, toCentre, n, 0), 0);
  const back = { x: -toCentre.x, y: 0, z: -toCentre.z }; // turned right around: the table is behind
  assert.equal(seatUnderAim(e, back, n, 0), -1);
});
