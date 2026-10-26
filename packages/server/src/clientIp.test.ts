import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientIp } from './clientIp.js';

const REAL = '203.0.113.9';

test('behind cloudflared, CF-Connecting-IP is the visitor', () => {
  assert.deepEqual(resolveClientIp('127.0.0.1', { 'cf-connecting-ip': REAL }), { ip: REAL, source: 'cf' });
});

test('every loopback spelling counts as cloudflared', () => {
  for (const peer of ['127.0.0.1', '127.3.4.5', '::1', '::ffff:127.0.0.1']) {
    assert.equal(resolveClientIp(peer, { 'cf-connecting-ip': REAL }).ip, REAL, peer);
  }
});

test('without CF-Connecting-IP the LAST X-Forwarded-For value is used (the one Cloudflare appends)', () => {
  assert.deepEqual(resolveClientIp('127.0.0.1', { 'x-forwarded-for': `6.6.6.6, ${REAL}` }), { ip: REAL, source: 'xff' });
});

test('a garbage CF-Connecting-IP falls through to X-Forwarded-For, and garbage everywhere to the socket', () => {
  assert.equal(resolveClientIp('127.0.0.1', { 'cf-connecting-ip': 'not-an-ip', 'x-forwarded-for': REAL }).source, 'xff');
  assert.deepEqual(resolveClientIp('127.0.0.1', { 'cf-connecting-ip': 'nope', 'x-forwarded-for': 'also, nope' }), { ip: '127.0.0.1', source: 'socket' });
});

test('a peer that is not loopback cannot vouch for anyone: headers are ignored', () => {
  const forged = { 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' };
  assert.deepEqual(resolveClientIp('198.51.100.7', forged), { ip: '198.51.100.7', source: 'socket' });
  assert.deepEqual(resolveClientIp('::ffff:198.51.100.7', forged), { ip: '198.51.100.7', source: 'socket' });
});

test('IPv6 visitors are accepted and lowercased', () => {
  assert.equal(resolveClientIp('::1', { 'cf-connecting-ip': '2001:DB8::1' }).ip, '2001:db8::1');
});

test('an IPv4-mapped IPv6 visitor is normalised to IPv4', () => {
  assert.equal(resolveClientIp('::1', { 'cf-connecting-ip': '::ffff:203.0.113.9' }).ip, REAL);
});

test('header arrays are joined and whitespace trimmed', () => {
  assert.equal(resolveClientIp('127.0.0.1', { 'x-forwarded-for': ['6.6.6.6', `  ${REAL}  `] }).ip, REAL);
});

test('a missing peer address is unknown, never an invented one', () => {
  assert.deepEqual(resolveClientIp(undefined, { 'cf-connecting-ip': REAL }), { ip: 'unknown', source: 'socket' });
});
