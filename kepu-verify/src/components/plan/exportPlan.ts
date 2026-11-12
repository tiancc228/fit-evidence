import { toast } from "sonner";
import type { Profile } from "@/src/lib/types";
import { GOAL_LABEL, today } from "@/src/lib/calc";
import type { PlanConfig, SplitKind } from "@/src/components/plan/dietEngine";
import { SPLIT_LABEL, type TrainingDay } from "@/src/components/plan/trainingEngine";
import { CLAIM_TOPICS } from "@/src/components/plan/claimMatch";
import type { ClaimOverride } from "@/src/components/form/ClaimLayers";
import { getSourceVideo } from "@/src/components/form/data";
import { REVIEW_META, VERDICT_META, effectiveStatement, effectiveVerdictReason } from "@/src/components/kb/meta";
import { loadText } from "@/src/components/plan/load";
import { download } from "@/src/components/plan/planActions";
import { claimsForRec, type Rec } from "@/src/components/plan/ConclusionCard";

export function exportPlan({ base, config, split, week, vol, recs, overrides }: {
  base: Profile;
  config: PlanConfig;
  split: Exclude<SplitKind, "auto">;
  week: TrainingDay[];
  vol: { trainDays: number; totalSets: number; avgRestSec: number };
  recs: Rec[];
  overrides: Record<string, ClaimOverride>;
}) {
  const lines: string[] = [];
  lines.push(`# 练得明白 · 训练计划`);
  lines.push("");
  lines.push(`生成时间：${new Date().toLocaleString("zh-CN")}`);
  lines.push("");
  lines.push(`> 本计划由产品规则引擎生成，属「产品最终建议」。引用的博主原话 / AI 拆解 / 科学证据在文末分层列出，四层不混为一谈。本工具不能替代专业教练与医生。饮食规划与依据请见饮食页。`);
  lines.push("");
  lines.push(`## 身体档案`);
  lines.push(`- ${base.name || "未命名"} · ${base.sex === "male" ? "男" : "女"} · ${base.age} 岁 · ${base.heightCm} cm · ${base.weightKg} kg${base.bodyFatPct != null ? ` · 体脂 ${base.bodyFatPct}%` : ""}`);
  lines.push(`- 目标：${GOAL_LABEL[config.goal]} · 每周训练 ${config.trainingDays} 天 · 水平：${config.level === "novice" ? "新手" : "进阶"} · 分化：${SPLIT_LABEL[split]}`);
  lines.push("");
  lines.push(`## 周计划（每周 ${vol.trainDays} 练 · 共 ${vol.totalSets} 组）`);
  for (const d of week) {
    lines.push("");
    lines.push(`### ${d.weekday} · ${d.focus}${d.kind === "rest" ? "（休息）" : ""}`);
    if (d.kind === "rest") {
      lines.push(`- ${d.note}`);
      continue;
    }
    lines.push(`| 动作 | 组×次 | 组间 | 起步负重 | 原视频 |`);
    lines.push(`| --- | --- | --- | --- | --- |`);
    for (const pe of d.exercises) {
      const v = getSourceVideo(pe.exercise.videoBvid);
      lines.push(`| ${pe.exercise.name} | ${pe.sets}×${pe.repsLow}–${pe.repsHigh} | ${pe.restSec}s | ${loadText(pe)} | ${v ? `${v.title}（${v.author}）${v.url}` : "素材不足：未收录教学视频"} |`);
    }
    lines.push(`- ${d.note}`);
  }
  lines.push("");
  lines.push(`## 依据与出处（四层分开）`);
  for (const rec of recs) {
    const keys = rec.exact ?? CLAIM_TOPICS[rec.topic].keys;
    const matched = claimsForRec(rec, overrides).filter((c) => keys.includes(c.topic));
    lines.push("");
    lines.push(`### ${rec.title}：${rec.value}`);
    lines.push(`- 产品建议依据：${rec.basis}`);
    if (matched.length === 0) {
      lines.push(`- 素材不足：拆解清单中暂无对应主题的博主结论。`);
      continue;
    }
    for (const c of matched.slice(0, 3)) {
      const src = c.layer1.source;
      lines.push(`- 博主原话：${c.layer1.quote ? `「${c.layer1.quote}」` : `素材不足（${c.layer1.missingReason ?? "未获取到逐字字幕"}）`}${src ? ` — ${src.author}《${src.title}》${src.url}` : ""}`);
      lines.push(`- AI 拆解（${c.layer2.generatedBy === "ai" ? "AI 生成，需人工复核" : "人工撰写"}）：${effectiveStatement(c)}`);
      lines.push(`- 科学裁决：${VERDICT_META[c.layer3.verdict].label} — ${effectiveVerdictReason(c)}`);
      for (const ev of c.layer3.evidence) {
        const ids = [ev.ref.doi ? `DOI ${ev.ref.doi} https://doi.org/${ev.ref.doi}` : null, ev.ref.pmid ? `PMID ${ev.ref.pmid} https://pubmed.ncbi.nlm.nih.gov/${ev.ref.pmid}/` : null].filter(Boolean).join(" · ");
        lines.push(`  - ${ev.ref.title} · ${ev.ref.authors.slice(0, 3).join(", ")}${ev.ref.authors.length > 3 ? " 等" : ""} · ${ev.ref.journal ?? "期刊未获取"} ${ev.ref.year ?? ""}${ids ? ` · ${ids}` : " · 无 DOI/PMID"}`);
      }
      for (const g of c.layer3.guideline) {
        lines.push(`  - 指南：${g.title} · ${g.issuer} · ${g.publishedAt} — ${g.clause}`);
      }
      lines.push(`- 产品最终建议：${c.layer4.advice ?? "素材不足：尚未形成最终建议"}${c.layer4.notFor.length ? `（不适用：${c.layer4.notFor.join("、")}）` : ""}`);
      lines.push(`- 审核状态：${REVIEW_META[c.review.state].label}${c.review.state !== "published" ? "（未发布，仅供参考）" : ""}`);
    }
  }
  lines.push("");
  lines.push(`## 版权与免责`);
  lines.push(`- 视频版权归作者所有，本计划仅保存来源信息并提供跳转，不存储或转载视频内容。`);
  lines.push(`- 所有视频与文献均来自已抓取的真实来源清单，按 bvid / DOI / PMID 精确取用；拿不到的数据标注「素材不足」。`);
  lines.push(`- 出现疼痛请停止训练并就医。`);
  download(`训练计划-${today()}.md`, lines.join("\n"));
  toast.success("已导出 Markdown 训练计划", { description: "含周计划与四层出处，可直接打印或分享。" });
}
