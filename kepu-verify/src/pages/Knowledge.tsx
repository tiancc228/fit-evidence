import { useMemo, useState } from "react";
import {
  BookOpen, FileText, Info, Layers, ListChecks, Plus, ShieldCheck, Video,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applyOverride, useApp } from "@/src/lib/store";
import { BLOGGER_VIDEOS, CLAIMS, DOUYIN_VIDEOS, EVIDENCE } from "@/src/data/knowledge";
import { AddSourceDialog } from "@/src/components/kb/AddSourceDialog";
import { ClaimsBrowser } from "@/src/components/kb/ClaimsBrowser";
import { EvidenceLibrary } from "@/src/components/kb/EvidenceLibrary";
import { KbToaster } from "@/src/components/kb/KbToaster";
import { PendingPapers, PendingVideos } from "@/src/components/kb/PendingSources";
import { SourcePolicyNote } from "@/src/components/kb/SourcePolicyNote";
import { VideoLibrary } from "@/src/components/kb/VideoLibrary";
import { LAYER_TONE } from "@/src/components/kb/meta";
import { usePendingSources } from "@/src/components/kb/sources";

const VIDEO_TOTAL = BLOGGER_VIDEOS.length + DOUYIN_VIDEOS.length;
const VIDEO_SPLIT = `B站 ${BLOGGER_VIDEOS.length} · 抖音 ${DOUYIN_VIDEOS.length}`;

const LEGEND = [
  { n: 1, label: "博主原话", tone: "voice" as const },
  { n: 2, label: "AI 拆解", tone: "ai" as const },
  { n: 3, label: "科学证据", tone: "science" as const },
  { n: 4, label: "产品建议", tone: "advice" as const },
];

/**
 * 管理侧知识库：保留全部筛选、来源库与「添加来源」能力。
 * 普通用户导航里看不到本页，只能通过建议旁的「为什么这样建议」打开证据抽屉。
 */
