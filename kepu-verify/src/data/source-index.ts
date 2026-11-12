/**
 * 全站统一的视频来源索引。
 *
 * 只合并 src/data 下已验收的三份数据（real-sources / bilibili-extra / douyin-sources）。
 * tools/scratch 下 6000+ 条仅含标题的目录不进入前端包：那是定向采集用的离线参考，
 * 把它塞进 bundle 会让首屏体积翻倍，却不增加任何已核验内容。
 */
import { EXERCISES } from "./exercises";
import realRaw from "./real-sources.json";
import extraRaw from "./bilibili-extra.json";
import douyinRaw from "./douyin-sources.json";
import gapRaw from "./bilibili-gap-fill.json";
import { equipmentDiff, matchExercise, sameWork, toSec, type MatchLevel } from "@/src/lib/source-match";

export type SourceKind = "bilibili" | "douyin";
export type SubtitleStatus = "available" | "missing_requires_login" | "none" | "unknown";

export interface SourceEntry {
  id: string;
  kind: SourceKind;
  title: string;
  author: string;
  url: string;
  durationSec: number | null;
  publishedAt: string | null;
  hasDescription: boolean;
  /** 有分P或章节标题。注意：抖音章节是平台 AI 摘要，不等于博主原话。 */
  hasChapters: boolean;
  chapterTexts: string[];
  platformAiChapters: boolean;
  subtitleStatus: SubtitleStatus;
  /** 同一作者同一内容的其它平台链接。 */
  alternateUrls: string[];
  /** exerciseId → 匹配等级。只记录 exact / near，none 不写入。 */
  matches: Record<string, MatchLevel>;
  /** exerciseId → 近似匹配时差异的器械说明，例如「哑铃」。 */
  diffs: Record<string, string>;
}

interface RawBili {
  bvid?: string;
  title?: string;
  author?: string;
  pubdate?: number;
  duration?: number | string;
  description?: string;
  desc?: string;
  url?: string;
  pages?: { part?: string }[];
}

interface RawDouyin {
  aweme_id?: string;
  title?: string;
  author?: string;
  published_text?: string | null;
  duration_sec?: number | null;
  duration_text?: string | null;
  desc?: string | null;
  url?: string;
  chapters?: { title?: string; summary?: string }[];
}

function richBilibili(v: RawBili): SourceEntry | null {
  if (!v.bvid) return null;
  const chapterTexts = (v.pages ?? []).map((p) => p.part ?? "").filter(Boolean);
  return {
    id: v.bvid,
    kind: "bilibili",
    title: v.title ?? "",
    author: v.author ?? "",
    url: v.url ?? `https://www.bilibili.com/video/${v.bvid}`,
    durationSec: toSec(v.duration),
    publishedAt: v.pubdate ? new Date(v.pubdate * 1000).toISOString() : null,
    hasDescription: Boolean(v.description ?? v.desc),
    hasChapters: chapterTexts.length > 0,
    chapterTexts,
    platformAiChapters: false,
    subtitleStatus: "unknown",
    alternateUrls: [],
    matches: {},
    diffs: {},
  };
}

function richDouyin(v: RawDouyin): SourceEntry | null {
  if (!v.aweme_id) return null;
  const chapterTexts = (v.chapters ?? []).map((c) => c.title ?? "").filter(Boolean);
  return {
    id: v.aweme_id,
    kind: "douyin",
    title: v.title ?? "",
    author: v.author ?? "",
    url: v.url ?? `https://www.douyin.com/video/${v.aweme_id}`,
    durationSec: v.duration_sec ?? toSec(v.duration_text),
    publishedAt: v.published_text ?? null,
    hasDescription: Boolean(v.desc),
    hasChapters: chapterTexts.length > 0,
    chapterTexts,
    // 抖音章节由平台生成，绝不能当成博主原话。
    platformAiChapters: chapterTexts.length > 0,
    subtitleStatus: "missing_requires_login",
    alternateUrls: [],
    matches: {},
    diffs: {},
  };
}

interface GapRecord {
  exerciseId: string;
  exerciseName: string;
  matchLevel: MatchLevel;
  bvid: string | null;
  title: string | null;
  author: string | null;
  duration: number | null;
  pages: { page?: number; part?: string }[];
  url: string | null;
  difference: string | null;
}

function gapCandidates(): GapRecord[] {
  return ((gapRaw as { candidates?: GapRecord[] }).candidates ?? []).filter((c) => !!c.exerciseId);
}

/** 定向补采的逐动作结论。none 表示确实没找到可靠来源，界面据此显示「暂未收录」。 */
export const GAP_FILL: Record<string, GapRecord> = Object.fromEntries(
  gapCandidates().map((c) => [c.exerciseId, c]),
);

