import type { Exercise } from "@/src/lib/types";
import type { SourceEntry } from "@/src/data/source-index";
import { GAP_FILL, getSource, sourcesForExercise } from "@/src/data/source-index";
import { coreName } from "@/src/lib/source-match";

type GapRecord = (typeof GAP_FILL)[string];
export type SourceStatus = "exact" | "near" | "none";

export interface ExerciseSources {
  exact: SourceEntry[];
  near: SourceEntry[];
  all: SourceEntry[];
  gap: GapRecord | null;
  status: SourceStatus;
}

/** B 站标题里保留了 &amp; 一类实体，仅在展示层解码，不改源数据。 */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function canonicalKey(source: SourceEntry): string {
  const url = source.url.trim();
  const bv = url.match(/\/video\/(BV[0-9A-Za-z]+)/i)?.[1];
  if (bv) return `bilibili:${bv.toUpperCase()}`;
  const aweme = url.match(/\/video\/(\d+)/)?.[1];
  if (aweme && source.kind === "douyin") return `douyin:${aweme}`;
  return `${source.kind}:${url.split(/[?#]/)[0].replace(/\/+$/, "")}`;
}

function stableKeys(source: SourceEntry): string[] {
  const keys = [`${source.kind}:${source.id}`];
  const bv = source.kind === "bilibili" ? source.id.match(/BV[0-9A-Za-z]+/i)?.[0] : null;
  if (bv) keys.push(`bilibili:${bv}`);
  keys.push(canonicalKey(source));
  return keys;
}

/** 稳定来源 ID 优先，其次 BV 号，再其次 canonical URL；重复时保留章节更全的一条。 */
function dedupe(sources: SourceEntry[]): SourceEntry[] {
  const out: SourceEntry[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    const keys = stableKeys(source);
    if (keys.some((k) => seen.has(k))) {
      const index = out.findIndex((kept) => stableKeys(kept).some((k) => keys.includes(k)));
      if (index >= 0 && !out[index].hasChapters && source.hasChapters) out[index] = source;
      continue;
    }
    keys.forEach((k) => seen.add(k));
    out.push(source);
  }
  return out;
}

function effectiveLevel(source: SourceEntry, exerciseId: string, gap: GapRecord | null): SourceStatus {
  if (gap && gap.bvid === source.id && gap.matchLevel !== "none") return gap.matchLevel;
  const level = source.matches[exerciseId];
  return level === "exact" || level === "near" ? level : "none";
}

function statusOf(exactCount: number, nearCount: number): SourceStatus {
  if (exactCount > 0) return "exact";
  if (nearCount > 0) return "near";
  return "none";
}

