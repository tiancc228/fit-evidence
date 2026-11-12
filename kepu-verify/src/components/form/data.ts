import type { Claim, Exercise, Verdict } from "@/src/lib/types";
import { EXERCISES as RAW_EXERCISES, EXERCISE_PARTS as RAW_PARTS } from "@/src/data/exercises";
import { CLAIMS as RAW_CLAIMS } from "@/src/data/knowledge";
import rawSources from "@/src/data/real-sources.json";

export const EXERCISES = RAW_EXERCISES as Exercise[];
export const EXERCISE_PARTS = RAW_PARTS as string[];
export const CLAIMS = RAW_CLAIMS as Claim[];

export interface SourceVideo {
  bvid: string;
  title: string;
  author: string;
  url: string;
  duration: string | null;
  pubdate: number | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** 源数据里存在 "15:4" 这类未补零时长，仅在展示层规范化，不改源数据。 */
function normalizeDuration(s: string): string {
  return s.replace(/:(\d)(?=$|:)/g, ":0$1");
}

const videoMap = new Map<string, SourceVideo>();
for (const v of [...rawSources.videos, ...rawSources.otherVideos]) {
  if (v.platform !== "bilibili" || !v.bvid || videoMap.has(v.bvid)) continue;
  videoMap.set(v.bvid, {
    bvid: v.bvid,
    title: decodeEntities(v.title),
    author: v.author,
    url: v.url,
    duration: typeof v.duration === "string" ? normalizeDuration(v.duration) : v.duration != null ? String(v.duration) : null,
    pubdate: typeof v.pubdate === "number" ? v.pubdate : null,
  });
}

/** 只允许跳转到 real-sources.json 中真实存在的视频。 */
export function getSourceVideo(bvid: string | null | undefined): SourceVideo | null {
  if (!bvid) return null;
  return videoMap.get(bvid) ?? null;
}

export function fmtUnixDate(ts: number | null): string | null {
  if (ts == null) return null;
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const LEVEL_META: Record<Exercise["level"], { label: string; className: string }> = {
  novice: { label: "新手友好", className: "border-science/40 bg-science/10 text-foreground" },
  intermediate: { label: "进阶", className: "border-warn/40 bg-warn/10 text-foreground" },
  advanced: { label: "高阶", className: "border-advice/40 bg-advice/10 text-foreground" },
};

export const VERDICT_META: Record<Verdict, { label: string; className: string; iconClass: string }> = {
  supported: { label: "证据支持", className: "border-ok/40 bg-ok/10 text-foreground", iconClass: "text-ok" },
  partial: { label: "部分支持", className: "border-warn/40 bg-warn/10 text-foreground", iconClass: "text-warn" },
  conflict: { label: "证据冲突", className: "border-destructive/40 bg-destructive/10 text-foreground", iconClass: "text-destructive" },
  insufficient: { label: "证据不足", className: "border-border bg-muted text-muted-foreground", iconClass: "text-muted-foreground" },
};

export const CLAIM_TYPE_LABEL: Record<Claim["layer2"]["claimType"], string> = {
  efficacy: "效果",
  dosage: "剂量",
  mechanism: "机制",
  safety: "安全",
  technique: "技术动作",
  diet: "饮食",
};

export const REVIEW_LABEL: Record<Claim["review"]["state"], string> = {
  ai_extracted: "AI 提取",
  pending_review: "待人工复核",
  human_confirmed: "人工已确认",
  published: "已发布",
};

export const RELATION_LABEL = {
  supports: "支持",
  refutes: "反驳",
  partial: "部分支持",
  context: "背景参考",
} as const;

export const STRENGTH_LABEL = { high: "高", medium: "中", low: "低" } as const;

export function claimsForExercise(exerciseId: string): Claim[] {
  return CLAIMS.filter((c) => c.exerciseIds?.includes(exerciseId)).sort((a, b) => {
    const at = a.layer2.claimType === "technique" ? 0 : 1;
    const bt = b.layer2.claimType === "technique" ? 0 : 1;
    return at - bt;
  });
}

const POSTURE_RE = /体态|矫正|纠正|圆肩|驼背|骨盆|肱骨|前倾|康复|弹响/;

export function isPostureExercise(ex: Exercise): boolean {
  return POSTURE_RE.test(`${ex.part} ${ex.pattern} ${ex.name} ${ex.nameEn}`);
}

export function matchExercises(re: RegExp, limit = 4): Exercise[] {
  return EXERCISES.filter((e) => re.test(`${e.name} ${e.nameEn} ${e.part} ${e.pattern}`)).slice(0, limit);
}

export function findExercise(id: string | null | undefined): Exercise | null {
  if (!id) return null;
  return EXERCISES.find((e) => e.id === id) ?? null;
}

export function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime();
  return Math.round(Math.abs(ms) / 86400000);
}