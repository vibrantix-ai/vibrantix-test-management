// Zero-dependency static file server. Needed because the app fetches local JSON files,
// which browsers block under file:// due to CORS. Usage: node server.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2]) || 4500;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);

  // Redirect (not rewrite) so the browser's address bar — and therefore the
  // base URL used to resolve the page's relative <link>/<script> paths —
  // actually lands under /app/. Silently serving app/index.html's bytes at "/"
  // would break every relative asset reference on the page.
  if (reqPath === '/') {
    res.writeHead(302, { Location: '/app/' });
    res.end();
    return;
  }
  if (reqPath === '/app' || reqPath === '/app/') reqPath = '/app/index.html';

  const filePath = path.normalize(path.join(ROOT, reqPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + reqPath);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Vibrantix Test Management System running at http://localhost:${PORT}`);
});