export default function Knowledge() {
  const { state } = useApp();
  const pending = usePendingSources();

  const [tab, setTab] = useState("claims");
  const [dialogOpen, setDialogOpen] = useState(false);

  const merged = useMemo(() => CLAIMS.map((c) => applyOverride(c, state.claimOverrides)), [state.claimOverrides]);
  const published = useMemo(() => merged.filter((c) => c.review.state === "published"), [merged]);
  const waitingCount = merged.filter((c) => c.review.state === "ai_extracted" || c.review.state === "pending_review").length;
  const confirmedCount = merged.filter((c) => c.review.state === "human_confirmed").length;

  const authors = useMemo(() => {
    const set = new Set<string>();
    merged.forEach((c) => c.layer1.source?.author && set.add(c.layer1.source.author));
    BLOGGER_VIDEOS.forEach((v) => set.add(v.author));
    DOUYIN_VIDEOS.forEach((v) => set.add(v.author));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
  }, [merged]);

  const doiCount = EVIDENCE.filter((e) => e.doi).length;
  const pmidCount = EVIDENCE.filter((e) => e.pmid).length;

  const knownBvids = useMemo(
    () => [
      ...BLOGGER_VIDEOS.map((v) => v.bvid).filter((b): b is string => !!b),
      ...pending.videos.map((v) => v.bvid).filter((b): b is string => !!b),
    ],
    [pending.videos],
  );
  const knownAwemeIds = useMemo(
    () => [
      ...DOUYIN_VIDEOS.map((v) => v.aweme_id),
      ...pending.videos.map((v) => v.awemeId).filter((a): a is string => !!a),
    ],
    [pending.videos],
  );
  const knownDois = useMemo(
    () => [
      ...EVIDENCE.map((e) => e.doi).filter((d): d is string => !!d),
      ...pending.papers.map((p) => p.doi).filter((d): d is string => !!d),
    ],
    [pending.papers],
  );
  const knownPmids = useMemo(
    () => [
      ...EVIDENCE.map((e) => e.pmid).filter((p): p is string => !!p),
      ...pending.papers.map((p) => p.pmid).filter((p): p is string => !!p),
    ],
    [pending.papers],
  );

  return (
    <div className="relative z-10 mx-auto grid max-w-6xl gap-6 p-4 md:p-6">
      <header className="rise grid gap-4">
        <div className="energy-line h-1 w-28 rounded-full" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1.5">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Knowledge Admin · 内容与来源管理</p>
            <h1 className="text-3xl font-bold tracking-tight">知识库（管理侧）</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              把博主观点拆成可核验的结论：博主原话 → AI 拆解 → 科学证据 → 产品建议，四层分开呈现，
              每个出处都能点击回到原平台核对。拿不到的材料如实标注「素材不足」。
              当前收录 {VIDEO_TOTAL} 条真实视频来源（{VIDEO_SPLIT}）与 {EVIDENCE.length} 篇真实文献。
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            添加来源
          </Button>
        </div>

        <Alert className="border-warn/40 bg-warn/10">
          <ShieldCheck className="text-warn" />
          <AlertTitle>管理员视图</AlertTitle>
          <AlertDescription>
            本页含待审核来源与审核状态筛选，只给内容审核人员使用，普通用户导航中不出现。
            普通用户侧只有「为什么这样建议」抽屉，且只展示已发布结论及其出处；待审核内容不能成为正式建议依据。
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { icon: ShieldCheck, label: "已发布结论", value: published.length, sub: `全库 ${merged.length} 条拆解`, tone: "text-ok" },
            { icon: ListChecks, label: "审核流程中", value: waitingCount + confirmedCount, sub: `${waitingCount} 待审 · ${confirmedCount} 待发布`, tone: "text-warn" },
            { icon: FileText, label: "真实文献", value: EVIDENCE.length, sub: `${doiCount} DOI · ${pmidCount} PMID`, tone: "text-science" },
            { icon: Video, label: "视频来源", value: VIDEO_TOTAL, sub: VIDEO_SPLIT, tone: "text-voice" },
            { icon: Layers, label: "覆盖主题", value: new Set(merged.map((c) => c.topic)).size, sub: `${authors.length} 位博主 · 2 个平台`, tone: "text-ai" },
          ].map((s) => (
            <Card key={s.label} className="gap-1 p-4">
              <s.icon className={`size-4 ${s.tone}`} />
              <p className="text-2xl font-bold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-[11px] text-muted-foreground/80">{s.sub}</p>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">四层分离：</span>
          {LEGEND.map((l) => (
            <span key={l.n} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${LAYER_TONE[l.tone].border} ${LAYER_TONE[l.tone].soft}`}>
              <span className={`flex size-4 items-center justify-center rounded text-[10px] font-bold ${LAYER_TONE[l.tone].chip}`}>{l.n}</span>
              <span className={LAYER_TONE[l.tone].head}>{l.label}</span>
            </span>
          ))}
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="rise" style={{ animationDelay: "80ms" }}>
        <TabsList className="w-full md:w-fit">
          <TabsTrigger value="claims" className="gap-1.5">
            <Layers className="size-4" />
            结论卡片
            <Badge variant="secondary">{published.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="evidence" className="gap-1.5">
            <BookOpen className="size-4" />
            文献库
            <Badge variant="secondary">{EVIDENCE.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-1.5">
            <Video className="size-4" />
            视频源
            <Badge variant="secondary">{VIDEO_TOTAL}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="mt-4">
          <ClaimsBrowser scope="all" />
        </TabsContent>

        <TabsContent value="evidence" className="mt-4 grid gap-4">
          <PendingPapers papers={pending.papers} onRemove={(id) => { pending.removePaper(id); toast.success("已移除待审核文献"); }} />
          <EvidenceLibrary />
        </TabsContent>

        <TabsContent value="videos" className="mt-4 grid gap-4">
          <PendingVideos videos={pending.videos} onRemove={(id) => { pending.removeVideo(id); toast.success("已移除待审核视频"); }} />
          <VideoLibrary />
        </TabsContent>
      </Tabs>

      <SourcePolicyNote />

      <footer className="flex items-start gap-2 rounded-lg border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          本页为管理侧入口：审核状态筛选、待审核来源与「添加来源」只在这里出现。
          普通用户看到的出处链来自同一份数据，但只有已发布结论，且不展示待审核内容。
        </p>
      </footer>

      <AddSourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        knownBvids={knownBvids}
        knownAwemeIds={knownAwemeIds}
        knownDois={knownDois}
        knownPmids={knownPmids}
        onAddVideo={(v) => { pending.addVideo(v); setTab("videos"); }}
        onAddPaper={(p) => { pending.addPaper(p); setTab("evidence"); }}
      />
      <KbToaster />
    </div>
  );
}
