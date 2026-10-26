/**
 * What the server tells the access log, and nothing more: who connected, and how login,
 * registration and room joins ended. Request bodies are never read here.
 */
import { resolveClientIp } from './clientIp.js';
import type { AccessLog } from './accessLog.js';

type Headers = Record<string, string | string[] | undefined>;

export interface SocketLike {
  handshake: { address: string; headers: Headers };
  on(event: 'disconnect', listener: () => void): unknown;
}

export interface HttpRequestLike {
  method?: string;
  url: string;
  headers: Headers;
  raw: { socket: { remoteAddress?: string } };
}

export interface Audit {
  connected(socket: SocketLike): void;
  joinFailed(socket: SocketLike, roomCode: unknown): void;
  rejectedOrigin(peerAddress: string | undefined, headers: Headers): void;
  http(request: HttpRequestLike, statusCode: number): void;
}

const AUTH_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

const originOf = (headers: Headers): string | null => {
  const value = headers.origin;
  const text = Array.isArray(value) ? value[0] : value;
  return text ? text : null;
};

export function createAudit(log: AccessLog): Audit {
  const who = (peer: string | undefined, headers: Headers) => {
    const { ip, source } = resolveClientIp(peer, headers);
    return { ip, ipSource: source, origin: originOf(headers) };
  };

  return {
    connected(socket) {
      const visitor = who(socket.handshake.address, socket.handshake.headers);
      log.record({ ...visitor, event: 'connect', result: 'ok', room: null, path: null });
      socket.on('disconnect', () => log.record({ ...visitor, event: 'disconnect', result: 'ok', room: null, path: null }));
    },

    joinFailed(socket, roomCode) {
      log.record({
        ...who(socket.handshake.address, socket.handshake.headers),
        event: 'join-failed',
        result: 'fail',
        room: typeof roomCode === 'string' ? roomCode : null,
        path: null,
      });
    },

    rejectedOrigin(peerAddress, headers) {
      log.record({ ...who(peerAddress, headers), event: 'rejected-origin', result: 'fail', room: null, path: null });
    },

    http(request, statusCode) {
      const path = request.url.split('?')[0] ?? '';
      if (request.method !== 'POST' || !AUTH_PATHS.has(path)) return;
      log.record({
        ...who(request.raw.socket.remoteAddress, request.headers),
        event: 'auth',
        result: statusCode < 400 ? 'ok' : 'fail',
        room: null,
        path,
      });
    },
  };
}
