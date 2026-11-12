import type { Claim, Verdict } from "@/src/lib/types";

export type ClaimOverride = { review?: Claim["review"]; verdict?: Verdict; advice?: string };
export type OverrideMap = Record<string, ClaimOverride>;

const VERD_RANK: Record<Verdict, number> = { supported: 0, partial: 1, conflict: 2, insufficient: 3 };

export const VERDICT_LABEL: Record<Verdict, string> = {
  supported: "证据支持",
  partial: "部分支持",
  conflict: "存在冲突",
  insufficient: "证据不足",
};

export const REVIEW_LABEL: Record<Claim["review"]["state"], string> = {
  ai_extracted: "AI 拆解",
  pending_review: "待人工审核",
  human_confirmed: "已人工确认",
  published: "已发布",
};

/** Apply a user/reviewer override without mutating the original claim. */
export function resolveClaim(claim: Claim, overrides: OverrideMap): Claim {
  const o = overrides[claim.id];
  if (!o) return claim;
  return {
    ...claim,
    layer3: { ...claim.layer3, verdict: o.verdict ?? claim.layer3.verdict },
    layer4: { ...claim.layer4, advice: o.advice ?? claim.layer4.advice },
    review: o.review ?? claim.review,
  };
}

export function isConfirmedState(state: Claim["review"]["state"]): boolean {
  return state === "human_confirmed" || state === "published";
}

export function isConfirmed(claim: Claim, overrides: OverrideMap): boolean {
  return isConfirmedState(resolveClaim(claim, overrides).review.state);
}

export interface TopicPreset {
  keys: string[];
  kw: string[];
}

/** Topic presets map each plan recommendation to real CLAIM topic ids + keyword fallbacks. */
export const CLAIM_TOPICS = {
  energy: { keys: ["fatloss-deficit", "muscle-surplus"], kw: ["热量", "缺口", "盈余", "能量", "维持"] },
  deficit: { keys: ["fatloss-deficit"], kw: ["缺口", "减脂", "减重"] },
  surplus: { keys: ["muscle-surplus"], kw: ["盈余", "增肌"] },
  protein: { keys: ["protein-intake", "whey-protein"], kw: ["蛋白"] },
  carb: { keys: ["carb-multiplier", "staple-choice", "carb-cycling"], kw: ["碳水", "主食", "谷物"] },
  fat: { keys: [], kw: [] },
  veg: { keys: ["vegetable-intake"], kw: ["蔬菜", "膳食纤维", "深色", "膳食指南"] },
  antiInflam: { keys: ["anti-inflammatory"], kw: ["抗炎", "炎症", "抗氧化", "omega", "欧米伽", "多酚", "鱼油"] },
  frequency: { keys: ["training-frequency"], kw: ["频率", "分化"] },
  volume: { keys: ["training-volume"], kw: ["容量", "组数"] },
  novice: { keys: ["novice-adaptation", "range-of-motion", "posture-correction", "joint-care", "stretching"], kw: ["新手", "神经适应", "动作", "渐进", "初学"] },
  failure: { keys: ["training-failure"], kw: ["力竭", "余力", "RIR"] },
  rest: { keys: [], kw: [] },
  cardio: { keys: ["concurrent-training"], kw: ["有氧", "并行", "干扰", "心肺"] },
  sleep: { keys: ["sleep-recovery"], kw: ["睡眠"] },
  creatine: { keys: ["creatine"], kw: ["肌酸", "补剂"] },
  sugar: { keys: ["added-sugar"], kw: ["添加糖", "含糖", "饮料"] },
} satisfies Record<string, TopicPreset>;

export type TopicKey = keyof typeof CLAIM_TOPICS;

/**
 * Match claims by topic id, falling back to keyword hits on label/statement.
 * Exact topic-key matches outrank keyword-only matches so a generic word
 * (e.g. 「每周」「体重」) cannot pull an unrelated claim to the top.
 * Order: confirmed first → key match → verdict rank.
 */
export function matchClaims(claims: Claim[], topic: TopicKey, overrides: OverrideMap): Claim[] {
  const preset = CLAIM_TOPICS[topic];
  const tk = preset.keys.map((s) => s.toLowerCase());
  const kw = preset.kw.map((s) => s.toLowerCase());
  const scored = claims
    .map((c) => {
      const t = (c.topic || "").toLowerCase();
      const label = (c.topicLabel || "").toLowerCase();
      const stmt = (c.layer2?.statement || "").toLowerCase();
      let score = 0;
      if (tk.includes(t)) score = 2;
      else if (kw.some((k) => label.includes(k) || stmt.includes(k))) score = 1;
      return { claim: resolveClaim(c, overrides), score };
    })
    .filter((x) => x.score > 0);
  return scored
    .sort((a, b) => {
      const ca = isConfirmedState(a.claim.review.state) ? 0 : 1;
      const cb = isConfirmedState(b.claim.review.state) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      if (b.score !== a.score) return b.score - a.score;
      return VERD_RANK[a.claim.layer3.verdict] - VERD_RANK[b.claim.layer3.verdict];
    })
    .map((x) => x.claim);
}

export function bestClaim(claims: Claim[], topic: TopicKey, overrides: OverrideMap): Claim | null {
  return matchClaims(claims, topic, overrides)[0] ?? null;
}

export function bilibiliUrl(source: { url?: string; bvid?: string } | null): string | null {
  if (!source) return null;
  if (source.url) return source.url;
  if (source.bvid) return `https://www.bilibili.com/video/${source.bvid}`;
  return null;
}

export function doiUrl(doi: string | null): string | null {
  return doi ? `https://doi.org/${doi}` : null;
}

export function pmidUrl(pmid: string | null): string | null {
  return pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null;
}