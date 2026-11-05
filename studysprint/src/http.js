'use strict';
// A small, dependency-free HTTP layer: router, JSON body parsing, static files, security headers.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const config = require('./config');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest', '.txt']);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function securityHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (config.COOKIE_SECURE) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function createRouter() {
  const routes = [];
  const add = (method, pattern, handlers) => {
    const keys = [];
    const src = pattern.replace(/\/:([A-Za-z_]+)/g, (_, k) => {
      keys.push(k);
      return '/([^/]+)';
    });
    routes.push({ method, re: new RegExp('^' + src + '/?$'), keys, handlers });
  };
  const router = { routes };
  for (const m of ['get', 'post', 'patch', 'delete']) {
    router[m] = (p, ...h) => add(m.toUpperCase(), p, h);
  }
  router.match = (method, pathname) => {
    let pathMatched = false;
    for (const r of routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      if (r.method !== method) {
        pathMatched = true;
        continue;
      }
      const params = {};
      r.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1]);
      });
      return { route: r, params };
    }
    return pathMatched ? 'method' : null;
  };
  return router;
}

function readJson(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length'] || 0) > limit) return reject(new HttpError(413, 'Request is too large'));
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'Request is too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!size) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('shape');
        resolve(v);
      } catch {
        reject(new HttpError(400, 'Request body must be a JSON object'));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  if (config.TRUST_PROXY) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (xff.length) return xff[xff.length - 1];
  }
  return req.socket.remoteAddress || 'unknown';
}

function decorate(res) {
  res.json = (obj, status = 200) => {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    res.end(body);
  };
}

const gzCache = new Map();
const PUBLIC_DIR = path.join(config.ROOT, 'public');

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  let file;
  try {
    file = path.join(PUBLIC_DIR, decodeURIComponent(rel));
  } catch {
    return false;
  }
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return false;
  let st;
  try {
    st = fs.statSync(file);
  } catch {
    return false;
  }
  if (!st.isFile()) return false;

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const etag = `W/"${st.size}-${Math.floor(st.mtimeMs)}"`;
  const headers = {
    'Content-Type': type,
    ETag: etag,
    'Cache-Control': ext === '.html' || ext === '.js' || ext === '.css' ? 'no-cache' : 'public, max-age=86400',
    Vary: 'Accept-Encoding',
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }
  let body = null;
  if (COMPRESSIBLE.has(ext) && st.size > 512 && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
    const key = `${file}:${etag}`;
    body = gzCache.get(key);
    if (!body) {
      body = zlib.gzipSync(fs.readFileSync(file));
      gzCache.set(key, body);
    }
    headers['Content-Encoding'] = 'gzip';
  } else {
    body = fs.readFileSync(file);
  }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}

/** Build the request listener for http.createServer. */
function createHandler(router, { beforeApi } = {}) {
  return async function handler(req, res) {
    decorate(res);
    securityHeaders(res);
    try {
      let url;
      try {
        url = new URL(req.url, 'http://localhost');
      } catch {
        throw new HttpError(400, 'Bad request');
      }
      const pathname = url.pathname;
      const isApi = pathname.startsWith('/api/') || pathname === '/healthz';

      if (!isApi) {
        if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res, pathname)) return;
        throw new HttpError(404, 'Page not found');
      }

      // Cross-site request protection for anything that changes data.
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const origin = req.headers.origin;
        if (origin) {
          let host = '';
          try { host = new URL(origin).host; } catch { /* invalid origin */ }
          if (host !== req.headers.host) throw new HttpError(403, 'Cross-site requests are not allowed');
        }
      }

      const found = router.match(req.method === 'HEAD' ? 'GET' : req.method, pathname);
      if (!found) throw new HttpError(404, 'Not found');
      if (found === 'method') throw new HttpError(405, 'Method not allowed');

      req.params = found.params;
      req.query = Object.fromEntries(url.searchParams);
      req.ip = clientIp(req);
      req.body = {};
      if (beforeApi) beforeApi(req);
      if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
        const ct = String(req.headers['content-type'] || '');
        const hasBody = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'];
        if (hasBody) {
          if (!ct.includes('application/json')) throw new HttpError(415, 'Send JSON with Content-Type: application/json');
          req.body = await readJson(req);
        }
      }
      for (const h of found.route.handlers) {
        await h(req, res);
        if (res.writableEnded || res.headersSent) break;
      }
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error('[error]', req.method, req.url, err);
      if (res.headersSent) return res.end();
      res.json({ error: status === 500 ? 'Something went wrong on our side. Please try again.' : err.message }, status);
    }
  };
}

module.exports = { HttpError, createRouter, createHandler, clientIp };
