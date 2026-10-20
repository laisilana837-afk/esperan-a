#!/usr/bin/env node
/**
 * Servidor estático mínimo (sem dependências) para rodar o PWA localmente.
 * Uso: node server.js [porta]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, url === '/' ? 'index.html' : url);

  // Impede path traversal
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('403');
    return;
  }

  fs.stat(file, (err, stat) => {
    if (err || stat.isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 — não encontrado');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => {
  console.log(`\n  ▶ Estudantil rodando em http://localhost:${PORT}\n`);
  console.log('  Para instalar o PWA no celular, abra o IP da sua máquina na porta ' + PORT);
  console.log('  (celular e computador precisam estar na mesma rede).\n');
});
