import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck, BookOpen, Bot, ClipboardCheck, Database, History, Layers,
  Lock, Paperclip, Save, ScrollText, Send, ShieldCheck, Tag, Undo2, Unlink, UserRound, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Claim, ReviewState, Verdict } from "@/src/lib/types";
import { applyOverride, useApp } from "@/src/lib/store";
import { CLAIMS, EVIDENCE, TOPICS } from "@/src/data/knowledge";
import { ClaimTypeBadge, ReviewBadge, VerdictBadge } from "@/src/components/kb/badges";
import { LayerOneView, LayerSection } from "@/src/components/kb/ClaimCard";
import { EvidenceFinder, type AttachPayload } from "@/src/components/kb/EvidenceFinder";
import { EvidenceItem } from "@/src/components/kb/EvidenceItem";
import { HistoryTimeline } from "@/src/components/kb/HistoryTimeline";
import { KbToaster } from "@/src/components/kb/KbToaster";
import { providerLabel, refKey } from "@/src/lib/evidence";
import {
  HISTORY_ACTION, NEXT_REVIEW, REVIEW_META, REVIEW_ORDER, VERDICT_META,
  attachedEvidence, effectiveEvidence, effectiveStatement, effectiveVerdictReason, isAttached, topicLabel,
} from "@/src/components/kb/meta";

type QueueFilter = "todo" | "confirmed" | "published" | "all";

interface Draft {
  statement: string;
  verdict: Verdict;
  reason: string;
  advice: string;
}

function initialDraft(c: Claim): Draft {
  return {
    statement: effectiveStatement(c),
    verdict: c.layer3.verdict,
    reason: effectiveVerdictReason(c),
    advice: c.layer4.advice ?? "",
  };
}

const STATE_BAR: Record<ReviewState, string> = {
  ai_extracted: "var(--layer-ai)",
  pending_review: "var(--tone-warn)",
  human_confirmed: "var(--tone-info)",
  published: "var(--tone-ok)",
};

