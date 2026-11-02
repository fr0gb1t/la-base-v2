/**
 * Server configuration read from the environment.
 * In production, missing security settings stop the server at startup
 * instead of silently falling back to insecure defaults.
 */

import { isAbsolute } from 'node:path';

const DEV_JWT_SECRET = 'dev_secret_change_in_prod';
const MIN_JWT_SECRET_LENGTH = 32;

export interface ServerConfig {
  isProduction: boolean;
  host: string;
  jwtSecret: string;
  corsOrigins: string[] | '*';
  trustProxy: string;
  /** JSON-lines access log (visitor IPs); null = off. */
  accessLogPath: string | null;
}

type Env = Record<string, string | undefined>;

function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function loadServerConfig(env: Env): ServerConfig {
  const isProduction = env.NODE_ENV === 'production';
  const origins = parseOrigins(env.CORS_ORIGINS);

  if (isProduction) {
    if (!env.JWT_SECRET || env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET must be set to at least ${MIN_JWT_SECRET_LENGTH} characters in production`);
    }
    if (origins.length === 0 || origins.includes('*')) {
      throw new Error('CORS_ORIGINS must list the allowed client origins in production (no "*")');
    }
  }

  const accessLogPath = env.ACCESS_LOG_PATH?.trim() || null;
  if (accessLogPath !== null && !isAbsolute(accessLogPath)) {
    throw new Error('ACCESS_LOG_PATH must be an absolute path');
  }

  return {
    isProduction,
    // Behind a Cloudflare Tunnel the only client is cloudflared on this host,
    // so production listens on loopback unless HOST says otherwise.
    host: env.HOST || (isProduction ? '127.0.0.1' : '0.0.0.0'),
    jwtSecret: env.JWT_SECRET || DEV_JWT_SECRET,
    corsOrigins: origins.length > 0 ? origins : '*',
    // Only trust X-Forwarded-* from cloudflared on the same host.
    trustProxy: env.TRUST_PROXY || 'loopback',
    accessLogPath,
  };
}

export const config = loadServerConfig(process.env);
