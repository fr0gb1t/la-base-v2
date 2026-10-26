import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadServerConfig } from './config.js';

const PROD_ENV = {
  NODE_ENV: 'production',
  JWT_SECRET: 'x'.repeat(32),
  CORS_ORIGINS: 'https://labase.frogbit.com.ar',
};

test('production refuses to start without JWT_SECRET', () => {
  assert.throws(() => loadServerConfig({ ...PROD_ENV, JWT_SECRET: undefined }), /JWT_SECRET/);
});

test('production refuses a short JWT_SECRET', () => {
  assert.throws(() => loadServerConfig({ ...PROD_ENV, JWT_SECRET: 'short' }), /JWT_SECRET/);
});

test('production refuses to start without CORS_ORIGINS', () => {
  assert.throws(() => loadServerConfig({ ...PROD_ENV, CORS_ORIGINS: undefined }), /CORS_ORIGINS/);
});

test('production refuses a wildcard CORS origin', () => {
  assert.throws(() => loadServerConfig({ ...PROD_ENV, CORS_ORIGINS: '*' }), /CORS_ORIGINS/);
});

test('CORS_ORIGINS is split on commas and trimmed', () => {
  const config = loadServerConfig({ ...PROD_ENV, CORS_ORIGINS: ' https://a.com , https://b.com ,' });
  assert.deepEqual(config.corsOrigins, ['https://a.com', 'https://b.com']);
});

test('development falls back to a dev secret and any origin', () => {
  const config = loadServerConfig({});
  assert.equal(config.corsOrigins, '*');
  assert.ok(config.jwtSecret.length > 0);
});

test('trustProxy defaults to loopback only (cloudflared on the same host)', () => {
  assert.equal(loadServerConfig(PROD_ENV).trustProxy, 'loopback');
});

test('TRUST_PROXY overrides the trusted proxy list', () => {
  assert.equal(loadServerConfig({ ...PROD_ENV, TRUST_PROXY: '172.17.0.0/16' }).trustProxy, '172.17.0.0/16');
});

test('HOST defaults to 0.0.0.0 in development and 127.0.0.1 in production', () => {
  assert.equal(loadServerConfig({}).host, '0.0.0.0');
  assert.equal(loadServerConfig(PROD_ENV).host, '127.0.0.1');
  assert.equal(loadServerConfig({ ...PROD_ENV, HOST: '0.0.0.0' }).host, '0.0.0.0');
});

test('ACCESS_LOG_PATH is off by default and an absolute path is kept', () => {
  assert.equal(loadServerConfig(PROD_ENV).accessLogPath, null);
  assert.equal(loadServerConfig({ ...PROD_ENV, ACCESS_LOG_PATH: '/var/lib/la-base/access.jsonl' }).accessLogPath, '/var/lib/la-base/access.jsonl');
});

test('ACCESS_LOG_PATH must be absolute: a relative one would land wherever the server was started', () => {
  assert.throws(() => loadServerConfig({ ...PROD_ENV, ACCESS_LOG_PATH: 'access.jsonl' }), /ACCESS_LOG_PATH/);
});