export default function Review() {
  const { state, setClaimOverride } = useApp();
  const merged = useMemo(() => CLAIMS.map((c) => applyOverride(c, state.claimOverrides)), [state.claimOverrides]);

  const [queueFilter, setQueueFilter] = useState<QueueFilter>("todo");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [note, setNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  const selected = merged.find((c) => c.id === selectedId) ?? null;
  const d = draft ?? (selected ? initialDraft(selected) : null);

  useEffect(() => {
    const c = merged.find((x) => x.id === selectedId) ?? null;
    setDraft(c ? initialDraft(c) : null);
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const byState = useMemo(() => {
    const rec: Record<ReviewState, number> = { ai_extracted: 0, pending_review: 0, human_confirmed: 0, published: 0 };
    merged.forEach((c) => { rec[c.review.state] += 1; });
    return rec;
  }, [merged]);

  const verdictData = useMemo(
    () => (Object.keys(VERDICT_META) as Verdict[]).map((v) => ({
      key: v,
      label: VERDICT_META[v].label,
      count: merged.filter((c) => c.layer3.verdict === v).length,
      fill: VERDICT_META[v].chart,
    })),
    [merged],
  );

  const topicsCovered = new Set(merged.map((c) => c.topic)).size;
  const doiCount = EVIDENCE.filter((e) => e.doi).length;
  const pmidCount = EVIDENCE.filter((e) => e.pmid).length;
  const doiPct = EVIDENCE.length > 0 ? Math.round((doiCount / EVIDENCE.length) * 100) : 0;
  const pmidPct = EVIDENCE.length > 0 ? Math.round((pmidCount / EVIDENCE.length) * 100) : 0;

  const queue = useMemo(() => {
    const list = merged.filter((c) => {
      switch (queueFilter) {
        case "todo": return c.review.state === "ai_extracted" || c.review.state === "pending_review";
        case "confirmed": return c.review.state === "human_confirmed";
        case "published": return c.review.state === "published";
        default: return true;
      }
    });
    return [...list].sort(
      (a, b) => REVIEW_ORDER.indexOf(a.review.state) - REVIEW_ORDER.indexOf(b.review.state) || a.topic.localeCompare(b.topic),
    );
  }, [merged, queueFilter]);

  const curStatement = selected ? effectiveStatement(selected) : "";
  const curReason = selected ? effectiveVerdictReason(selected) : "";
  const curAdvice = selected?.layer4.advice ?? "";
  const shownEvidence = selected ? effectiveEvidence(selected) : [];
  const attachedCount = selected ? attachedEvidence(selected).length : 0;

  const changes = selected && d ? {
    statement: d.statement.trim() !== curStatement,
    verdict: d.verdict !== selected.layer3.verdict,
    reason: d.reason.trim() !== curReason,
    advice: d.advice.trim() !== curAdvice,
  } : { statement: false, verdict: false, reason: false, advice: false };
  const changeCount = Object.values(changes).filter(Boolean).length;
  const dirty = changeCount > 0;
  const requiredMissing = !!d && (d.statement.trim() === "" || d.reason.trim() === "");

  const next = selected ? NEXT_REVIEW[selected.review.state] : undefined;
  const publishBlocked = next?.to === "published" && curAdvice.trim() === "" && !(d && d.advice.trim() !== "");
  const advanceDisabled = !next || dirty || requiredMissing || publishBlocked;

  function selectClaim(id: string) {
    setSelectedId(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }
  }

  function saveEdits() {
    if (!selected || !d || !dirty || requiredMissing) return;
    const at = new Date().toISOString();
    const entries: Claim["review"]["history"] = [];
    if (changes.statement) entries.push({ at, actor: "human", action: HISTORY_ACTION.editStatement, from: curStatement, to: d.statement.trim(), note });
    if (changes.reason) entries.push({ at, actor: "human", action: HISTORY_ACTION.editReason, from: curReason, to: d.reason.trim(), note });
    if (changes.verdict) entries.push({ at, actor: "human", action: HISTORY_ACTION.editVerdict, from: selected.layer3.verdict, to: d.verdict, note });
    if (changes.advice) entries.push({ at, actor: "human", action: HISTORY_ACTION.editAdvice, from: curAdvice, to: d.advice.trim(), note });
    if (entries.length === 0) return;
    setClaimOverride(selected.id, {
      verdict: d.verdict,
      advice: d.advice.trim(),
      review: { state: selected.review.state, history: [...selected.review.history, ...entries] },
    });
    setNote("");
    toast.success(`已保存 ${entries.length} 处修改，全部写入留痕`);
  }

  function advance() {
    if (!selected || !next || advanceDisabled) return;
    const at = new Date().toISOString();
    setClaimOverride(selected.id, {
      review: {
        state: next.to,
        history: [...selected.review.history, { at, actor: "human", action: next.action, from: selected.review.state, to: next.to, note }],
      },
    });
    setNote("");
    toast.success(`状态已推进：${REVIEW_META[selected.review.state].label} → ${REVIEW_META[next.to].label}`);
  }

  function reject() {
    if (!selected || selected.review.state === "ai_extracted") return;
    const reason = rejectReason.trim();
    if (!reason) return;
    const at = new Date().toISOString();
    setClaimOverride(selected.id, {
      review: {
        state: "ai_extracted",
        history: [...selected.review.history, { at, actor: "human", action: HISTORY_ACTION.reject, from: selected.review.state, to: "ai_extracted", note: reason }],
      },
    });
    setRejectOpen(false);
    setRejectReason("");
    toast.success("已驳回，退回 AI 重新拆解");
  }

  // 挂载/移除只追加留痕：verdict 与审核状态一律不动，改裁决仍是真人操作。
  function attachEvidence(payload: AttachPayload) {
    if (!selected) return;
    const at = new Date().toISOString();
    const trace = [
      payload.note,
      `元数据来自 ${providerLabel(payload.ref.provider)}，待人工核对`,
      "挂载不改动裁决与审核状态",
    ].filter(Boolean).join(" · ");
    setClaimOverride(selected.id, {
      review: {
        state: selected.review.state,
        history: [...selected.review.history, {
          at,
          actor: "human",
          action: HISTORY_ACTION.attachEvidence,
          from: null,
          to: JSON.stringify({
            ref: payload.ref,
            relation: payload.relation,
            strength: payload.strength,
            note: payload.note,
            attachedAt: at,
            remote: true,
          }),
          note: trace,
        }],
      },
    });
    toast.success("已挂载文献并写入留痕", { description: "裁决未改动：请人工核对原文后自行确认裁决，再推进状态。" });
  }

  function detachEvidence(key: string, title: string) {
    if (!selected) return;
    const at = new Date().toISOString();
    setClaimOverride(selected.id, {
      review: {
        state: selected.review.state,
        history: [...selected.review.history, {
          at, actor: "human", action: HISTORY_ACTION.detachEvidence, from: key, to: key, note: `移除挂载：${title}`,
        }],
      },
    });
    toast.success("已移除挂载，原留痕完整保留");
  }

  const queueTabs: { key: QueueFilter; label: string; count: number }[] = [
    { key: "todo", label: "待审核", count: byState.ai_extracted + byState.pending_review },
    { key: "confirmed", label: "待发布", count: byState.human_confirmed },
    { key: "published", label: "已发布", count: byState.published },
    { key: "all", label: "全部", count: merged.length },
  ];

  return (
    <div className="relative z-10 mx-auto grid max-w-7xl gap-6 p-4 md:p-6">
      <header className="rise grid gap-4">
        <div className="energy-line h-1 w-28 rounded-full" />
        <div className="grid gap-1.5">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Review Console · 单人审核 + 完整留痕</p>
          <h1 className="text-3xl font-bold tracking-tight">人工审核台</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            逐条核对四层内容，修改结论表述、裁决与建议，推进「AI 提取 → 人工复核 → 人工确认 → 发布」状态机。
            每次操作都会追加不可删除的留痕。
          </p>
        </div>

        <Alert className="border-ok/40 bg-ok/10">
          <ShieldCheck className="text-ok" />
          <AlertTitle>发布门禁</AlertTitle>
          <AlertDescription>
            只有 <span className="font-mono">published</span> 状态的卡片会出现在公开知识库。
            当前已发布 <span className="font-semibold text-ok">{byState.published}</span> 条；
            待审核 <span className="font-semibold text-warn">{byState.ai_extracted + byState.pending_review}</span> 条
            （AI 已提取 {byState.ai_extracted} + 待人工审核 {byState.pending_review}）；
            人工已确认待发布 <span className="font-semibold text-info">{byState.human_confirmed}</span> 条。
          </AlertDescription>
        </Alert>
      </header>

      <section className="rise grid gap-4 md:grid-cols-3" style={{ animationDelay: "60ms" }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">裁决分布</CardTitle>
            <CardDescription>全部 {merged.length} 条结论（含未发布）</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={verdictData} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "var(--site-muted)", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis hide />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} label={{ position: "top", fill: "var(--site-muted)", fontSize: 11 }}>
                  {verdictData.map((v) => (
                    <Cell key={v.key} fill={v.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">审核进度</CardTitle>
            <CardDescription>状态机各阶段数量</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {REVIEW_ORDER.map((s) => (
              <div key={s} className="grid gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <ReviewBadge state={s} />
                  </span>
                  <span className="font-semibold tabular-nums">{byState[s]}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${merged.length > 0 ? (byState[s] / merged.length) * 100 : 0}%`, background: STATE_BAR[s] }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">覆盖与出处</CardTitle>
            <CardDescription>证据库真实出处覆盖情况</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { icon: Layers, label: "覆盖主题", value: `${topicsCovered}`, tone: "text-ai" },
              { icon: Database, label: "证据总数", value: `${EVIDENCE.length}`, tone: "text-science" },
              { icon: BookOpen, label: "DOI 覆盖", value: `${doiPct}%`, tone: "text-info" },
              { icon: BadgeCheck, label: "PMID 覆盖", value: `${pmidPct}%`, tone: "text-ok" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-background/40 p-3">
                <s.icon className={`size-4 ${s.tone}`} />
                <p className="mt-1 text-xl font-bold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
            <p className="col-span-2 text-xs text-muted-foreground">
              {doiCount}/{EVIDENCE.length} 篇有 DOI · {pmidCount}/{EVIDENCE.length} 篇有 PMID，均可点击回溯原文。
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="rise grid items-start gap-4 lg:grid-cols-[minmax(300px,360px)_1fr]" style={{ animationDelay: "120ms" }}>
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-4 text-primary" />
              审核队列
            </CardTitle>
            <CardDescription>选择一条结论，在右侧核对四层内容并推进状态。</CardDescription>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
              {queueTabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setQueueFilter(t.key)}
                  className={cn(
                    "rounded-md px-1 py-1.5 text-xs font-medium transition-colors",
                    queueFilter === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span className="ml-1 tabular-nums">{t.count}</span>
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="grid max-h-[65vh] gap-2 overflow-y-auto pr-2">
            {queue.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {queueFilter === "todo" ? "太棒了，当前没有待审核的结论。" : "该分组下暂无结论。"}
              </p>
            ) : (
              queue.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectClaim(c.id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                    selectedId === c.id ? "border-primary bg-accent" : "border-border",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ReviewBadge state={c.review.state} />
                    <VerdictBadge verdict={c.layer3.verdict} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm font-medium">{effectiveStatement(c)}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Tag className="size-3" />
                      {c.topicLabel || topicLabel(c.topic, TOPICS)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <History className="size-3" />
                      {c.review.history.length}
                    </span>
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div ref={editorRef} className="grid scroll-mt-24 gap-4">
          {selected && d ? (
            <>
              <Card>
                <CardHeader className="gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="gap-1">
                      <Tag className="size-3" />
                      {selected.topicLabel || topicLabel(selected.topic, TOPICS)}
                    </Badge>
                    <ReviewBadge state={selected.review.state} />
                    {selected.review.state !== "published" && (
                      <Badge variant="outline" className="gap-1 border-warn/40 bg-warn/10 text-warn">
                        <Lock className="size-3" />
                        未发布 · 仅审核台可见
                      </Badge>
                    )}
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{selected.id}</span>
                  </div>
                  <CardTitle className="text-lg leading-snug">{curStatement}</CardTitle>
                  <CardDescription>{REVIEW_META[selected.review.state].desc}</CardDescription>
                </CardHeader>

                <CardContent className="grid gap-4">
                  <LayerSection n={1} tone="voice" title="博主原话" sub="只读 · 来源材料不可编辑">
                    <LayerOneView layer1={selected.layer1} />
                  </LayerSection>

                  <LayerSection
                    n={2}
                    tone="ai"
                    title="AI 拆解结论"
                    sub="可修改结论表述"
                    action={
                      <Badge variant="outline" className="gap-1 border-ai/40 bg-ai-soft text-ai">
                        {selected.layer2.generatedBy === "ai" ? <Bot className="size-3" /> : <UserRound className="size-3" />}
                        {selected.layer2.generatedBy === "ai" ? "AI 拆解" : "人工撰写"}
                      </Badge>
                    }
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="rv-statement">结论表述（发布后公开可见）</Label>
                      <Textarea
                        id="rv-statement"
                        rows={3}
                        value={d.statement}
                        onChange={(e) => setDraft({ ...d, statement: e.target.value })}
                      />
                      {d.statement.trim() === "" && <p className="text-xs text-bad">结论表述不能为空。</p>}
                      <div className="flex flex-wrap items-center gap-2">
                        <ClaimTypeBadge type={selected.layer2.claimType} />
                        <span className="text-xs text-muted-foreground">宣称类型（只读）</span>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        拆解理由（只读）：{selected.layer2.rationale ?? "未提供（素材不足）"}
                      </p>
                    </div>
                  </LayerSection>

                  <LayerSection
                    n={3}
                    tone="science"
                    title="科学证据"
                    sub="可修改裁决与理由；原始论文只读，可实时检索并挂载新文献（挂载不改裁决）"
                    action={attachedCount > 0 ? (
                      <Badge variant="outline" className="gap-1 border-science/40 bg-science-soft text-science">
                        <Paperclip className="size-3" />
                        人工挂载 {attachedCount} 篇 · 待核对
                      </Badge>
                    ) : undefined}
                  >
                    <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                      <div className="grid gap-2">
                        <Label htmlFor="rv-verdict">裁决</Label>
                        <div className="[&>div]:w-full">
                          <NativeSelect
                            id="rv-verdict"
                            value={d.verdict}
                            onChange={(e) => setDraft({ ...d, verdict: e.target.value as Verdict })}
                            className="w-full"
                          >
                            {(Object.keys(VERDICT_META) as Verdict[]).map((v) => (
                              <NativeSelectOption key={v} value={v}>{VERDICT_META[v].label}</NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </div>
                        <VerdictBadge verdict={d.verdict} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="rv-reason">裁决理由（发布后公开可见）</Label>
                        <Textarea
                          id="rv-reason"
                          rows={2}
                          value={d.reason}
                          onChange={(e) => setDraft({ ...d, reason: e.target.value })}
                        />
                        {d.reason.trim() === "" && <p className="text-xs text-bad">裁决理由不能为空。</p>}
                      </div>
                    </div>

                    {shownEvidence.length > 0 ? (
                      <div className="grid gap-3">
                        {shownEvidence.map((ev, i) => (
                          <div key={ev.ref.doi ?? ev.ref.pmid ?? `${selected.id}-ev-${i}`} className="grid gap-1.5">
                            {isAttached(ev) && (
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="gap-1 border-science/40 bg-science-soft text-science">
                                  <Paperclip className="size-3" />
                                  人工挂载 · 待核对
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  挂载于 {new Date(ev.attachedAt).toLocaleString("zh-CN", { hour12: false })} · 裁决未自动改动
                                </span>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  className="ml-auto"
                                  onClick={() => detachEvidence(refKey(ev.ref), ev.ref.title)}
                                >
                                  <Unlink className="size-3" />
                                  移除挂载
                                </Button>
                              </div>
                            )}
                            <EvidenceItem
                              item={ev.ref}
                              relation={ev.relation}
                              strength={ev.strength}
                              note={ev.note}
                              topics={TOPICS}
                              className="bg-background/40"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                        暂无关联论文（素材不足）。可用下方「找文献」实时检索真实文献后人工挂载。
                      </p>
                    )}

                    {selected.layer3.verdict === "insufficient" && (
                      <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs leading-relaxed text-warn">
                        本条裁决为「素材不足」：建议先检索真实文献补齐证据，再人工核对全文并自行确认裁决。
                        系统不会因为你挂载了文献就自动改判。
                      </p>
                    )}

                    <EvidenceFinder
                      key={selected.id}
                      claim={selected}
                      onAttach={attachEvidence}
                      onDetach={detachEvidence}
                      defaultOpen={selected.layer3.verdict === "insufficient"}
                    />

                    {selected.layer3.guideline.length > 0 && (
                      <div className="grid gap-2 rounded-lg border border-science/30 bg-background/40 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-science">
                          <ScrollText className="size-3.5" />
                          指南条款（只读）
                        </p>
                        {selected.layer3.guideline.map((g, i) => (
                          <div key={`${selected.id}-g-${i}`} className="grid gap-1 border-t border-border pt-2 first:border-t-0 first:pt-0">
                            <p className="text-sm font-medium">{g.title}</p>
                            <p className="text-xs text-muted-foreground">{g.issuer} · {g.publishedAt}</p>
                            <p className="text-sm leading-relaxed">{g.clause}</p>
                            {g.url ? (
                              <a href={g.url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs text-info hover:underline">
                                <ExternalLink className="size-3" />
                                指南原文
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">官方原文链接待人工补充</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </LayerSection>

                  <LayerSection n={4} tone="advice" title="产品最终建议" sub="发布前必填">
                    <div className="grid gap-2">
                      <Label htmlFor="rv-advice">最终建议（发布后公开可见）</Label>
                      <Textarea
                        id="rv-advice"
                        rows={3}
                        value={d.advice}
                        placeholder="给出面向新手的可执行建议，说人话，术语顺带解释…"
                        onChange={(e) => setDraft({ ...d, advice: e.target.value })}
                      />
                      {publishBlocked && <p className="text-xs text-warn">发布门禁：必须先填写产品最终建议才能发布。</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">适用（只读）：</span>
                      {selected.layer4.appliesTo.length > 0 ? (
                        selected.layer4.appliesTo.map((t) => (
                          <Badge key={t} variant="outline" className="border-advice/40 bg-advice-soft text-advice">{t}</Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">未限定</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">不适用（只读）：</span>
                      {selected.layer4.notFor.length > 0 ? (
                        selected.layer4.notFor.map((t) => (
                          <Badge key={t} variant="outline" className="border-bad/40 bg-bad/10 text-bad">{t}</Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">未限定</span>
                      )}
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="size-3.5 text-advice" />
                      {selected.layer4.reviewedBy ? `审核人：${selected.layer4.reviewedBy}` : "待人工审核"}
                    </p>
                  </LayerSection>

                  <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4">
                    <div className="grid gap-2">
                      <Label htmlFor="rv-note">操作备注（可选，写入留痕）</Label>
                      <Input
                        id="rv-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="例如：核对了原文第 3 分钟处的说法…"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={saveEdits} disabled={!dirty || requiredMissing}>
                        <Save className="size-4" />
                        保存修改{dirty ? `（${changeCount} 处）` : ""}
                      </Button>
                      <Button onClick={advance} disabled={advanceDisabled}>
                        {next ? <Send className="size-4" /> : <BadgeCheck className="size-4" />}
                        {next ? next.action : "已发布"}
                      </Button>
                      {selected.review.state !== "ai_extracted" && (
                        <Button variant="destructive" onClick={() => setRejectOpen(true)}>
                          <Undo2 className="size-4" />
                          驳回
                        </Button>
                      )}
                    </div>
                    {dirty && <p className="text-xs text-warn">有未保存的修改，请先「保存修改」再推进状态。</p>}
                    {!dirty && next?.to === "published" && publishBlocked && (
                      <p className="text-xs text-warn">发布门禁：填写并保存最终建议后，才能发布到公开知识库。</p>
                    )}
                    {!next && <p className="text-xs text-ok">该结论已发布，公开知识库可见。</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="size-4 text-primary" />
                    审核留痕（{selected.review.history.length}）
                  </CardTitle>
                  <CardDescription>每次修改与状态推进都会追加记录，完整保留，不可删除。</CardDescription>
                </CardHeader>
                <CardContent>
                  <HistoryTimeline history={selected.review.history} />
                </CardContent>
              </Card>
            </>
          ) : (
            <Empty className="border border-border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ClipboardCheck /></EmptyMedia>
                <EmptyTitle>从左侧队列选择一条结论开始审核</EmptyTitle>
                <EmptyDescription>
                  审核流程：AI 已提取 → 待人工审核 → 人工已确认 → 已发布。
                  只有最后一步完成后，结论才会出现在公开知识库。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </section>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>驳回结论</DialogTitle>
            <DialogDescription>
              驳回后状态退回「AI 已提取」，需重新拆解与审核。驳回原因必填，将永久写入留痕。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rv-reject">驳回原因</Label>
            <Textarea
              id="rv-reject"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="例如：引用与原视频不符 / 证据强度不足以支持裁决…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>取消</Button>
            <Button variant="destructive" disabled={rejectReason.trim() === ""} onClick={reject}>
              <Undo2 className="size-4" />
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <KbToaster />
    </div>
  );
}