/**
 * Source for the static file server that gets written into the devbox and run
 * with node. Deliberately node, not `python3 -m http.server`: we know node
 * exists in the box because we already run `node demo-app/verify.js` there.
 *
 * Binds 0.0.0.0 so the Runloop tunnel can reach it.
 */
export const PREVIEW_SERVER_PORT = 8000;

export const PREVIEW_SERVER_SOURCE = `
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || 'demo-app');
const PORT = Number(process.env.PORT || ${PREVIEW_SERVER_PORT});

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\\/+/, '');
    const filePath = path.resolve(ROOT, relative);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log('preview server listening on ' + PORT + ' serving ' + ROOT);
  });
`;
