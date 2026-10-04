import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACES, HEAD_FACES, LED_FACES, avatarOrRandom, faceKind, isFace, randomAvatar, sameAvatar, sanitizeAvatar } from './avatar.js';

test('there are thirty LED masks and six heads, all different', () => {
  assert.equal(LED_FACES.length, 30);
  assert.equal(HEAD_FACES.length, 6);
  assert.equal(new Set(FACES).size, FACES.length);
  assert.equal(FACES.length, 36);
});

test('a random avatar is always well formed, whatever the dice say', () => {
  for (const r of [0, 0.2, 0.5, 0.999999, 1]) {
    const a = randomAvatar(() => r); // (1 is out of range for an rng, but it must still not escape)
    assert.deepEqual(sanitizeAvatar(a), a);
  }
  for (let i = 0; i < 200; i++) assert.ok(sanitizeAvatar(randomAvatar()));
});

test('every face can come up', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 4000; i++) seen.add(randomAvatar().face);
  assert.equal(seen.size, FACES.length);
});

test('anything malformed is refused, so made-up faces never travel', () => {
  assert.deepEqual(sanitizeAvatar({ face: 'led:payaso' }), { face: 'led:payaso' });
  assert.deepEqual(sanitizeAvatar({ face: 'cabeza:gallo' }), { face: 'cabeza:gallo' });
  assert.equal(sanitizeAvatar(null), null);
  assert.equal(sanitizeAvatar('led:payaso'), null);
  assert.equal(sanitizeAvatar({ face: 'led:nadie' }), null);
  assert.equal(sanitizeAvatar({ face: 'cabeza:payaso' }), null); // a mask's name under the heads
  assert.equal(sanitizeAvatar({ face: 7 }), null);
  assert.equal(isFace('led:'), false);
});

test('an avatar from before (eyes, mouth, brows) is refused, and avatarOrRandom draws a new one', () => {
  assert.equal(sanitizeAvatar({ eyes: 1, mouth: 2, brows: 3, eyeColor: 5 }), null);
  assert.ok(sanitizeAvatar(avatarOrRandom({ eyes: 1, mouth: 2, brows: 3, eyeColor: 5 })));
});

test('sanitize copies only the face', () => {
  const a = sanitizeAvatar({ face: 'led:oni', evil: 'x' });
  assert.ok(a && !('evil' in a));
});

test('avatarOrRandom keeps a good one and replaces a bad one', () => {
  assert.ok(sameAvatar(avatarOrRandom({ face: 'cabeza:santo' }), { face: 'cabeza:santo' }));
  assert.ok(sanitizeAvatar(avatarOrRandom({ face: 99 })));
  assert.ok(sanitizeAvatar(avatarOrRandom(undefined)));
});

test('faceKind splits the kind from the name', () => {
  assert.deepEqual(faceKind('led:calavera-rosa'), { kind: 'led', name: 'calavera-rosa' });
  assert.deepEqual(faceKind('cabeza:ventrilocuo'), { kind: 'cabeza', name: 'ventrilocuo' });
});
