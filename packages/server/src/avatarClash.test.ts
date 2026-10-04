import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avatarKey } from '@la-base/shared';
import { clashesWith, settleAll, settleBots, settleKept, tidyKeeps, type Wearer } from './avatarClash.js';

const P = (id: string, face: string, extra: Partial<Wearer> = {}): Wearer => ({ id, avatar: { face } as Wearer['avatar'], ...extra });
const keys = (ps: Wearer[]) => ps.map((p) => avatarKey(p.avatar!));

test('a bot wearing a person’s face moves to a free one; the person keeps theirs', () => {
  const ps = [P('bot', 'led:oni', { isBot: true }), P('ana', 'led:oni')];
  settleBots(ps);
  assert.equal(ps[1].avatar!.face, 'led:oni');
  assert.notEqual(ps[0].avatar!.face, 'led:oni');
  assert.equal(new Set(keys(ps)).size, 2);
});

test('between two bots, the later one moves', () => {
  const ps = [P('b1', 'led:oni', { isBot: true }), P('b2', 'led:oni', { isBot: true })];
  settleBots(ps);
  assert.equal(ps[0].avatar!.face, 'led:oni');
  assert.notEqual(ps[1].avatar!.face, 'led:oni');
});

test('two people with the same face clash until both keep it; then the later one gets a variant', () => {
  const ps = [P('ana', 'led:oni'), P('beto', 'cabeza:gallo'), P('caro', 'led:oni')];
  assert.deepEqual(clashesWith(ps, ps[0]).map((p) => p.id), ['caro']);
  ps[0].avatarKeep = true;
  assert.equal(settleKept(ps), false); // caro has not answered
  ps[2].avatarKeep = true;
  assert.equal(settleKept(ps), true);
  assert.deepEqual(ps.map((p) => p.avatar), [{ face: 'led:oni' }, { face: 'cabeza:gallo' }, { face: 'led:oni', tint: 1 }]);
  assert.ok(ps.every((p) => !p.avatarKeep));
});

test('a stale "me la quedo" is dropped once the clash is gone', () => {
  const ps = [P('ana', 'led:oni', { avatarKeep: true }), P('caro', 'led:gato')];
  tidyKeeps(ps);
  assert.equal(ps[0].avatarKeep, false);
});

test('when the game starts nobody wears the same face as anybody', () => {
  const ps = [P('a', 'led:oni'), P('b', 'led:oni'), P('c', 'led:oni', { avatarKeep: true }), P('d', 'cabeza:santo')];
  settleAll(ps);
  assert.equal(new Set(keys(ps)).size, 4);
  assert.deepEqual(ps[0].avatar, { face: 'led:oni' });
  assert.deepEqual(ps[3].avatar, { face: 'cabeza:santo' });
});
