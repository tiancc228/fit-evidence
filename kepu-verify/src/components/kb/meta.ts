import type { Claim, ReviewState, Verdict } from "@/src/lib/types";
import { fmtClock, fmtDate } from "@/src/lib/calc";
import { refKey } from "@/src/lib/evidence";

export const VERDICT_META: Record<Verdict, { label: string; badge: string; chart: string }> = {
  supported: { label: "证据支持", badge: "border-ok/40 bg-ok/10 text-ok", chart: "var(--tone-ok)" },
  partial: { label: "部分支持", badge: "border-warn/40 bg-warn/10 text-warn", chart: "var(--tone-warn)" },
  conflict: { label: "存在冲突", badge: "border-bad/40 bg-bad/10 text-bad", chart: "var(--tone-bad)" },
  insufficient: { label: "证据不足", badge: "border-border bg-muted text-muted-foreground", chart: "var(--site-muted)" },
};

export const REVIEW_META: Record<ReviewState, { label: string; badge: string; desc: string }> = {
  ai_extracted: { label: "AI 已提取", badge: "border-ai/40 bg-ai-soft text-ai", desc: "AI 刚拆解完成，等待进入人工复核" },
  pending_review: { label: "待人工审核", badge: "border-warn/40 bg-warn/10 text-warn", desc: "正在人工核对四层内容与出处" },
  human_confirmed: { label: "人工已确认", badge: "border-info/40 bg-info/10 text-info", desc: "内容已确认，等待发布" },
  published: { label: "已发布", badge: "border-ok/40 bg-ok/10 text-ok", desc: "公开知识库可见" },
};

export const REVIEW_ORDER: ReviewState[] = ["ai_extracted", "pending_review", "human_confirmed", "published"];

export const NEXT_REVIEW: Partial<Record<ReviewState, { to: ReviewState; action: string }>> = {
  ai_extracted: { to: "pending_review", action: "提交人工复核" },
  pending_review: { to: "human_confirmed", action: "人工确认通过" },
  human_confirmed: { to: "published", action: "发布到公开知识库" },
};

export const CLAIM_TYPE_LABEL: Record<Claim["layer2"]["claimType"], string> = {
  efficacy: "效果宣称",
  dosage: "剂量建议",
  mechanism: "机制解释",
  safety: "安全性",
  technique: "动作技术",
  diet: "饮食策略",
};

export const RELATION_META: Record<"supports" | "refutes" | "partial" | "context", { label: string; badge: string }> = {
  supports: { label: "支持", badge: "border-ok/40 bg-ok/10 text-ok" },
  refutes: { label: "反驳", badge: "border-bad/40 bg-bad/10 text-bad" },
  partial: { label: "部分支持", badge: "border-warn/40 bg-warn/10 text-warn" },
  context: { label: "背景", badge: "border-info/40 bg-info/10 text-info" },
};

export const STRENGTH_META: Record<"high" | "medium" | "low", { label: string; badge: string }> = {
  high: { label: "强度：高", badge: "border-ok/40 bg-ok/10 text-ok" },
  medium: { label: "强度：中", badge: "border-warn/40 bg-warn/10 text-warn" },
  low: { label: "强度：低", badge: "border-border bg-muted text-muted-foreground" },
};

const TOPIC_FALLBACK: Record<string, string> = {
  protein: "蛋白质",
  creatine: "肌酸",
  deficit: "热量缺口",
  frequency: "训练频率",
  novice: "新手训练",
  sleep: "睡眠",
  sodium: "钠与盐",
  concurrent: "同期训练",
};

export function topicLabel(id: string, topics: { id: string; label: string }[]): string {
  return topics.find((t) => t.id === id)?.label ?? TOPIC_FALLBACK[id] ?? id;
}

export type LayerTone = "voice" | "ai" | "science" | "advice";

export const LAYER_TONE: Record<LayerTone, { border: string; soft: string; chip: string; head: string }> = {
  voice: { border: "border-voice/30", soft: "bg-voice-soft", chip: "bg-voice/15 text-voice", head: "text-voice" },
  ai: { border: "border-ai/30", soft: "bg-ai-soft", chip: "bg-ai/15 text-ai", head: "text-ai" },
  science: { border: "border-science/30", soft: "bg-science-soft", chip: "bg-science/15 text-science", head: "text-science" },
  advice: { border: "border-advice/30", soft: "bg-advice-soft", chip: "bg-advice/15 text-advice", head: "text-advice" },
};

