import { useState, type ReactNode } from "react";
import { Clock, ExternalLink, FileText, ListVideo, Quote, Trash2, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EvidenceItem } from "@/src/components/kb/EvidenceItem";
import { ManualBadge, ProviderBadge } from "@/src/components/kb/MetaNotice";
import { fmtDateTime, fmtDuration, fmtUnixDate, platformLabel } from "@/src/components/kb/meta";
import { SUBTITLE_LABEL } from "@/src/lib/evidence";
import type { PendingPaper, PendingVideo } from "@/src/components/kb/sources";

const AUTO_NOTE = "自动获取的元数据已标注来源机构，仍需人工核对；接口没返回的字段一律留空并标注未获取，不补写。";

function PendingShell({
  kind, count, children,
}: { kind: "video" | "paper"; count: number; children: React.ReactNode }) {
  const Icon = kind === "video" ? Video : FileText;
  return (
    <Card className="border-warn/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-warn" />
          待审核新增{kind === "video" ? "视频" : "文献"}（{count}）
        </CardTitle>
        <CardDescription>
          新增来源需人工审核通过才会进入公开知识库。{AUTO_NOTE}
          {kind === "video" && "本站不抓取、不存储、不转载视频内容，只做原平台外链跳转。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  );
}

function MetaLine({ item }: { item: { metaSource?: "auto" | "manual"; provider?: string | null; edited?: boolean; retrievedAt?: string | null; addedAt: string } }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="border-warn/40 bg-warn/10 text-warn">待审核 · 未发布</Badge>
      {item.metaSource === "auto" && item.provider
        ? <ProviderBadge provider={item.provider} />
        : <ManualBadge />}
      {item.edited && <Badge variant="outline" className="border-warn/40 bg-warn/10 text-warn">已人工修订</Badge>}
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3" />
        登记于 {fmtDateTime(item.addedAt)}
      </span>
      {item.retrievedAt && (
        <span className="text-xs text-muted-foreground">元数据获取于 {fmtDateTime(item.retrievedAt)}</span>
      )}
    </div>
  );
}

function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Button variant="ghost" size="xs" className="ml-auto text-muted-foreground" aria-label={label} onClick={onRemove}>
      <Trash2 className="size-3" />
      移除
    </Button>
  );
}

export function PendingPapers({ papers, onRemove }: { papers: PendingPaper[]; onRemove: (id: string) => void }) {
  if (papers.length === 0) return null;
  return (
    <PendingShell kind="paper" count={papers.length}>
      {papers.map((p) => (
        <div key={p.id} className="grid gap-2 rounded-lg border border-border bg-background/40 p-3">
          <div className="flex flex-wrap items-start gap-2">
            <MetaLine item={p} />
            <RemoveButton label="移除该待审核文献" onRemove={() => onRemove(p.id)} />
          </div>
          <EvidenceItem
            item={{
              doi: p.doi ?? null,
              pmid: p.pmid ?? null,
              title: p.title ?? "标题未获取（待人工从官方来源核对补全）",
              authors: p.authors ?? [],
              journal: p.journal ?? null,
              year: p.year ?? null,
              abstract: p.abstract ?? null,
              url: p.url,
              provider: p.provider ?? "人工填写（未自动获取）",
              pubType: [],
              citedBy: p.citedBy ?? null,
            }}
            className="bg-card"
          />
        </div>
      ))}
    </PendingShell>
  );
}

function PendingVideoRow({ video, onRemove }: { video: PendingVideo; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const chapters = video.chapters ?? [];
  const id = video.bvid ?? video.awemeId ?? video.url;
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-start gap-2">
        <MetaLine item={video} />
        <RemoveButton label="移除该待审核视频" onRemove={() => onRemove(video.id)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {video.platform && <Badge variant="secondary">{platformLabel(video.platform)}</Badge>}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline"
        >
          {id}
          <ExternalLink className="size-3" />
        </a>
      </div>

      <p className="text-sm leading-snug font-medium">{video.title ?? "标题未获取（待人工核对补全）"}</p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>博主 {video.author ?? "未获取"}</span>
        <span>时长 {video.durationSec != null ? fmtDuration(video.durationSec) : "未获取"}</span>
        <span>发布时间 {video.pubdate != null ? fmtUnixDate(video.pubdate) : "未获取"}</span>
        <span className="inline-flex items-center gap-1">
          <ListVideo className="size-3" />
          {video.platform === "douyin" ? "章节" : "分P / 章节"} {chapters.length} 个
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        逐字字幕：{video.subtitleStatus ? SUBTITLE_LABEL[video.subtitleStatus] ?? video.subtitleStatus : "未获取"}
        。不伪造时间戳，章节只展示接口返回的起始时间点。
      </p>

      {video.description ? (
        <p className="rounded-md border border-voice/30 bg-voice-soft px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
          <Quote className="mr-1 inline size-3 text-voice" />
          博主本人撰写的简介：{video.description}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">简介未获取（素材不足），不补写内容。</p>
      )}

      {chapters.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="xs" className="text-muted-foreground">
              <ListVideo className="size-3" />
              {open ? "收起章节 / 分P" : `展开章节 / 分P（${chapters.length}）`}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="mt-2 grid gap-1">
              {chapters.map((c, i) => (
                <li key={`${video.id}-c-${i}`} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                    {fmtDuration(c.startSec)}
                  </span>
                  <span className="leading-relaxed">{c.title}</span>
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function PendingVideos({ videos, onRemove }: { videos: PendingVideo[]; onRemove: (id: string) => void }) {
  if (videos.length === 0) return null;
  return (
    <PendingShell kind="video" count={videos.length}>
      {videos.map((v) => <PendingVideoRow key={v.id} video={v} onRemove={onRemove} />)}
    </PendingShell>
  );
}