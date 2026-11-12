import ts from "typescript";
import { writeFileSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "fn-"));
for (const f of readdirSync("functions")) {
  if (!f.endsWith(".ts")) continue;
  const src = ts.transpileModule(
    await (await import("node:fs/promises")).readFile(join("functions", f), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
  ).outputText.replace(/(from\s+")(\.\/[^"]+)\.ts(")/g, "$1$2.mjs$3");
  writeFileSync(join(dir, f.replace(/\.ts$/, ".mjs")), src);
}
const outfile = join(dir, "handler.mjs");

const env = {};
globalThis.Deno = { env: { get: (k) => env[k] } };

const { handler } = await import(pathToFileURL(outfile).href);

let pass = 0, fail = 0;
async function check(name, req, expectStatus, assert) {
  const res = await handler(req);
  const body = await res.json().catch(() => null);
  const okStatus = res.status === expectStatus;
  const okBody = assert ? assert(body) : true;
  if (okStatus && okBody) { pass++; console.log(`  PASS ${name} [${res.status}]`); }
  else { fail++; console.log(`  FAIL ${name} got ${res.status} want ${expectStatus}`, JSON.stringify(body).slice(0, 200)); }
  return body;
}
const get = (p) => new Request(`https://site.test/functions/v1/app${p}`);
const post = (p, obj) => new Request(`https://site.test/functions/v1/app${p}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj),
});

console.log("== 未配置 API Key 时的行为（必须诚实降级，不能假装成功）==");
await check("health", get("/health"), 200, (b) => b.ok === true && b.aiConfigured === false);
await check("ai/status", get("/ai/status"), 200, (b) => b.configured === false);
await check("ai/analyze -> 503", post("/ai/analyze", { kind: "food", image: "data:image/png;base64,AA" }), 503,
  (b) => b.status === "service_not_configured" && b.text === null && b.items.length === 0);

console.log("== 路由与入参校验 ==");
await check("unknown route -> 404", get("/nope"), 404, (b) => b.error === "not_found");
await check("evidence no id -> 400", get("/evidence/lookup"), 400);
await check("sources no url -> 400", post("/sources/video", {}), 400);
await check("sources bad platform -> 400", post("/sources/video", { url: "https://youtube.com/watch?v=x" }), 400);

// 云端网关把 /functions/v1/app 改写成上游物理名 /app-<deploymentId>，
// 按字面匹配 app 会让线上所有接口 404，而本地测试全过。
console.log("== 云端网关改写后的路径（函数名不是 app）==");
const gw = (p) => new Request(`https://site.test/app-d01a1cb4084177271bcb025212c811346${p}`);
const gwPost = (p, obj) => new Request(`https://site.test/app-d01a1cb4084177271bcb025212c811346${p}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj),
});
await check("gateway health", gw("/health"), 200, (b) => b.ok === true);
await check("gateway ai/status", gw("/ai/status"), 200, (b) => b.configured === false);
await check("gateway ai/analyze -> 503", gwPost("/ai/analyze", { kind: "food", image: "data:image/png;base64,AA" }), 503,
  (b) => b.status === "service_not_configured");
await check("gateway evidence no id -> 400", gw("/evidence/lookup"), 400);
await check("gateway root", gw(""), 200, (b) => b.ok === true);
await check("gateway unknown route -> 404", gw("/nope"), 404, (b) => b.error === "not_found");

console.log("== 配置 Key 后（用假 key 验证不会崩溃、错误如实上报）==");
env.DASHSCOPE_API_KEY = "sk-invalid-for-test";
await check("ai/status configured", get("/ai/status"), 200, (b) => b.configured === true);
await check("bad kind -> 400", post("/ai/analyze", { kind: "x", image: "data:image/png;base64,AA" }), 400);
await check("bad image -> 400", post("/ai/analyze", { kind: "food", image: "http://x/y.png" }), 400);
await check("ai/analyze upstream error surfaces", post("/ai/analyze", { kind: "body", image: "data:image/png;base64,AA", context: "" }), 502,
  (b) => b.status === "error" && typeof b.error === "string" && b.text === null);

console.log("== 真实外部 API（只读公开接口，不写任何数据）==");
const doi = await check("Crossref DOI 10.1136/bjsports-2017-097608", get("/evidence/lookup?doi=10.1136/bjsports-2017-097608"), 200,
  (b) => b.ok === true && b.ref.doi === "10.1136/bjsports-2017-097608" && b.ref.title.length > 10 && b.ref.authors.length > 0);
if (doi?.ref) console.log(`       -> ${doi.ref.title.slice(0, 70)} | ${doi.ref.journal} ${doi.ref.year} | cited ${doi.ref.citedBy}`);
const pmid = await check("EuropePMC PMID 28698222", get("/evidence/lookup?pmid=28698222"), 200,
  (b) => b.ok === true && b.ref.pmid === "28698222" && b.ref.title.length > 10);
if (pmid?.ref) console.log(`       -> ${pmid.ref.title.slice(0, 70)} | ${pmid.ref.journal} ${pmid.ref.year}`);
const bv = await check("B站 BV1A4zjB7EcE 元信息", post("/sources/video", { url: "https://www.bilibili.com/video/BV1A4zjB7EcE" }), 200,
  (b) => b.ok === true && b.source.bvid === "BV1A4zjB7EcE" && b.source.title.length > 0 && b.source.author.length > 0);
if (bv?.source) console.log(`       -> ${bv.source.title.slice(0, 50)} | UP ${bv.source.author} | ${bv.source.duration}s | subtitle ${bv.source.subtitleStatus}`);

const search = await check("文献检索相关性 creatine muscle hypertrophy", get("/evidence/search?q=creatine%20muscle%20hypertrophy&limit=5"), 200,
  (b) => b.ok === true && b.refs.length > 0 && b.refs.every((r) => /creatine/i.test(r.title)));
if (search?.refs) for (const r of search.refs.slice(0, 3)) console.log(`       -> ${r.title.slice(0, 72)} | ${r.year} | cited ${r.citedBy}`);

// 连字符词组必须保持相邻：拆成空格时 "concurrent training" 会命中 MHC 抗原预测与淋巴瘤论文。
const compound = await check("文献检索连字符词组 concurrent-training", get("/evidence/search?q=concurrent-training&limit=5"), 200,
  (b) => b.ok === true && b.refs.length > 0 && b.refs.every((r) => /concurrent/i.test(r.title)));
if (compound?.refs) for (const r of compound.refs.slice(0, 2)) console.log(`       -> ${r.title.slice(0, 72)} | ${r.year} | cited ${r.citedBy}`);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);