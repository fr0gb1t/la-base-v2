/**
 * Optional access log: one JSON object per line, so the owner (and Ward) can see who connects.
 *
 * Off unless ACCESS_LOG_PATH is set. It holds visitor IPs, so the file is private (0600), and it
 * never holds emails, usernames, passwords, tokens or game content: only the fields below.
 * Logging can never break the game: I/O errors are swallowed (reported once per message).
 */
import { appendFileSync, renameSync, statSync } from 'node:fs';
import type { IpSource } from './clientIp.js';

export interface AccessEvent {
  ip: string;
  ipSource: IpSource;
  event: 'connect' | 'disconnect' | 'auth' | 'join-failed' | 'rejected-origin';
  result: 'ok' | 'fail';
  /** The Origin header, or null when the client sent none (not a browser page). */
  origin: string | null;
  /** Room code of a failed join; null otherwise. */
  room: string | null;
  /** '/api/auth/login' or '/api/auth/register' for auth events; null otherwise. */
  path: string | null;
}

export interface AccessLog {
  record(event: AccessEvent): void;
}

const CONTRACT_VERSION = 1;
const MAX_FIELD_CHARS = 200;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

const cut = (value: string | null): string | null => (value === null ? null : String(value).slice(0, MAX_FIELD_CHARS));

export function createAccessLog(path: string | null, opts: { now?: () => number; maxBytes?: number } = {}): AccessLog {
  if (!path) return { record() {} };
  const now = opts.now ?? Date.now;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const reported = new Set<string>();

  return {
    record(event) {
      try {
        // Explicit whitelist: a caller passing a richer object cannot leak extra fields into the file.
        const line = JSON.stringify({
          v: CONTRACT_VERSION,
          ts: now(),
          ip: cut(event.ip),
          ipSource: event.ipSource,
          event: event.event,
          result: event.result,
          origin: cut(event.origin),
          room: cut(event.room),
          path: cut(event.path),
        });
        let size = 0;
        try {
          size = statSync(path).size;
        } catch (error) {
          // No file yet: the append below creates it. Anything else is a real problem.
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        // A failing rotation reaches the reporter below instead of letting the file grow unseen.
        if (size >= maxBytes) renameSync(path, `${path}.1`);
        appendFileSync(path, `${line}\n`, { mode: 0o600 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!reported.has(message)) {
          reported.add(message);
          console.error(`Access log disabled for this error (${path}): ${message}`);
        }
      }
    },
  };
}
