import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const real = JSON.parse(readFileSync(join(root, "src/data/real-sources.json"), "utf8"));
const dy = JSON.parse(readFileSync(join(root, "src/data/douyin-sources.json"), "utf8"));
const extra = JSON.parse(readFileSync(join(root, "src/data/bilibili-extra.json"), "utf8"));
const gap = JSON.parse(readFileSync(join(root, "src/data/bilibili-gap-fill.json"), "utf8"));

const validBvid = new Set([
  ...real.videos.map((v) => v.bvid),
  ...(real.otherVideos ?? []).map((v) => v.bvid),
  ...real.bloggers.flatMap((b) => (b.recent ?? []).map((r) => r.bvid)),
  // 这两份也必须纳入白名单，否则其中的编造 BV 号会被漏检。
  ...(extra.videos ?? []).map((v) => v.bvid),
  ...(gap.candidates ?? []).map((c) => c.bvid),
].filter(Boolean));
const validDoi = new Set(real.evidence.map((e) => e.doi).filter(Boolean));
const validPmid = new Set(real.evidence.map((e) => e.pmid).filter(Boolean));
const validAweme = new Set(dy.videos.map((v) => v.aweme_id));
for (const v of dy.videos) for (const d of v.duplicate_ids ?? []) validAweme.add(d);
for (const w of dy.works) validAweme.add(w.id);

const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !p.includes(join("src", "data") + join("x"))) files.push(p);
  }
})(join(root, "src"));

const issues = [];
let counts = { bvid: 0, doi: 0, pmid: 0, aweme: 0 };
for (const p of files) {
  if (p.endsWith("real-sources.json")) continue;
  const text = readFileSync(p, "utf8");
  const rel = p.slice(root.length + 1);
  const scan = (re, set, kind) => {
    for (const m of text.matchAll(re)) {
      const val = m[1];
      counts[kind]++;
      if (!set.has(val)) issues.push({ file: rel, kind, value: val });
    }
  };
  scan(/\b(BV[0-9A-Za-z]{10})\b/g, validBvid, "bvid");
  scan(/\b(10\.\d{4,9}\/[^\s"'`,;)\]]+)/g, validDoi, "doi");
  scan(/\bpmid["']?\s*[:=]\s*["'](\d{1,8})["']/gi, validPmid, "pmid");
  scan(/\baweme_id["']?\s*[:=]\s*["'](\d{15,25})["']/g, validAweme, "aweme");
}

console.log("扫描文件数:", files.length);
console.log("引用计数:", JSON.stringify(counts));
console.log("素材库规模: B站视频", validBvid.size, "| DOI", validDoi.size, "| PMID", validPmid.size, "| 抖音", validAweme.size);
if (issues.length === 0) {
  console.log("\n结果: 未发现任何编造的 bvid / DOI / PMID / aweme_id");
} else {
  console.log("\n发现", issues.length, "处不在素材库中的引用:");
  for (const i of issues.slice(0, 40)) console.log(`  ${i.file}  ${i.kind}=${i.value}`);
}
process.exit(issues.length ? 1 : 0);