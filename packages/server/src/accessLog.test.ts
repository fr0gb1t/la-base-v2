import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAccessLog, type AccessEvent } from './accessLog.js';

let dir: string;
let path: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'labase-access-'));
  path = join(dir, 'access.jsonl');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const event = (over: Partial<AccessEvent> = {}): AccessEvent => ({
  ip: '203.0.113.9', ipSource: 'cf', event: 'connect', result: 'ok', origin: 'https://labase.frogbit.com.ar', room: null, path: null, ...over,
});
const lines = (file = path) => readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);

test('records one JSON line per event with the contract version and the timestamp', () => {
  const log = createAccessLog(path, { now: () => 1_793_000_000_000 });
  log.record(event());
  log.record(event({ event: 'auth', result: 'fail', path: '/api/auth/login' }));
  const [first, second] = lines();
  assert.deepEqual(first, { v: 1, ts: 1_793_000_000_000, ...event() });
  assert.equal(second?.event, 'auth');
  assert.equal(lines().length, 2);
});

test('the file is private (0600)', () => {
  createAccessLog(path).record(event());
  assert.equal(statSync(path).mode & 0o777, 0o600);
});

test('without a path nothing is written and record is a harmless no-op', () => {
  createAccessLog(null).record(event());
  assert.equal(existsSync(path), false);
});

test('long strings are cut to 200 characters', () => {
  createAccessLog(path).record(event({ origin: 'https://' + 'a'.repeat(500), room: 'R'.repeat(500) }));
  const [line] = lines();
  assert.equal((line?.origin as string).length, 200);
  assert.equal((line?.room as string).length, 200);
});

test('only the contract fields are written: anything else an event object carries is dropped', () => {
  const leaky = { ...event(), email: 'a@b.com', password: 'hunter2', username: 'fede' } as unknown as AccessEvent;
  createAccessLog(path).record(leaky);
  const text = readFileSync(path, 'utf8');
  for (const secret of ['a@b.com', 'hunter2', 'fede', 'password', 'email']) assert.equal(text.includes(secret), false, secret);
});

test('past the size limit the file rotates to <path>.1 (replacing an older backup) and starts again', () => {
  const log = createAccessLog(path, { maxBytes: 300 });
  for (let i = 0; i < 6; i++) log.record(event({ room: `ROOM${i}` }));
  assert.ok(existsSync(`${path}.1`));
  assert.ok(statSync(path).size < 600);
  const all = [...lines(`${path}.1`), ...lines()];
  assert.equal(all.at(-1)?.room, 'ROOM5');
});

test('a log that cannot be written never throws and reports the problem once', () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void errors.push(args.join(' '));
  try {
    const log = createAccessLog(join(dir, 'missing-dir', 'access.jsonl'));
    assert.doesNotThrow(() => {
      log.record(event());
      log.record(event());
      log.record(event());
    });
  } finally {
    console.error = original;
  }
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? '', /access log/i);
});

test('a rotation that fails is reported, not silently ignored (the file must not grow without bound unseen)', () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void errors.push(args.join(' '));
  try {
    const log = createAccessLog(path, { maxBytes: 50 });
    log.record(event());
    // A directory where the backup should go makes the rename fail.
    mkdirSync(`${path}.1`);
    log.record(event());
    log.record(event());
  } finally {
    console.error = original;
  }
  assert.ok(errors.length >= 1, 'the failed rotation was reported');
  assert.match(errors[0] ?? '', /access log/i);
});
