import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gazeToward } from '@la-base/shared';
import { SenaDelivery, DWELL_MS, type SenaPayload } from './senaDelivery.js';

// seats 0..3; teams alternate, so 0/2 and 1/3 are partners
const room = { roomCode: 'R', players: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, socketId: `s-${id}`, team: i % 2 ? 'ellos' : 'nosotros' })) };
const setup = () => {
  let t = 1000;
  const got: Array<[string, SenaPayload]> = [];
  const d = new SenaDelivery((sid, p) => got.push([sid, p]), () => t);
  return { d, got, advance: (ms: number) => (t += ms), to: (id: string) => got.filter(([s]) => s === `s-${id}`) };
};

test('partners always receive it; a rival looking at the table does not', () => {
  const { d, to } = setup();
  d.look(room, 'b', { yaw: 0, pitch: -0.34 })
  d.make(room, 'a', 'tres', gazeToward(0, 2, 4));
  assert.equal(to('c').length, 1);
  assert.equal(to('b').length, 0);
  assert.equal(to('d').length, 0);
});

test('a rival already looking at the face receives it at once', () => {
  const { d, to, advance } = setup();
  d.look(room, 'b', gazeToward(1, 0, 4));
  advance(DWELL_MS + 10);
  d.make(room, 'a', 'dos', gazeToward(0, 2, 4)); // signer looks at their partner: b sees a ¾ view
  assert.equal(to('b').length, 1);
  assert.equal(to('b')[0][1].elapsed, 0);
});

test('a rival who turns to the face mid-seña gets the rest of it after the dwell', async () => {
  const { d, to, advance } = setup();
  d.make(room, 'a', 'porno', gazeToward(0, 1, 4));
  advance(500);
  d.look(room, 'b', gazeToward(1, 0, 4));
  assert.equal(to('b').length, 0); // not yet: the gaze must rest
  advance(DWELL_MS);
  await new Promise((r) => setTimeout(r, DWELL_MS + 30));
  assert.equal(to('b').length, 1);
  assert.ok(to('b')[0][1].elapsed >= 500);
});

test('a face turned practically away shows nothing', () => {
  const { d, to, advance } = setup();
  d.look(room, 'b', gazeToward(1, 0, 4));
  advance(DWELL_MS + 10);
  const away = gazeToward(0, 1, 4).yaw > 0 ? -1.5 : 1.5;
  d.make(room, 'a', 'nada', { yaw: away, pitch: 0 });
  assert.equal(to('b').length, 0);
});
