import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gazeDirection, gazeToward, seesFace } from './tableGeometry.js';

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