/**
 * 表述类修订（结论措辞、裁决理由）没有独立的 override 字段，
 * 统一写进 review.history（可持久化且天然留痕），两页都从历史推导最新文本。
 */
export const HISTORY_ACTION = {
  editStatement: "编辑结论表述",
  editReason: "编辑裁决理由",
  editVerdict: "修改裁决",
  editAdvice: "修改最终建议",
  reject: "驳回重拆",
  attachEvidence: "挂载文献证据",
  detachEvidence: "移除挂载文献",
} as const;

export function effectiveStatement(claim: Claim): string {
  for (let i = claim.review.history.length - 1; i >= 0; i--) {
    const h = claim.review.history[i];
    if (h.action === HISTORY_ACTION.editStatement && h.to) return h.to;
  }
  return claim.layer2.statement;
}

export function effectiveVerdictReason(claim: Claim): string {
  for (let i = claim.review.history.length - 1; i >= 0; i--) {
    const h = claim.review.history[i];
    if (h.action === HISTORY_ACTION.editReason && h.to) return h.to;
  }
  return claim.layer3.verdictReason;
}

export type EvidenceEntry = Claim["layer3"]["evidence"][number];
export type AttachedEvidence = EvidenceEntry & { attachedAt: string; remote: true };

/**
 * 审核人从 Crossref / Europe PMC 检索后挂载的文献同样写进 review.history：
 * 可持久化、天然留痕，且绝不触碰 verdict 与审核状态——改裁决仍是真人操作。
 */
export function attachedEvidence(claim: Claim): AttachedEvidence[] {
  const byKey = new Map<string, AttachedEvidence>();
  for (const h of claim.review.history) {
    if (h.action === HISTORY_ACTION.detachEvidence && h.to) {
      byKey.delete(h.to);
      continue;
    }
    if (h.action !== HISTORY_ACTION.attachEvidence || !h.to) continue;
    try {
      const p = JSON.parse(h.to) as Partial<AttachedEvidence>;
      if (!p.ref?.title) continue;
      byKey.set(refKey(p.ref), {
        ref: p.ref,
        relation: p.relation ?? "context",
        strength: p.strength ?? "low",
        note: p.note ?? "",
        attachedAt: p.attachedAt ?? h.at,
        remote: true,
      });
    } catch {
      /* 留痕内容不是合法 JSON 时忽略，不猜测 */
    }
  }
  return Array.from(byKey.values());
}

/** 原始拆解证据 + 人工挂载证据（按 DOI/PMID/标题去重）。 */
export function effectiveEvidence(claim: Claim): EvidenceEntry[] {
  const base = claim.layer3.evidence;
  const seen = new Set(base.map((e) => refKey(e.ref)));
  const extra = attachedEvidence(claim).filter((e) => !seen.has(refKey(e.ref)));
  return [...base, ...extra];
}

export function isAttached(entry: EvidenceEntry): entry is AttachedEvidence {
  return (entry as AttachedEvidence).remote === true;
}

export function stateLabel(s: string | null): string {
  if (s == null) return "—";
  return REVIEW_META[s as ReviewState]?.label ?? s;
}

export function verdictLabel(s: string | null): string {
  if (s == null) return "—";
  return VERDICT_META[s as Verdict]?.label ?? s;
}

export function platformLabel(p: "bilibili" | "douyin"): string {
  return p === "bilibili" ? "哔哩哔哩" : "抖音";
}

export function fmtUnixDate(ts?: number): string {
  if (ts == null) return "发布时间未获取";
  return fmtDate(new Date(ts * 1000));
}

export function fmtDuration(d?: number | string): string {
  if (d == null) return "时长未获取";
  if (typeof d === "number") return fmtClock(d);
  // 抓取到的 B 站时长是 "18:4" 这类未补零字符串，原样显示会被读成错的秒数。
  const parts = d.split(":");
  if (parts.length >= 2 && parts.every((p) => /^\d+$/.test(p))) {
    return parts.map((p, i) => (i === 0 ? p : p.padStart(2, "0"))).join(":");
  }
  return d;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDate(d)} ${hh}:${mm}`;
}

export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}