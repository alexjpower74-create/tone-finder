#!/usr/bin/env node
// Zero-dependency static server for the Tone Finder app. Serves only files inside app/.
// Usage: node app/serve.mjs [--port 8301]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// Never serve test and tooling folders, even though they live under app/.
const HIDDEN = ['tests', 'tools', 'test-results', 'playwright-report', 'node_modules'];

function portFromArgs(argv) {
  const i = argv.indexOf('--port');
  const raw = i >= 0 ? argv[i + 1] : argv.find((a) => a.startsWith('--port='))?.slice(7);
  const port = Number(raw ?? 8301);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`bad --port: ${raw}`);
  return port;
}

// Map a URL path to a file under ROOT, or null when it would leave ROOT or hit a hidden folder.
export function resolvePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  if (decoded.endsWith('/')) decoded += 'index.html';
  const full = normalize(join(ROOT, decoded));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  const rel = full.slice(ROOT.length + 1).split(sep);
  if (rel.some((part) => part.startsWith('.') || HIDDEN.includes(part))) return null;
  if (rel[0] === 'serve.mjs' || rel[0] === 'playwright.config.mjs') return null;
  return full;
}

async function send404(res) {
  let body;
  try {
    body = await readFile(join(ROOT, '404.html'));
  } catch {
    body = 'Not found';
  }
  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

export function createAppServer() {
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      return res.end();
    }
    const file = resolvePath(new URL(req.url, 'http://x').pathname);
    if (!file) return send404(res);
    try {
      const info = await stat(file);
      // No directory listings: a directory without a trailing slash is a 404.
      if (!info.isFile()) return send404(res);
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'content-length': body.length,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      return send404(res);
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const port = portFromArgs(process.argv.slice(2));
  const server = createAppServer();
  server.listen(port, '127.0.0.1', () => console.log(`Tone Finder app on http://127.0.0.1:${port}/`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
