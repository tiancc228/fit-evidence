import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "scratch");
const PORT = 8799;

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method !== "POST") { res.writeHead(405); res.end("no"); return; }
  const name = (req.url || "/batch").replace(/[^a-zA-Z0-9._-]/g, "") || "batch";
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const buf = Buffer.concat(chunks);
    const file = join(dir, `${name}.json`);
    writeFileSync(file, buf);
    console.log(`WROTE ${file} ${buf.length} bytes`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, bytes: buf.length, file }));
  });
}).listen(PORT, "127.0.0.1", () => console.log(`receiver on http://127.0.0.1:${PORT}`));