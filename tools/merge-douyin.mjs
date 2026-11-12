import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = join(root, "tools/scratch");
const rawPath = join(scratch, "douyin-raw.json");
const raw = JSON.parse(readFileSync(rawPath, "utf8"));

const incoming = [...raw.details];
for (const f of readdirSync(scratch)) {
  if (!/^douyin-batch-.*\.json$/.test(f)) continue;
  const arr = JSON.parse(readFileSync(join(scratch, f), "utf8"));
  if (!Array.isArray(arr)) continue;
  incoming.push(...arr);
  console.log(`  + ${f}: ${arr.length}`);
}

const byId = new Map();
for (const r of incoming) {
  if (!r?.id) continue;
  const prev = byId.get(r.id);
  if (!prev || (r.chapters?.length ?? 0) > (prev.chapters?.length ?? 0)) byId.set(r.id, r);
}

const sig = (r) => `${r.title ?? ""}|${r.published_text ?? ""}|${r.duration_text ?? ""}`;
const byContent = new Map();
const dropped = [];
for (const r of byId.values()) {
  const k = sig(r);
  if (byContent.has(k)) {
    const keep = byContent.get(k);
    keep.duplicate_ids = [...(keep.duplicate_ids ?? []), r.id];
    dropped.push({ id: r.id, kept: keep.id, title: (r.title ?? "").slice(0, 30) });
  } else {
    byContent.set(k, r);
  }
}

const details = [...byContent.values()].sort((a, b) =>
  String(a.published_text ?? "").localeCompare(String(b.published_text ?? ""))
);

const collections = {};
for (const d of details) {
  const c = d.collection ?? "单条视频";
  collections[c] = (collections[c] ?? 0) + 1;
}

raw.details = details;
raw.collections = collections;
raw.dedupe_note = "同一内容被博主重复投稿时会产生不同 aweme_id；按 标题+发布时间+时长 归并，保留章节更完整的一条，其余 id 记入 duplicate_ids。";
raw.captured_at = new Date().toISOString().slice(0, 10);
writeFileSync(rawPath, JSON.stringify(raw, null, 2) + "\n", "utf8");

console.log("\n合并结果");
console.log("  唯一视频:", details.length);
console.log("  归并掉的重复投稿:", dropped.length);
console.log("  章节总数:", details.reduce((s, d) => s + (d.chapters?.length ?? 0), 0));
console.log("  带正文摘要的章节:", details.reduce((s, d) => s + (d.chapters ?? []).filter((c) => c.summary).length, 0));
console.log("  按合集:", JSON.stringify(collections, null, 2));