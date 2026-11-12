import { useMemo, useState } from "react";
import {
  BadgeCheck, Captions, ChevronDown, ExternalLink, FileText, Play, Sparkles, TimerOff, TriangleAlert,
} from "lucide-react";
import type { Exercise } from "@/src/lib/types";
import type { SourceEntry } from "@/src/data/source-index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { claimsForExercise } from "@/src/components/form/data";
import {
  SUBTITLE_LABEL, decodeEntities, evidenceBasis, formatDuration, formatPublishedAt,
  gapVerified, matchReason, nearDifference, positionDifference, verificationLabel, type ExerciseSources,
} from "./sources";

const KIND_LABEL: Record<SourceEntry["kind"], string> = {
  bilibili: "B 站",
  douyin: "抖音",
};

function DataState({
  icon: Icon,
  label,
  value,
  muted = true,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", muted ? "text-muted-foreground" : "text-ok")} />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={cn("text-xs leading-snug", muted ? "text-muted-foreground" : "text-foreground")}>{value}</p>
      </div>
    </div>
  );
}

function TopicLine({ topics }: { topics: string[] }) {
  if (topics.length === 0) return null;
  return (
    <p className="text-xs leading-relaxed">
      <span className="font-medium">该来源已整理的主题：</span>
      {topics.join("、")}
      <span className="text-muted-foreground">（来自站内拆解条目，不是对视频内容的重新概括）</span>
    </p>
  );
}

