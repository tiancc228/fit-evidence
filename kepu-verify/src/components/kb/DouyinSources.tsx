import { useMemo, useState } from "react";
import {
  BadgeCheck, Bot, CalendarDays, ChevronDown, ChevronsDownUp, ChevronsUpDown,
  Clock, ExternalLink, Film, Hash, Info, ListVideo, MapPin, Play, Quote,
  RotateCcw, Search, ShieldCheck, Sparkles, ThumbsUp, Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DOUYIN_BLOGGER, DOUYIN_VIDEOS } from "@/src/data/knowledge";
import { cn } from "@/lib/utils";

type DouyinVideo = (typeof DOUYIN_VIDEOS)[number];
type DouyinChapter = DouyinVideo["chapters"][number];

type SortKey = "new" | "old" | "chapters" | "likes";

const SINGLE = "单条视频（未归入合集）";

/** chapters / platform_summary 是抖音平台自动生成的 AI 摘要，任何展示处都必须带这条标注。 */
const AI_CHAPTER_LABEL = "平台AI章节摘要 · 非博主逐字原话";
const AI_SUMMARY_LABEL = "平台AI整体摘要 · 非博主逐字原话";
const TIME_NOTE = "只给起始时间点：抖音未提供章节结束时间，逐字字幕需登录未获取，不推算时间区间。";

function collectionOf(v: DouyinVideo): string {
  return v.collection ?? SINGLE;
}

function parseCount(text: string | null): number | null {
  if (!text) return null;
  const m = text.match(/([\d.]+)\s*(万|亿)?/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === "万" ? n * 1e4 : m[2] === "亿" ? n * 1e8 : n;
}

const COLLECTIONS = (() => {
  const counts = new Map<string, number>();
  for (const v of DOUYIN_VIDEOS) {
    const k = collectionOf(v);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a, ca], [b, cb]) => {
      const sa = a === SINGLE ? 1 : 0;
      const sb = b === SINGLE ? 1 : 0;
      return sa - sb || cb - ca || a.localeCompare(b, "zh");
    })
    .map(([name, count]) => ({ name, count }));
})();

export const DOUYIN_STATS = {
  videos: DOUYIN_VIDEOS.length,
  chapters: DOUYIN_VIDEOS.reduce((n, v) => n + v.chapters.length, 0),
  summaries: DOUYIN_VIDEOS.reduce((n, v) => n + v.chapters.filter((c) => c.summary).length, 0),
  collections: COLLECTIONS.filter((c) => c.name !== SINGLE).length,
};

function ChapterRow({ chapter }: { chapter: DouyinChapter }) {
  return (
    <li className="grid grid-cols-[auto_1fr] items-start gap-2.5 rounded-md bg-background/50 p-2.5">
      <span className="rounded bg-ai/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ai tabular-nums">
        {chapter.start}
      </span>
      <div className="min-w-0">
        <p className="text-xs leading-snug font-medium">{chapter.title}</p>
        {chapter.summary ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{chapter.summary}</p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">无摘要正文：平台只给了章节标题，不补写内容。</p>
        )}
      </div>
    </li>
  );
}

