import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

// ─── ANSI colour helpers ──────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  white: '\x1b[97m',
  gray: '\x1b[90m',
  cyan: '\x1b[96m',
  green: '\x1b[92m',
  yellow: '\x1b[93m',
  red: '\x1b[91m',
  magenta: '\x1b[95m',
  blue: '\x1b[94m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgGray: '\x1b[100m',
};

const paint = (...parts: string[]): string => parts.join('') + c.reset;

// ─── Method badge colours ─────────────────────────────────────────────────────
const METHOD_STYLES: Record<string, string> = {
  GET: paint(c.bgBlue, c.bold, c.white),
  POST: paint(c.bgGreen, c.bold, c.white),
  PUT: paint(c.bgYellow, c.bold, c.white),
  PATCH: paint(c.bgYellow, c.bold, c.white),
  DELETE: paint(c.bgRed, c.bold, c.white),
  OPTIONS: paint(c.bgGray, c.bold, c.white),
  HEAD: paint(c.bgGray, c.bold, c.white),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusStyle(code: number): string {
  if (code >= 500) return paint(c.bold, c.red);
  if (code >= 400) return paint(c.bold, c.yellow);
  if (code >= 300) return paint(c.bold, c.cyan);
  return paint(c.bold, c.green);
}

function levelTag(code: number): string {
  if (code >= 500) return paint(c.bgRed, c.bold, c.white, ' ERROR ');
  if (code >= 400) return paint(c.bgYellow, c.bold, c.white, '  WARN ');
  return paint(c.bgGreen, c.bold, c.white, '  INFO ');
}

function durationStyle(ms: number): string {
  if (ms > 2000) return paint(c.bold, c.red, `${ms}ms`);
  if (ms > 500) return paint(c.bold, c.yellow, `${ms}ms`);
  return paint(c.bold, c.green, `${ms}ms`);
}

function writeLog(level: 'info' | 'warn' | 'error', line: string): void {
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

function inlinePayload(value: unknown, indent = 2): string {
  const json = JSON.stringify(value, null, indent);
  if (!json || json === '{}' || json === '[]' || json === 'null') return '';
  return json
    .split('\n')
    .map((l) => paint(c.gray, '  ' + l))
    .join('\n');
}

const SEP = paint(c.gray, '─'.repeat(72));

// ─── Field type ───────────────────────────────────────────────────────────────
interface LogFields {
  level: 'info' | 'warn' | 'error';
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string | null;
  userAgent: string | null;
  userId: string | null;
  userType: string | null;
  query: unknown;
  params: unknown;
  body: unknown;
  response: unknown;
  responseSize: string | null;
}

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  // ─── Sensitive keys ─────────────────────────────────────────────────────────
  private readonly sensitiveKeys = new Set([
    'password',
    'new_password',
    'old_password',
    'token',
    'authorization',
    'access_token',
    'refresh_token',
    'otp',
    'secret',
    'cvv',
    'card_number',
    'ssn',
    'pin',
  ]);

  // ─── Skip config ────────────────────────────────────────────────────────────
  private readonly skipPrefixes = ['/api/docs', '/public', '/storage'];
  private readonly skipExact = new Set(['/health', '/favicon.ico']);

  private shouldSkip(path: string): boolean {
    if (this.skipExact.has(path)) return true;
    return this.skipPrefixes.some((prefix) => path.startsWith(prefix));
  }

  // ─── Mask sensitive data ────────────────────────────────────────────────────
  private mask(value: unknown, depth = 0): unknown {
    if (depth > 4 || value === null || value === undefined) return value;

    if (Array.isArray(value)) {
      return value.map((item) => this.mask(item, depth + 1));
    }

    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = this.sensitiveKeys.has(k.toLowerCase())
          ? '•••'
          : this.mask(v, depth + 1);
      }
      return out;
    }

    if (typeof value === 'string' && value.length > 800) {
      return `${value.slice(0, 800)}…[+${value.length - 800} chars]`;
    }

    return value;
  }

  // ─── FIX 1: safely normalize response body ───────────────────────────────
  // Previous code passed raw Buffer/string to mask() which calls
  // Object.entries() on a Buffer → garbled key-value output.
  private normalizeResponseBody(body: unknown): unknown {
    if (body === undefined || body === null) return null;

    if (Buffer.isBuffer(body)) {
      return `[Buffer ${body.length} bytes]`;
    }

    if (typeof body === 'string') {
      // Try to parse so mask() can walk the object tree properly
      try {
        return JSON.parse(body);
      } catch {
        // Plain-text / HTML response — just truncate if huge
        return body.length > 800
          ? `${body.slice(0, 800)}…[+${body.length - 800} chars]`
          : body;
      }
    }

    return body;
  }

  // ─── Production: single structured JSON line ─────────────────────────────
  private structuredPayload(fields: LogFields): string {
    return JSON.stringify(fields);
  }

  // ─── Development: pretty coloured block ──────────────────────────────────
  private prettyBlock(fields: LogFields): string {
    const methodBadge =
      (METHOD_STYLES[fields.method] ?? paint(c.bold, c.white)) +
      ` ${fields.method.padEnd(7)}` +
      c.reset;

    const header = [
      levelTag(fields.statusCode),
      methodBadge,
      paint(c.bold, c.white, fields.path),
      '→',
      statusStyle(fields.statusCode) + fields.statusCode + c.reset,
      durationStyle(fields.durationMs),
      paint(c.gray, '│'),
      paint(c.dim, c.gray, fields.timestamp),
      paint(c.dim, c.cyan, `[${fields.requestId.slice(0, 8)}]`),
    ].join(' ');

    const lines: string[] = [SEP, header];

    // meta row
    const meta: string[] = [];
    if (fields.userId) {
      meta.push(
        paint(c.magenta, `👤 ${fields.userId}`) +
          paint(c.gray, ` (${fields.userType ?? 'unknown'})`),
      );
    }
    if (fields.ip) meta.push(paint(c.gray, `🌐 ${fields.ip}`));
    if (fields.responseSize)
      meta.push(paint(c.dim, c.gray, `📦 ${fields.responseSize}`));
    if (fields.userAgent) {
      const ua =
        fields.userAgent.length > 60
          ? fields.userAgent.slice(0, 60) + '…'
          : fields.userAgent;
      meta.push(paint(c.dim, c.gray, `🔧 ${ua}`));
    }
    if (meta.length) {
      lines.push('  ' + meta.join(paint(c.dim, c.gray, '  ·  ')));
    }

    // payload sections
    const sections: [string, unknown][] = [
      ['Params', fields.params],
      ['Query', fields.query],
      ['Body', fields.body],
      ['Response', fields.response],
    ];

    for (const [label, data] of sections) {
      if (data === null || data === undefined) continue;
      if (
        typeof data === 'object' &&
        !Array.isArray(data) &&
        Object.keys(data as object).length === 0
      )
        continue;
      const rendered = inlinePayload(data);
      if (rendered) {
        lines.push(paint(c.dim, c.gray, `  ┌── ${label}`));
        lines.push(rendered);
      }
    }

    return lines.join('\n');
  }

  // ─── Main middleware ──────────────────────────────────────────────────────
  use(req: Request & { user?: any }, res: Response, next: NextFunction): void {
    if (this.shouldSkip(req.path)) {
      return next();
    }

    const startedAt = Date.now();
    let capturedBody: unknown;

    const _json = res.json.bind(res);
    const _send = res.send.bind(res);

    res.json = function (body?: unknown) {
      capturedBody = body;
      return _json(body);
    } as typeof res.json;

    res.send = function (body?: unknown) {
      if (capturedBody === undefined) {
        capturedBody = body;
      }
      return _send(body);
    } as typeof res.send;

    // ─── Request ID ────────────────────────────────────────────────────────
    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      randomUUID();

    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    // ─── Emit log on finish ────────────────────────────────────────────────
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const statusCode = res.statusCode;
      const level: 'info' | 'warn' | 'error' =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

      const userId = req.user?.userId ?? req.user?.id ?? null;
      const userType = req.user?.email ?? null;

      // FIX 3: req.ip is deprecated in Express 5 — use req.socket directly
      const ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        null;

      // FIX 4: content-length header can be string | string[] | number
      const rawSize = res.getHeader('content-length');
      const responseSize = rawSize != null ? `${String(rawSize)} B` : null;

      const fields: LogFields = {
        level,
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode,
        durationMs,
        ip,
        userAgent: req.get('user-agent') ?? null,
        userId,
        userType,
        query: this.mask(req.query),
        params: this.mask(req.params),
        body: this.mask(req.body),
        response: this.mask(this.normalizeResponseBody(capturedBody)),
        responseSize,
      };

      writeLog(
        level,
        process.env.NODE_ENV === 'production'
          ? this.structuredPayload(fields)
          : this.prettyBlock(fields),
      );
    });

    next();
  }
}
