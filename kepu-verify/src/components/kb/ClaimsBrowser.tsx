import { useMemo, useState } from "react";
import { Layers, Lock, RotateCcw, Save, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ReviewState, Verdict } from "@/src/lib/types";
import { uid } from "@/src/lib/calc";
import { useApp } from "@/src/lib/store";
import { BLOGGER_VIDEOS, DOUYIN_VIDEOS, TOPICS } from "@/src/data/knowledge";
import { ClaimCard } from "@/src/components/kb/ClaimCard";
import { REVIEW_META, VERDICT_META, effectiveStatement } from "@/src/components/kb/meta";
import { useEvidenceTarget } from "@/src/components/kb/useEvidenceTarget";

interface Props {
  /** public：用户侧只列已发布结论；all：管理侧保留审核状态筛选（原有逻辑） */
  scope?: "public" | "all";
  initialTopic?: string;
  initialAuthor?: string;
  onOpenClaim?: (id: string) => void;
  /** 顶部说明，例如「已按本条主题筛选」 */
  note?: string;
}

/**
 * 结论筛选与列表：原知识库页的搜索 / 主题 / 裁决 / 博主 / 审核状态 / 保存视图逻辑整体搬到这里，
 * 抽屉与知识库页共用，避免两处各写一套筛选。
 */
