import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avatarOrRandom, randomAvatar, sanitizeAvatar } from '@la-base/shared';

// The rule the sockets apply (room:create / room:join): the avatar sent if it is well formed, the one the
// player already had, or a random one; and the host's avatar is always well formed.
const joinAvatar = (sent: unknown, had?: ReturnType<typeof randomAvatar>) => sanitizeAvatar(sent) ?? had ?? randomAvatar();

test('a made-up avatar is replaced, never forwarded', () => {
  const evil = { eyes: 999, mouth: -3, brows: 'x', eyeColor: 1e9 };
  const out = joinAvatar(evil);
  assert.deepEqual(sanitizeAvatar(out), out);
  assert.notDeepEqual(out, evil);
  assert.ok(sanitizeAvatar(avatarOrRandom(evil)));
});

test('a good avatar is kept; a bad one falls back to what the player already had', () => {
  const had = { eyes: 1, mouth: 1, brows: 1, symbol: 1, eyeColor: 1 };
  assert.deepEqual(joinAvatar({ eyes: 4, mouth: 3, brows: 2, symbol: 3, eyeColor: 0 }, had), { eyes: 4, mouth: 3, brows: 2, symbol: 3, eyeColor: 0 });
  assert.deepEqual(joinAvatar({ eyes: 99 }, had), had);
});