export function sourcesFor(exercise: Exercise): ExerciseSources {
  const gap = (GAP_FILL[exercise.id] ?? null) as GapRecord | null;
  const list = [...sourcesForExercise(exercise.id)];

  // 定向补采的来源在 source-index 中已并入；这里仍按 BV 号补一次并交给去重，
  // 保证同一来源不会因为同时出现在两处而展示两次。
  if (gap && gap.matchLevel !== "none" && gap.bvid && !list.some((s) => s.id === gap.bvid)) {
    const fromIndex = getSource(gap.bvid);
    if (fromIndex) list.push(fromIndex);
  }

  const all = dedupe(list).sort((a, b) => {
    const la = effectiveLevel(a, exercise.id, gap);
    const lb = effectiveLevel(b, exercise.id, gap);
    if (la !== lb) return la === "exact" ? -1 : 1;
    const va = gap?.bvid === a.id && gap.matchLevel !== "none" ? 0 : 1;
    const vb = gap?.bvid === b.id && gap.matchLevel !== "none" ? 0 : 1;
    if (va !== vb) return va - vb;
    // 标题直接包含动作全名的优先；其余按标题长度升序，避免系列花絮排在正片前。
    const fa = a.title.includes(exercise.name) ? 0 : 1;
    const fb = b.title.includes(exercise.name) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    if (a.title.length !== b.title.length) return a.title.length - b.title.length;
    if (a.hasChapters !== b.hasChapters) return a.hasChapters ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  const exact = all.filter((s) => effectiveLevel(s, exercise.id, gap) === "exact");
  const near = all.filter((s) => effectiveLevel(s, exercise.id, gap) === "near");

  return { exact, near, all, gap, status: statusOf(exact.length, near.length) };
}

export function sourceCounts(exercise: Exercise): { exact: number; near: number; status: SourceStatus } {
  const { exact, near } = sourcesFor(exercise);
  return { exact: exact.length, near: near.length, status: statusOf(exact.length, near.length) };
}

export function gapVerified(source: SourceEntry, gap: GapRecord | null): boolean {
  return Boolean(gap && gap.bvid === source.id && gap.matchLevel !== "none");
}

export function nearDifference(source: SourceEntry, exercise: Exercise, gap: GapRecord | null): string | null {
  if (gap && gap.bvid === source.id && gap.matchLevel === "near" && gap.difference) return gap.difference;
  return source.diffs[exercise.id] ?? null;
}

const POSITION_OR_FORM_TOKENS = [
  "上斜", "下斜", "平板", "坐姿", "站姿", "俯身", "单臂", "高位", "低位", "仰卧", "跪姿",
  "直臂", "反向", "双杠", "悬垂", "窄距", "宽距", "反手", "对握", "颈后",
];

/**
 * 来源索引的 exact 只看器械冲突，不区分体位/握法。标题明确点名了目标动作没有的
 * 体位或形式词时，在卡片上单独提示，避免把不同体位描述成完全相同的动作。
 */
export function positionDifference(source: SourceEntry, exercise: Exercise): string | null {
  const text = [source.title, ...source.chapterTexts].join(" ");
  const wanted = POSITION_OR_FORM_TOKENS.filter((token) => exercise.name.includes(token));
  const extra = POSITION_OR_FORM_TOKENS.filter((token) => text.includes(token) && !wanted.includes(token));
  if (extra.length === 0) return null;
  return `来源标题或章节点名了「${extra.join("」「")}」，当前动作名称未标注这些体位或形式词；即使来源索引判为 exact，也不能视为完全相同的动作。`;
}

export function matchReason(source: SourceEntry, exercise: Exercise, gap: GapRecord | null): string {
  const level = effectiveLevel(source, exercise.id, gap);
  if (gap && gap.bvid === source.id && gap.matchLevel !== "none") {
    return level === "exact"
      ? `定向补采已逐条核验标题：与「${exercise.name}」一致。`
      : `定向补采已逐条核验标题：与「${exercise.name}」为近似变式。`;
  }
  const text = [source.title, ...source.chapterTexts].join(" ");
  if (level === "exact") {
    if (text.includes(exercise.name)) return `标题或章节直接包含「${exercise.name}」。`;
    const core = coreName(exercise.name);
    return `标题或章节包含动作核心词「${core || exercise.name}」，且没有点名冲突器械。`;
  }
  return "标题或章节点名了不同器械或体位，只能作为变式参考。";
}

export function evidenceBasis(source: SourceEntry): string {
  if (source.platformAiChapters) return "平台 AI 章节（非博主原话）";
  if (source.hasChapters) return "标题 + 分P / 章节";
  if (source.hasDescription) return "标题 + 简介标记";
  return "仅标题";
}

export function verificationLabel(source: SourceEntry, gap: GapRecord | null): string {
  return gapVerified(source, gap) ? "定向补采已核验标题" : "按标题自动匹配，未逐条人工复核";
}

export const SUBTITLE_LABEL: Record<SourceEntry["subtitleStatus"], string> = {
  available: "字幕已标记可用",
  missing_requires_login: "需登录，未获取字幕",
  none: "无字幕",
  unknown: "字幕状态未核验",
};

export function formatDuration(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return null;
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatPublishedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