function VideoCard({
  source,
  exercise,
  level,
  gap,
  topics,
}: {
  source: SourceEntry;
  exercise: Exercise;
  level: "exact" | "near";
  gap: ExerciseSources["gap"];
  topics: string[];
}) {
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const diff = nearDifference(source, exercise, gap);
  const positionDiff = positionDifference(source, exercise);
  const title = decodeEntities(source.title) || "标题缺失（素材不足）";
  const duration = formatDuration(source.durationSec);
  const published = formatPublishedAt(source.publishedAt);
  const chapters = source.chapterTexts.map((c) => decodeEntities(c));
  const shownChapters = chaptersOpen ? chapters : chapters.slice(0, 3);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                level === "exact"
                  ? "border-ok/40 bg-ok/10 text-foreground"
                  : "border-warn/40 bg-warn/10 text-foreground",
              )}
            >
              {level === "exact" ? <BadgeCheck className="size-3 text-ok" /> : <TriangleAlert className="size-3 text-warn" />}
              {level === "exact" ? "精确匹配" : "相关变式"}
            </Badge>
            <Badge variant="outline">{KIND_LABEL[source.kind]}</Badge>
            {gapVerified(source, gap) ? (
              <Badge variant="outline" className="border-science/40 bg-science/10 text-foreground">定向补采已核验</Badge>
            ) : null}
          </div>
          <h4 className="mt-2 text-sm font-medium leading-snug">{title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            原作者：{source.author || "未标注"}
            {duration ? ` · ${duration}` : ""}
            {published ? ` · ${published} 发布` : ""}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
          <a href={source.url} target="_blank" rel="noopener noreferrer" title={title}>
            <Play className="size-3.5" />
            去原平台观看
            <ExternalLink className="size-3" />
          </a>
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-2.5">
        <p className="text-xs leading-relaxed">
          <span className="font-medium">匹配原因：</span>
          {matchReason(source, exercise, gap)}
        </p>
        <TopicLine topics={topics} />
      </div>

      {level === "near" ? (
        <div className="rounded-lg border border-warn/40 bg-warn/10 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <TriangleAlert className="size-3.5 text-warn" />
            差异说明（原始数据，不能视为同一个动作）
          </p>
          <p className="mt-1 text-xs leading-relaxed">{diff ?? "差异说明暂缺（素材不足）。仅凭标题无法核对器械或体位差异，请勿按同一动作照做。"}</p>
        </div>
      ) : null}

      {positionDiff ? (
        <div className={cn("rounded-lg border p-2.5", level === "exact" ? "border-warn/40 bg-warn/10" : "border-warn/30 bg-warn/5")}>
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <TriangleAlert className="size-3.5 text-warn" />
            体位 / 动作形式提示（来自原始标题）
          </p>
          <p className="mt-1 text-xs leading-relaxed">{positionDiff}</p>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <DataState icon={Sparkles} label="AI 总结" value="暂未生成可靠摘要" />
        <DataState
          icon={Captions}
          label="字幕可靠状态"
          value={SUBTITLE_LABEL[source.subtitleStatus]}
          muted={source.subtitleStatus !== "available"}
        />
        <DataState icon={TimerOff} label="时间点" value="暂无可核验时间点" />
        <DataState
          icon={BadgeCheck}
          label="证据核验状态"
          value={verificationLabel(source, gap)}
          muted={!gapVerified(source, gap)}
        />
      </div>

      <div className="rounded-lg border border-border p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <FileText className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">原始文案 / 章节</span>
          {source.platformAiChapters ? (
            <Badge variant="outline" className="border-warn/40 bg-warn/10 text-foreground">
              平台 AI 章节，非博主原话
            </Badge>
          ) : null}
          <span className="text-[11px] text-muted-foreground">内容依据：{evidenceBasis(source)}</span>
        </div>
        {chapters.length > 0 ? (
          <>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
              {shownChapters.map((chapter, i) => <li key={i}>{chapter}</li>)}
            </ul>
            {chapters.length > 3 ? (
              <Button variant="ghost" size="sm" className="mt-1 h-auto gap-1 p-0 text-xs" onClick={() => setChaptersOpen((v) => !v)}>
                <ChevronDown className={cn("size-3 transition-transform", chaptersOpen && "rotate-180")} />
                {chaptersOpen ? "收起章节" : `展开全部 ${chapters.length} 条章节`}
              </Button>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">暂无原始文案或章节。</p>
        )}
        {source.alternateUrls.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>同内容跨平台：</span>
            {source.alternateUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                {url}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SourceGroup({
  title,
  description,
  level,
  items,
  exercise,
  gap,
  topicsFor,
  warning,
}: {
  title: string;
  description: string;
  level: "exact" | "near";
  items: SourceEntry[];
  exercise: Exercise;
  gap: ExerciseSources["gap"];
  topicsFor: (source: SourceEntry) => string[];
  warning?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 4);

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary">{items.length}</Badge>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      {warning}
      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map((source) => (
          <VideoCard
            key={`${source.kind}:${source.id}`}
            source={source}
            exercise={exercise}
            level={level}
            gap={gap}
            topics={topicsFor(source)}
          />
        ))}
      </div>
      {items.length > 4 ? (
        <Button variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => setExpanded((v) => !v)}>
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
          {expanded ? "收起" : `展开全部 ${items.length} 条${level === "exact" ? "精确匹配" : "变式参考"}`}
        </Button>
      ) : null}
    </section>
  );
}

export default function VideoSources({ exercise, sources }: { exercise: Exercise; sources: ExerciseSources }) {
  const claims = useMemo(() => claimsForExercise(exercise.id), [exercise.id]);

  const topicsByKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const claim of claims) {
      const src = claim.layer1.source;
      for (const key of [src?.bvid, src?.url].filter((v): v is string => Boolean(v))) {
        const list = map.get(key) ?? [];
        if (!list.includes(claim.topicLabel)) list.push(claim.topicLabel);
        map.set(key, list);
      }
    }
    return map;
  }, [claims]);

  const topicsFor = (source: SourceEntry) => topicsByKey.get(source.id) ?? topicsByKey.get(source.url) ?? [];

  if (sources.exact.length === 0 && sources.near.length === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
          <p className="flex items-start gap-2 text-sm font-medium">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            暂未收录可靠教学来源。我们不会为了填满页面而关联不准确的视频。
          </p>
          <p className="mt-1 pl-6 text-xs leading-relaxed text-muted-foreground">
            该动作仍保留在动作库中，上方要领与纠错为产品教学建议。没有 exact / near 来源时，视频区保持为空。
          </p>
        </div>
        {sources.gap?.matchLevel === "none" && sources.gap.difference ? (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-2.5 text-left text-xs font-medium">
              查看定向补采的原始结论
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1.5 rounded-lg border border-border p-2.5 text-xs leading-relaxed text-muted-foreground">
              {sources.gap.difference}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sources.exact.length > 0 ? (
        <SourceGroup
          title="精确匹配"
          description="只展示 exact：标题或章节与动作名一致，或包含核心动作词且未点名冲突器械。标题点名了不同体位或握法时，卡片会单独提示，不视为完全相同的动作。"
          level="exact"
          items={sources.exact}
          exercise={exercise}
          gap={sources.gap}
          topicsFor={topicsFor}
        />
      ) : null}

      {sources.near.length > 0 ? (
        <SourceGroup
          title="相关变式参考"
          description="只展示 near：不是同一个动作，差异来自原始数据字段。"
          level="near"
          items={sources.near}
          exercise={exercise}
          gap={sources.gap}
          topicsFor={topicsFor}
          warning={
            <div className="rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-xs leading-relaxed">
              以下来源点名了不同器械或体位。我们不会把哑铃、杠铃、史密斯机或不同体位描述成完全相同的动作，请先看每张卡片的差异说明。
            </div>
          }
        />
      ) : null}
    </div>
  );
}
