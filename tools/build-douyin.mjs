import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = JSON.parse(readFileSync(join(root, "tools/scratch/douyin-raw.json"), "utf8"));
const realPath = join(root, "kepu-verify/src/data/real-sources.json");
const real = JSON.parse(readFileSync(realPath, "utf8"));

const toSec = (t) => {
  if (!t) return null;
  const p = t.split(":").map(Number);
  if (p.some(Number.isNaN)) return null;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};

const workById = new Map(raw.works.map((w) => [w.id, w]));

const videos = raw.details.map((d) => {
  const w = workById.get(d.id) ?? {};
  return {
    platform: "douyin",
    aweme_id: d.id,
    title: d.title,
    author: d.author,
    collection: d.collection ?? w.collection ?? null,
    published_text: d.published_text ?? null,
    duration_text: d.duration_text ?? w.duration_text ?? null,
    duration_sec: toSec(d.duration_text ?? w.duration_text),
    likes_text: d.likes_text ?? w.likes_text ?? null,
    url: d.url,
    desc: w.desc ?? null,
    platform_summary: d.platform_summary ?? null,
    chapters: d.chapters.map((c) => ({ ...c, endSec: null })),
  };
});

const out = {
  generated_at: new Date().toISOString(),
  captured_at: raw.captured_at,
  capture_method: raw.method,
  provenance: {
    verbatim_subtitle_status: raw.subtitle_status,
    verbatim_subtitle_reason: "抖音字幕接口需登录，未获取逐字字幕。任何 claim 的 startSec/endSec 若来自 chapters，只能标注为章节定位，不能声称是逐字原话时间轴。",
    blogger_authored_fields: ["title", "desc"],
    platform_ai_fields: ["platform_summary", "chapters[].title", "chapters[].summary"],
    rule: "layer1.quote（博主原话）只能取 title / desc 的逐字连续子串，且 ≤60 字。chapters 与 platform_summary 是抖音平台自动生成的 AI 摘要，必须放在独立字段并标注「平台AI章节摘要」，不得当作博主原话。",
    copyright: "不下载、不存储、不转载任何完整视频。页面仅展示来源信息、短引用与跳转原平台的链接。",
  },
  bloggers: raw.bloggers,
  videos,
  works: raw.works,
  stats: {
    works: raw.works.length,
    videos_with_chapters: videos.length,
    chapters: videos.reduce((s, v) => s + v.chapters.length, 0),
  },
};

writeFileSync(
  join(root, "kepu-verify/src/data/douyin-sources.json"),
  JSON.stringify(out, null, 2) + "\n",
  "utf8",
);

const before = real.videos.length;
real.videos = real.videos.filter((v) => v.bvid && v.bvid.trim().length > 0);
real.douyin = videos.map((v) => ({
  platform: "douyin",
  aweme_id: v.aweme_id,
  title: v.title,
  author: v.author,
  url: v.url,
  published_text: v.published_text,
  duration_text: v.duration_text,
}));
writeFileSync(realPath, JSON.stringify(real, null, 2) + "\n", "utf8");

console.log("douyin-sources.json:", JSON.stringify(out.stats));
console.log("real-sources.videos:", before, "->", real.videos.length);
console.log("real-sources.douyin:", real.douyin.length);