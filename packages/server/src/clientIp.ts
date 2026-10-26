/**
 * The visitor's real address, behind a Cloudflare Tunnel.
 *
 * cloudflared runs on this host, so its connections arrive from loopback and only then are
 * the headers believed. Cloudflare sets CF-Connecting-IP itself and appends the client to
 * X-Forwarded-For, so the LAST value there is the one Cloudflare wrote; values to its left
 * come from the client and can be forged. A peer that is not loopback gets no say.
 */
import { isIP } from 'node:net';

export type IpSource = 'cf' | 'xff' | 'socket';

export interface ResolvedIp {
  ip: string;
  source: IpSource;
}

type Headers = Record<string, string | string[] | undefined>;

const V4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/** Valid address in canonical form (lowercase, IPv4-mapped IPv6 as plain IPv4), else null. */
function normalize(value: string): string | null {
  const text = value.trim().toLowerCase();
  const mapped = text.match(V4_MAPPED)?.[1];
  const candidate = mapped ?? text;
  return isIP(candidate) ? candidate : null;
}

const isLoopback = (ip: string): boolean => ip === '::1' || ip.startsWith('127.');

function header(headers: Headers, name: string): string {
  const value = headers[name];
  return Array.isArray(value) ? value.join(',') : (value ?? '');
}

export function resolveClientIp(peerAddress: string | undefined, headers: Headers): ResolvedIp {
  const peer = peerAddress ? normalize(peerAddress) : null;
  if (!peer) return { ip: 'unknown', source: 'socket' };
  if (!isLoopback(peer)) return { ip: peer, source: 'socket' };

  const cf = normalize(header(headers, 'cf-connecting-ip'));
  if (cf) return { ip: cf, source: 'cf' };

  const forwarded = header(headers, 'x-forwarded-for').split(',');
  const last = normalize(forwarded[forwarded.length - 1] ?? '');
  if (last) return { ip: last, source: 'xff' };

  return { ip: peer, source: 'socket' };
}
