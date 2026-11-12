// Local stand-in for `deno run dev/function-local.ts` on machines without Deno.
// Transpiles functions/*.ts the same way test-function.mjs does, then serves the
// real handler on 127.0.0.1:8000 so the Vite proxy reaches it.
import ts from "typescript";
import { createServer } from "node:http";
import { writeFileSync, mkdtempSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "fn-dev-"));
for (const f of readdirSync("functions")) {
  if (!f.endsWith(".ts")) continue;
  const src = ts.transpileModule(await readFile(join("functions", f), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/(from\s+")(\.\/[^"]+)\.ts(")/g, "$1$2.mjs$3");
  writeFileSync(join(dir, f.replace(/\.ts$/, ".mjs")), src);
}

const env = { ...process.env };
globalThis.Deno = { env: { get: (k) => env[k] } };
const { handler } = await import(pathToFileURL(join(dir, "handler.mjs")).href);

const PORT = 8000;
createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const url = `http://127.0.0.1:${PORT}${req.url}`;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
    });
    const out = await handler(request);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: String(e) }));
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`function dev server on http://127.0.0.1:${PORT}/functions/v1/app`);
  console.log(`DASHSCOPE_API_KEY: ${env.DASHSCOPE_API_KEY ? "set" : "not set (AI will return 503)"}`);
});