function VideoCard({ video, open, onOpenChange }: {
  video: DouyinVideo; open: boolean; onOpenChange: (next: boolean) => void;
}) {
  const withSummary = video.chapters.filter((c) => c.summary).length;
  return (
    <div className="rounded-lg border border-border bg-card transition-colors hover:border-voice/40">
      <div className="flex items-start gap-2 p-3">
        <Collapsible open={open} onOpenChange={onOpenChange} className="min-w-0 flex-1">
          <CollapsibleTrigger className="flex w-full items-start gap-3 text-left">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-voice-soft text-voice">
              <Play className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm leading-snug font-medium">{video.title}</span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" />
                  {video.published_text ?? "发布时间未获取"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {video.duration_text ?? "时长未获取"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="size-3" />
                  {video.likes_text ?? "点赞数未获取"}
                </span>
                <span className="inline-flex items-center gap-1 text-ai">
                  <ListVideo className="size-3" />
                  {video.chapters.length} 章节 · {withSummary} 含摘要
                </span>
              </span>
            </span>
            <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-3 grid gap-3 border-t border-border pt-3">
            <div className="rounded-md border border-voice/30 bg-voice-soft p-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-voice">
                <Quote className="size-3" />
                博主本人撰写（标题 / 简介）
              </p>
              {video.desc ? (
                <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-line text-foreground">{video.desc}</p>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  简介未获取：该条视频博主没有填写简介，上方标题为博主本人撰写的原文。
                </p>
              )}
            </div>

            <div className="rounded-md border border-dashed border-ai/40 bg-ai-soft p-2.5">
              <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-ai">
                <Bot className="size-3" />
                {AI_SUMMARY_LABEL}
              </p>
              {video.platform_summary ? (
                <p className="mt-1.5 text-xs leading-relaxed text-foreground">{video.platform_summary}</p>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  素材较薄：抖音平台未给这条视频生成整体摘要，不做补写。
                </p>
              )}
            </div>

            <div className="rounded-md border border-ai/30 bg-ai-soft/60 p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="gap-1 border-ai/40 bg-ai/15 text-[10px] text-ai">
                  <Sparkles className="size-3" />
                  {AI_CHAPTER_LABEL}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {video.chapters.length} 个章节 · {withSummary} 个含摘要正文
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{TIME_NOTE}</p>
              {video.chapters.length > 0 ? (
                <ul className="mt-2 grid max-h-96 gap-1.5 overflow-y-auto pr-1">
                  {video.chapters.map((c) => (
                    <ChapterRow key={`${video.aweme_id}-${c.startSec}-${c.title}`} chapter={c} />
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">素材较薄：平台未给这条视频生成章节。</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-mono">
                <Hash className="size-3" />
                {video.aweme_id}
              </span>
              <span>仅使用主 aweme_id 链接，重复投稿不另列。</span>
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs text-voice hover:underline"
              >
                在抖音打开原视频
                <ExternalLink className="size-3" />
              </a>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 pt-1 text-xs text-info hover:underline"
        >
          原视频
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

export function DouyinSources() {
  const [q, setQ] = useState("");
  const [collection, setCollection] = useState("all");
  const [sort, setSort] = useState<SortKey>("new");
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const list = DOUYIN_VIDEOS.filter((v) => {
      if (collection !== "all" && collectionOf(v) !== collection) return false;
      if (!kw) return true;
      const hay = [
        v.title, v.desc ?? "", v.platform_summary ?? "", collectionOf(v),
        ...v.chapters.map((c) => `${c.title} ${c.summary ?? ""}`),
      ].join(" ").toLowerCase();
      return hay.includes(kw);
    });
    const sorted = [...list];
    switch (sort) {
      case "new":
        sorted.sort((a, b) => (b.published_text ?? "").localeCompare(a.published_text ?? ""));
        break;
      case "old":
        sorted.sort((a, b) => (a.published_text ?? "9999").localeCompare(b.published_text ?? "9999"));
        break;
      case "chapters":
        sorted.sort((a, b) => b.chapters.length - a.chapters.length);
        break;
      case "likes":
        sorted.sort((a, b) => (parseCount(b.likes_text) ?? -1) - (parseCount(a.likes_text) ?? -1));
        break;
    }
    return sorted;
  }, [q, collection, sort]);

  const groups = useMemo(() => {
    const map = new Map<string, DouyinVideo[]>();
    for (const v of filtered) {
      const k = collectionOf(v);
      const arr = map.get(k) ?? [];
      arr.push(v);
      map.set(k, arr);
    }
    return COLLECTIONS.filter((c) => map.has(c.name)).map((c) => ({
      name: c.name,
      total: c.count,
      videos: map.get(c.name) ?? [],
    }));
  }, [filtered]);

  const shownChapters = filtered.reduce((n, v) => n + v.chapters.length, 0);
  const shownSummaries = filtered.reduce((n, v) => n + v.chapters.filter((c) => c.summary).length, 0);
  const hasFilter = q !== "" || collection !== "all" || sort !== "new";
  const allOpen = filtered.length > 0 && filtered.every((v) => openMap[v.aweme_id]);

  function setAll(next: boolean) {
    setOpenMap(Object.fromEntries(filtered.map((v) => [v.aweme_id, next])));
  }

  return (
    <section className="grid gap-4">
      <Card className="border-voice/30">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3 text-base">
            <span className="flex size-11 items-center justify-center rounded-xl bg-voice-soft text-lg font-bold text-voice">
              {DOUYIN_BLOGGER.name.slice(0, 1)}
            </span>
            <span className="grid gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                {DOUYIN_BLOGGER.name}
                <Badge variant="outline" className="gap-1 border-voice/40 bg-voice/10 text-voice">
                  <Film className="size-3" />
                  抖音
                </Badge>
                <Badge variant="secondary" className="font-mono text-[10px]">@{DOUYIN_BLOGGER.unique_id}</Badge>
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                文字头像占位：来源数据中没有头像 URL，不编造、不热链任何图片。
              </span>
            </span>
            <a
              href={DOUYIN_BLOGGER.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs text-info hover:underline"
            >
              抖音主页
              <ExternalLink className="size-3" />
            </a>
          </CardTitle>
          <CardDescription className="grid gap-2">
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5 text-voice" />
                粉丝 <b className="tabular-nums">{DOUYIN_BLOGGER.followers_text}</b>
              </span>
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="size-3.5 text-voice" />
                获赞 <b className="tabular-nums">{DOUYIN_BLOGGER.likes_text}</b>
              </span>
              <span className="inline-flex items-center gap-1">
                <ListVideo className="size-3.5 text-voice" />
                主页作品 <b className="tabular-nums">{DOUYIN_BLOGGER.work_count}</b>
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-voice" />
                IP {DOUYIN_BLOGGER.ip_location}
              </span>
              <span className="inline-flex items-center gap-1">
                <BadgeCheck className="size-3.5 text-voice" />
                {DOUYIN_BLOGGER.age_text}
              </span>
            </span>
            <span className="rounded-md border border-voice/30 bg-voice-soft px-2.5 py-2 text-xs leading-relaxed text-voice">
              博主签名原文：{DOUYIN_BLOGGER.signature}
            </span>
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              本次从抖音公开页面读取到 {DOUYIN_STATS.videos} 条视频来源（未登录、未下载任何视频文件）；
              主页作品数 {DOUYIN_BLOGGER.work_count} 是平台显示值，未逐条核对，抓不到的不猜测。
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert className="border-ai/40 bg-ai-soft">
        <Bot className="text-ai" />
        <AlertTitle>先看出处：哪些是博主原话，哪些是平台 AI 摘要</AlertTitle>
        <AlertDescription className="grid gap-1.5">
          <span>
            <b className="text-voice">博主本人撰写</b>：视频标题与简介（desc），可作原文展示。
          </span>
          <span>
            <b className="text-ai">{AI_CHAPTER_LABEL}</b>：章节标题、章节摘要与整体摘要都由抖音平台自动生成，
            只能当定位与线索，不等于博主逐字原话，也不作为科学证据。
          </span>
          <span className="text-muted-foreground">{TIME_NOTE}</span>
        </AlertDescription>
      </Alert>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索抖音标题、简介、章节标题与摘要正文…"
              className="pl-9"
              aria-label="搜索抖音视频与章节"
            />
          </div>
          <div className="[&>div]:w-full">
            <NativeSelect value={collection} onChange={(e) => setCollection(e.target.value)} className="w-full" aria-label="按合集筛选">
              <NativeSelectOption value="all">全部合集（{DOUYIN_STATS.videos}）</NativeSelectOption>
              {COLLECTIONS.map((c) => (
                <NativeSelectOption key={c.name} value={c.name}>{c.name}（{c.count}）</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="[&>div]:w-full">
            <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-full" aria-label="抖音视频排序">
              <NativeSelectOption value="new">发布时间 · 新到旧</NativeSelectOption>
              <NativeSelectOption value="old">发布时间 · 旧到新</NativeSelectOption>
              <NativeSelectOption value="chapters">章节数 · 多到少</NativeSelectOption>
              <NativeSelectOption value="likes">点赞数 · 高到低</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="xs" onClick={() => setAll(!allOpen)}>
            {allOpen ? <ChevronsDownUp className="size-3" /> : <ChevronsUpDown className="size-3" />}
            {allOpen ? "全部收起章节" : "全部展开章节"}
          </Button>
          {hasFilter && (
            <Button variant="ghost" size="xs" onClick={() => { setQ(""); setCollection("all"); setSort("new"); }}>
              <RotateCcw className="size-3" />
              清除筛选
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            当前 {filtered.length} / {DOUYIN_STATS.videos} 条视频 · {shownChapters} 个章节（{shownSummaries} 个含摘要正文）
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          全库抖音素材：{DOUYIN_STATS.videos} 条视频 · {DOUYIN_STATS.collections} 个合集 + 单条视频 ·
          {" "}{DOUYIN_STATS.chapters} 个平台AI章节，其中 {DOUYIN_STATS.summaries} 个带摘要正文，其余只有标题，如实标注「无摘要正文」。
        </p>
      </Card>

      {filtered.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyTitle>没有匹配的抖音视频</EmptyTitle>
            <EmptyDescription>换个关键词或合集试试；搜索会同时命中标题、简介与平台AI章节摘要。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        groups.map((g) => (
          <Card key={g.name}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <ListVideo className="size-4 text-voice" />
                {g.name}
                <Badge variant="secondary">{g.videos.length} 条</Badge>
                {g.videos.length !== g.total && (
                  <Badge variant="outline" className="text-muted-foreground">合集共 {g.total} 条</Badge>
                )}
              </CardTitle>
              <CardDescription>
                按合集归档，点击任一条展开平台AI章节摘要；标题与「原视频」链接跳转抖音，本站不存储视频。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {g.videos.map((v) => (
                <VideoCard
                  key={v.aweme_id}
                  video={v}
                  open={!!openMap[v.aweme_id]}
                  onOpenChange={(next) => setOpenMap((m) => ({ ...m, [v.aweme_id]: next }))}
                />
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
        <p>
          抖音视频版权归博主所有：本站不下载、不存储、不转载任何完整视频，只展示来源信息与跳转原平台的链接。
          标题与简介为博主本人撰写；章节与整体摘要为抖音平台自动生成的 AI 内容，已单独标注，不与博主原话混同。
        </p>
      </div>
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        逐字字幕需登录未获取，因此本页没有「博主说这句话的时间轴」；章节起始时间只用于回原视频定位。
      </p>
    </section>
  );
}