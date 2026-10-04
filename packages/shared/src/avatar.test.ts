import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_KINDS, EYE_COLORS, avatarOrRandom, randomAvatar, sameAvatar, sanitizeAvatar } from './avatar.js';

test('a random avatar is always well formed, whatever the dice say', () => {
  for (const r of [0, 0.2, 0.5, 0.999999, 1]) {
    const a = randomAvatar(() => r); // (1 is out of range for an rng, but it must still not escape the ranges)
    assert.deepEqual(sanitizeAvatar(a), a);
  }
  for (let i = 0; i < 200; i++) assert.ok(sanitizeAvatar(randomAvatar()));
});

test('every kind of every part, and every colour, can come up', () => {
  const seen = { eyes: new Set<number>(), mouth: new Set<number>(), brows: new Set<number>(), symbol: new Set<number>(), eyeColor: new Set<number>() };
  for (let i = 0; i < 2000; i++) {
    const a = randomAvatar();
    for (const k of Object.keys(seen) as Array<keyof typeof seen>) seen[k].add(a[k]);
  }
  assert.equal(seen.eyes.size, AVATAR_KINDS);
  assert.equal(seen.mouth.size, AVATAR_KINDS);
  assert.equal(seen.brows.size, AVATAR_KINDS);
  assert.equal(seen.symbol.size, AVATAR_KINDS);
  assert.equal(seen.eyeColor.size, EYE_COLORS);
});

test('anything malformed is refused, so made-up numbers never travel', () => {
  const ok = { eyes: 1, mouth: 2, brows: 3, symbol: 4, eyeColor: 5 };
  assert.deepEqual(sanitizeAvatar(ok), ok);
  assert.equal(sanitizeAvatar(null), null);
  assert.equal(sanitizeAvatar('x'), null);
  assert.equal(sanitizeAvatar({ ...ok, eyes: 5 }), null); // one past the last kind
  assert.equal(sanitizeAvatar({ ...ok, eyeColor: 6 }), null);
  assert.equal(sanitizeAvatar({ ...ok, symbol: 5 }), null);
  assert.equal(sanitizeAvatar({ ...ok, mouth: -1 }), null);
  assert.equal(sanitizeAvatar({ ...ok, brows: 1.5 }), null);
  assert.equal(sanitizeAvatar({ ...ok, eyes: '2' }), null);
  assert.equal(sanitizeAvatar({ eyes: 0 }), null);
});

test('sanitize copies only the known fields', () => {
  const a = sanitizeAvatar({ eyes: 0, mouth: 0, brows: 0, symbol: 0, eyeColor: 0, evil: 'x' });
  assert.ok(a && !('evil' in a));
});

test('an avatar from before the symbol or with the old hair fields is still good', () => {
  const a = sanitizeAvatar({ eyes: 1, mouth: 2, brows: 3, hair: 4, eyeColor: 5, hairColor: 6 });
  assert.deepEqual(a, { eyes: 1, mouth: 2, brows: 3, symbol: 0, eyeColor: 5 }); // no hair, and the first symbol
});

test('avatarOrRandom keeps a good one and replaces a bad one', () => {
  const ok = { eyes: 4, mouth: 3, brows: 2, symbol: 1, eyeColor: 0 };
  assert.ok(sameAvatar(avatarOrRandom(ok), ok));
  assert.ok(sanitizeAvatar(avatarOrRandom({ eyes: 99 })));
  assert.ok(sanitizeAvatar(avatarOrRandom(undefined)));
});
