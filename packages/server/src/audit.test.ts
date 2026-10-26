import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudit } from './audit.js';
import type { AccessEvent, AccessLog } from './accessLog.js';

function memoryLog() {
  const events: AccessEvent[] = [];
  const log: AccessLog = { record: (e) => void events.push(e) };
  return { events, log };
}

function fakeSocket(address: string, headers: Record<string, string | string[] | undefined> = {}) {
  const listeners: Array<() => void> = [];
  return {
    socket: { handshake: { address, headers }, on: (_event: 'disconnect', fn: () => void) => void listeners.push(fn) },
    disconnect: () => listeners.forEach((fn) => fn()),
  };
}

test('a connection behind cloudflared records the real IP, where it came from and the page origin', () => {
  const { events, log } = memoryLog();
  const { socket } = fakeSocket('127.0.0.1', { 'cf-connecting-ip': '203.0.113.9', origin: 'https://labase.frogbit.com.ar' });
  createAudit(log).connected(socket);
  assert.deepEqual(events, [{ ip: '203.0.113.9', ipSource: 'cf', event: 'connect', result: 'ok', origin: 'https://labase.frogbit.com.ar', room: null, path: null }]);
});

test('a client that sent no Origin is recorded with origin null (it did not come from the page)', () => {
  const { events, log } = memoryLog();
  createAudit(log).connected(fakeSocket('127.0.0.1', { 'cf-connecting-ip': '203.0.113.9' }).socket);
  assert.equal(events[0]?.origin, null);
});

test('forged forwarding headers from a peer that is not cloudflared are ignored', () => {
  const { events, log } = memoryLog();
  createAudit(log).connected(fakeSocket('198.51.100.7', { 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '1.2.3.4' }).socket);
  assert.deepEqual([events[0]?.ip, events[0]?.ipSource], ['198.51.100.7', 'socket']);
});

test('disconnect is recorded once, with the same visitor', () => {
  const { events, log } = memoryLog();
  const { socket, disconnect } = fakeSocket('127.0.0.1', { 'cf-connecting-ip': '203.0.113.9' });
  createAudit(log).connected(socket);
  disconnect();
  assert.deepEqual(events.map((e) => e.event), ['connect', 'disconnect']);
  assert.equal(events[1]?.ip, '203.0.113.9');
});

test('a failed join keeps the room code as text, and never an object payload', () => {
  const { events, log } = memoryLog();
  const audit = createAudit(log);
  const { socket } = fakeSocket('127.0.0.1', { 'cf-connecting-ip': '203.0.113.9' });
  audit.joinFailed(socket, 'ABCD');
  audit.joinFailed(socket, { evil: true });
  assert.deepEqual(events.map((e) => [e.event, e.result, e.room]), [['join-failed', 'fail', 'ABCD'], ['join-failed', 'fail', null]]);
});

test('a rejected origin is recorded with the refused Origin', () => {
  const { events, log } = memoryLog();
  createAudit(log).rejectedOrigin('127.0.0.1', { 'cf-connecting-ip': '203.0.113.9', origin: 'https://evil.example' });
  assert.deepEqual(events[0], { ip: '203.0.113.9', ipSource: 'cf', event: 'rejected-origin', result: 'fail', origin: 'https://evil.example', room: null, path: null });
});

const request = (url: string, method = 'POST', headers: Record<string, string> = { 'cf-connecting-ip': '203.0.113.9' }) =>
  ({ method, url, headers, raw: { socket: { remoteAddress: '127.0.0.1' } } });

test('login and register outcomes are recorded: success below 400, failure from 400', () => {
  const { events, log } = memoryLog();
  const audit = createAudit(log);
  audit.http(request('/api/auth/login'), 200);
  audit.http(request('/api/auth/login'), 401);
  audit.http(request('/api/auth/register?x=1'), 400);
  assert.deepEqual(events.map((e) => [e.event, e.result, e.path]), [
    ['auth', 'ok', '/api/auth/login'],
    ['auth', 'fail', '/api/auth/login'],
    ['auth', 'fail', '/api/auth/register'],
  ]);
});

test('other requests are not recorded', () => {
  const { events, log } = memoryLog();
  const audit = createAudit(log);
  audit.http(request('/api/rankings', 'GET'), 200);
  audit.http(request('/api/auth/login', 'GET'), 404);
  audit.http(request('/health', 'GET'), 200);
  assert.deepEqual(events, []);
});

test('nothing from the request body can reach an event', () => {
  const { events, log } = memoryLog();
  const withBody = { ...request('/api/auth/login'), body: { email: 'a@b.com', password: 'hunter2' } } as unknown as Parameters<ReturnType<typeof createAudit>['http']>[0];
  createAudit(log).http(withBody, 401);
  const text = JSON.stringify(events);
  assert.equal(text.includes('a@b.com') || text.includes('hunter2'), false);
});

test('a percent-encoded login path is still a login (the router decodes it, so must the log)', () => {
  const { events, log } = memoryLog();
  createAudit(log).http(request('/api/auth/log%69n'), 401);
  assert.deepEqual(events.map((e) => [e.event, e.result, e.path]), [['auth', 'fail', '/api/auth/login']]);
});

test('a path with broken percent-encoding is ignored instead of throwing', () => {
  const { events, log } = memoryLog();
  assert.doesNotThrow(() => createAudit(log).http(request('/api/auth/log%zzin'), 401));
  assert.deepEqual(events, []);
});

test('a 5xx (for example the 503 of guest mode without a database) is not a failed login attempt', () => {
  const { events, log } = memoryLog();
  const audit = createAudit(log);
  audit.http(request('/api/auth/login'), 503);
  audit.http(request('/api/auth/register'), 500);
  assert.deepEqual(events, []);
});
