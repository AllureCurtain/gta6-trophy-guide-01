// Leonida Platinum — tiny local dev server.
//
// Serves the app folder on localhost so the trophy guide can be tried in a
// browser without any build step. Node standard library only, no network
// beyond this machine: every request is answered from files under app/.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The folder to serve is app/ next to this file.
const appDir = resolve(fileURLToPath(new URL('./app', import.meta.url)));

// Port from --port, else 8080.
let port = 8080;
const portFlag = process.argv.indexOf('--port');
if (portFlag !== -1 && process.argv[portFlag + 1]) {
  const parsed = Number.parseInt(process.argv[portFlag + 1], 10);
  if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) port = parsed;
}

const mimeByExt: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const rawPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const wanted = rawPath === '/' ? '/index.html' : rawPath;
  // Join and normalise, then refuse anything that escapes the app folder.
  const filePath = normalize(join(appDir, wanted));
  if (!filePath.startsWith(appDir + sep) && filePath !== appDir) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('forbidden\n');
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  res.writeHead(200, { 'content-type': mimeByExt[extname(filePath)] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Leonida Platinum dev server: http://127.0.0.1:${port}/`);
});