export function ClaimsBrowser({
  scope = "all", initialTopic = "all", initialAuthor = "all", onOpenClaim, note,
}: Props) {
  const { state, addSavedView, removeSavedView } = useApp();
  const { merged, published } = useEvidenceTarget();

  const [q, setQ] = useState("");
  const [topic, setTopic] = useState(initialTopic);
  const [verdict, setVerdict] = useState("all");
  const [author, setAuthor] = useState(initialAuthor);
  const [reviewFilter, setReviewFilter] = useState<ReviewState>("published");
  const [viewName, setViewName] = useState("");
  const [viewPopover, setViewPopover] = useState(false);

  const authors = useMemo(() => {
    const set = new Set<string>();
    merged.forEach((c) => c.layer1.source?.author && set.add(c.layer1.source.author));
    BLOGGER_VIDEOS.forEach((v) => set.add(v.author));
    DOUYIN_VIDEOS.forEach((v) => set.add(v.author));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
  }, [merged]);

  const filteredClaims = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return published.filter((c) => {
      if (topic !== "all" && c.topic !== topic) return false;
      if (verdict !== "all" && c.layer3.verdict !== verdict) return false;
      if (author !== "all" && c.layer1.source?.author !== author) return false;
      if (kw) {
        const hay = [
          effectiveStatement(c), c.layer1.quote ?? "", c.layer1.source?.author ?? "",
          c.topicLabel, c.layer4.advice ?? "", ...c.layer3.evidence.map((e) => e.ref.title),
        ].join(" ").toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [published, q, topic, verdict, author]);

  const hasFilter = q !== "" || topic !== "all" || verdict !== "all" || author !== "all";
  function resetFilters() {
    setQ(""); setTopic("all"); setVerdict("all"); setAuthor("all"); setReviewFilter("published");
  }

  function saveCurrentView() {
    const name = viewName.trim() || `筛选视图 ${state.savedViews.length + 1}`;
    addSavedView({ id: uid(), name, topic, verdict, author });
    setViewName("");
    setViewPopover(false);
    toast.success(`已保存视图「${name}」`);
  }

  return (
    <div className="grid gap-4">
      {note && <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>}

      {scope === "all" && (
        <Alert className="border-ok/40 bg-ok/10">
          <Lock className="text-ok" />
          <AlertTitle>发布门禁</AlertTitle>
          <AlertDescription>
            公开知识库只展示已通过人工审核并发布的结论。当前已发布 {published.length} 条；
            另有 {merged.filter((c) => c.review.state === "ai_extracted" || c.review.state === "pending_review").length} 条待审核、
            {merged.filter((c) => c.review.state === "human_confirmed").length} 条已确认待发布，均不在公开列表展示，需在「人工审核台」处理。
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-4">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索结论、原话、博主或证据标题…"
                className="pl-9"
                aria-label="关键词搜索"
              />
            </div>
            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="size-4" />
                清除筛选
              </Button>
            )}
          </div>

          <div className={scope === "all" ? "grid grid-cols-2 gap-2 md:grid-cols-4" : "grid grid-cols-2 gap-2 md:grid-cols-3"}>
            <div className="[&>div]:w-full">
              <NativeSelect value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full" aria-label="按主题筛选">
                <NativeSelectOption value="all">全部主题</NativeSelectOption>
                {TOPICS.map((t) => (
                  <NativeSelectOption key={t.id} value={t.id}>{t.label}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="[&>div]:w-full">
              <NativeSelect value={verdict} onChange={(e) => setVerdict(e.target.value)} className="w-full" aria-label="按裁决筛选">
                <NativeSelectOption value="all">全部裁决</NativeSelectOption>
                {(Object.keys(VERDICT_META) as Verdict[]).map((v) => (
                  <NativeSelectOption key={v} value={v}>{VERDICT_META[v].label}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="[&>div]:w-full">
              <NativeSelect value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full" aria-label="按博主筛选">
                <NativeSelectOption value="all">全部博主</NativeSelectOption>
                {authors.map((a) => (
                  <NativeSelectOption key={a} value={a}>{a}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {scope === "all" && (
              <div className="[&>div]:w-full">
                <NativeSelect value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value as ReviewState)} className="w-full" aria-label="按审核状态筛选">
                  <NativeSelectOption value="published">已发布（公开可见）</NativeSelectOption>
                  <NativeSelectOption value="ai_extracted">AI 已提取（未发布）</NativeSelectOption>
                  <NativeSelectOption value="pending_review">待人工审核（未发布）</NativeSelectOption>
                  <NativeSelectOption value="human_confirmed">人工已确认（未发布）</NativeSelectOption>
                </NativeSelect>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {state.savedViews.map((v) => (
              <span key={v.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs">
                <button
                  type="button"
                  className="hover:text-primary"
                  onClick={() => { setTopic(v.topic); setVerdict(v.verdict); setAuthor(v.author); setQ(""); setReviewFilter("published"); }}
                >
                  {v.name}
                </button>
                <button
                  type="button"
                  aria-label={`删除视图 ${v.name}`}
                  className="text-muted-foreground hover:text-bad"
                  onClick={() => { removeSavedView(v.id); toast.success(`已删除视图「${v.name}」`); }}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <Popover open={viewPopover} onOpenChange={setViewPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="xs">
                  <Save className="size-3" />
                  保存当前筛选
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="grid gap-2">
                  <p className="text-xs text-muted-foreground">保存主题 / 裁决 / 博主筛选组合，便于下次直接调用。</p>
                  <Input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="视图名称（可留空）" aria-label="视图名称" />
                  <Button size="sm" onClick={saveCurrentView}>保存视图</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Card>

      {scope === "all" && reviewFilter !== "published" ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Lock /></EmptyMedia>
            <EmptyTitle>「{REVIEW_META[reviewFilter].label}」的内容尚未发布</EmptyTitle>
            <EmptyDescription>
              发布门禁：公开知识库只展示 published 状态的结论。该状态下当前有{" "}
              {merged.filter((c) => c.review.state === reviewFilter).length} 条，
              请前往「人工审核台」查看并推进审核流程。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => setReviewFilter("published")}>
              返回已发布结论
            </Button>
          </EmptyContent>
        </Empty>
      ) : published.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Layers /></EmptyMedia>
            <EmptyTitle>还没有已发布的结论</EmptyTitle>
            <EmptyDescription>
              结论需经「AI 提取 → 人工复核 → 人工确认 → 发布」完整流程后才会出现在这里。
              可先在「人工审核台」推进审核，或点击「添加来源」登记新的视频与文献。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : filteredClaims.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyTitle>没有匹配的结论</EmptyTitle>
            <EmptyDescription>换个关键词，或清除筛选条件试试。</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <RotateCcw className="size-4" />
              清除筛选
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            共 {filteredClaims.length} 条已发布结论{hasFilter ? "（筛选后）" : ""} · 按主题归档
          </p>
          <div className="grid gap-4">
            {filteredClaims.map((c, i) => (
              <div key={c.id} data-claim-id={c.id} className="rise grid gap-2" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
                <ClaimCard claim={c} topics={TOPICS} />
                {onOpenClaim && (
                  <Button variant="outline" size="sm" className="w-fit" onClick={() => onOpenClaim(c.id)}>
                    在抽屉里查看这条的出处
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