function build(): SourceEntry[] {
  const byId = new Map<string, SourceEntry>();

  const add = (e: SourceEntry | null) => {
    if (!e) return;
    const prev = byId.get(`${e.kind}:${e.id}`);
    // 同一 id 出现两次时保留信息更全的一条，不覆盖已有章节。
    if (!prev || (!prev.hasChapters && e.hasChapters)) byId.set(`${e.kind}:${e.id}`, e);
  };

  for (const v of (realRaw as { videos?: RawBili[] }).videos ?? []) add(richBilibili(v));
  for (const v of (extraRaw as { videos?: RawBili[] }).videos ?? []) add(richBilibili(v));
  for (const v of (douyinRaw as { videos?: RawDouyin[] }).videos ?? []) add(richDouyin(v));
  // 定向补采：只有拿到真实 bvid 的记录（exact/near）才并入，none 不产生条目。
  for (const c of gapCandidates()) {
    if (c.matchLevel === "none" || !c.bvid) continue;
    if (byId.has(`bilibili:${c.bvid}`)) continue;
    add(richBilibili({
      bvid: c.bvid,
      title: c.title ?? undefined,
      author: c.author ?? undefined,
      duration: c.duration ?? undefined,
      url: c.url ?? undefined,
      pages: c.pages,
    }));
  }

  const entries = [...byId.values()];

  // 跨平台去重：同作者 + 时长 ±3 秒 → 视为同一作品，保留内容更全的一条，另一个记进 alternateUrls。
  const removed = new Set<SourceEntry>();
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (removed.has(a)) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (removed.has(b)) continue;
      if (!sameWork(
        { id: a.id, kind: a.kind, author: a.author, durationSec: a.durationSec, url: a.url, richness: 0 },
        { id: b.id, kind: b.kind, author: b.author, durationSec: b.durationSec, url: b.url, richness: 0 },
      )) continue;
      const [keep, drop] = a.hasChapters === b.hasChapters ? [a, b] : a.hasChapters ? [a, b] : [b, a];
      keep.alternateUrls.push(drop.url);
      removed.add(drop);
      if (drop === a) break;
    }
  }

  const alive = entries.filter((e) => !removed.has(e));

  for (const e of alive) {
    const text = [e.title, ...e.chapterTexts].join(" ");
    for (const ex of EXERCISES) {
      const level = matchExercise(text, ex.name);
      if (level === "none") continue;
      e.matches[ex.id] = level;
      if (level === "near") {
        const d = equipmentDiff(text, ex.name);
        if (d) e.diffs[ex.id] = d;
      }
    }
  }

  // 定向补采逐条核验过标题与可核验页面，其判定优先于上面的关键词匹配。
  for (const c of gapCandidates()) {
    if (c.matchLevel === "none" || !c.bvid) continue;
    const e = alive.find((x) => x.id === c.bvid);
    if (!e) continue;
    e.matches[c.exerciseId] = c.matchLevel;
    if (c.matchLevel === "near" && c.difference) e.diffs[c.exerciseId] = c.difference;
  }

  return alive;
}

export const SOURCE_INDEX: SourceEntry[] = build();

const BY_ID = new Map(SOURCE_INDEX.map((e) => [e.id, e]));

export function getSource(id: string): SourceEntry | undefined {
  return BY_ID.get(id);
}

/** exact 排在 near 前面；同级按是否有章节、标题长度稳定排序。 */
export function sourcesForExercise(exerciseId: string): SourceEntry[] {
  return SOURCE_INDEX
    .filter((e) => e.matches[exerciseId])
    .sort((a, b) => {
      const lv = (e: SourceEntry) => (e.matches[exerciseId] === "exact" ? 0 : 1);
      if (lv(a) !== lv(b)) return lv(a) - lv(b);
      if (a.hasChapters !== b.hasChapters) return a.hasChapters ? -1 : 1;
      return a.title.length - b.title.length;
    });
}

export function sourceStats() {
  const exact = new Set<string>();
  const near = new Set<string>();
  for (const e of SOURCE_INDEX) {
    for (const [exId, lv] of Object.entries(e.matches)) {
      if (lv === "exact") exact.add(exId);
      else near.add(exId);
    }
  }
  return {
    total: SOURCE_INDEX.length,
    bilibili: SOURCE_INDEX.filter((e) => e.kind === "bilibili").length,
    douyin: SOURCE_INDEX.filter((e) => e.kind === "douyin").length,
    withChapters: SOURCE_INDEX.filter((e) => e.hasChapters).length,
    deduped: SOURCE_INDEX.reduce((s, e) => s + e.alternateUrls.length, 0),
    exercisesExact: exact.size,
    exercisesNearOnly: [...near].filter((id) => !exact.has(id)).length,
    exercisesNone: EXERCISES.length - new Set([...exact, ...near]).size,
  };
}
