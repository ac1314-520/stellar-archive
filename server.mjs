#!/usr/bin/env node
/**
 * STELLAR ARCHIVE — zero-dependency local preview server.
 * Usage: node server.mjs [port]
 */
import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const START_PORT = Number(process.argv[2] || process.env.PORT || 4173);
const HOST = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const withoutLeading = decoded.replace(/^\/+/, "");
  const target = normalize(join(ROOT, withoutLeading || "index.html"));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;
  return target;
}

function createServer() {
  return http.createServer((req, res) => {
    if (!["GET", "HEAD"].includes(req.method || "")) {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end("Method not allowed");
      return;
    }

    let target = safePath(req.url);
    if (!target) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    try {
      let stat = statSync(target);
      if (stat.isDirectory()) {
        target = join(target, "index.html");
        stat = statSync(target);
      }
      const type = MIME[extname(target).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": stat.size,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
      });
      if (req.method === "HEAD") {
        res.end();
      } else {
        createReadStream(target).pipe(res);
      }
    } catch {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        '<!doctype html><meta charset="utf-8"><title>404</title>' +
          '<body style="background:#0c0608;color:#e8d0b2;font:16px/1.7 serif;display:grid;place-items:center;height:100vh">' +
          '<div><p style="letter-spacing:.3em;color:#b89368">STELLAR ARCHIVE · 404</p>' +
          '<h1 style="font-weight:400">这一页，没有被收藏。</h1>' +
          '<a href="/" style="color:#f1cf9f">回到星屿 →</a></div>'
      );
    }
  });
}

let attempt = 0;
let server;
function listen(port) {
  server = createServer();
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attempt < 10) {
      attempt += 1;
      listen(port + 1);
      return;
    }
    console.error(error);
    process.exit(1);
  });
  server.listen(port, HOST, () => {
    console.log("");
    console.log("  ✦  STELLAR ARCHIVE · 星屿藏馆");
    console.log(`  →  http://${HOST}:${port}`);
    console.log(`  →  http://localhost:${port}`);
    console.log("");
    console.log("  按 Ctrl+C 停止预览。照片与收藏都保存在浏览器本机。");
    console.log("");
  });
}

listen(START_PORT);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server?.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 800).unref();
  });
}
