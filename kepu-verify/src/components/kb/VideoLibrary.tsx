import { useMemo, useState } from "react";
import {
  CalendarDays, Clock, ExternalLink, Info, Play, Video, X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { BloggerSource } from "@/src/lib/types";
import { BLOGGER_VIDEOS, DOUYIN_BLOGGER, DOUYIN_VIDEOS } from "@/src/data/knowledge";
import { DOUYIN_STATS, DouyinSources } from "@/src/components/kb/DouyinSources";
import { fmtDuration, fmtUnixDate } from "@/src/components/kb/meta";

type PlatformFilter = "all" | "douyin" | "bilibili";

const VIDEO_TOTAL = BLOGGER_VIDEOS.length + DOUYIN_VIDEOS.length;
const VIDEO_SPLIT = `B站 ${BLOGGER_VIDEOS.length} · 抖音 ${DOUYIN_VIDEOS.length}`;

function groupBiliVideos(): { author: string; videos: BloggerSource[] }[] {
  const map = new Map<string, BloggerSource[]>();
  BLOGGER_VIDEOS.forEach((v) => {
    const arr = map.get(v.author) ?? [];
    arr.push(v);
    map.set(v.author, arr);
  });
  const priority = ["凯圣王", "谭成义"];
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const ia = priority.indexOf(a); const ib = priority.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b, "zh");
    })
    .map(([name, videos]) => ({
      author: name,
      videos: [...videos].sort((a, b) => (b.pubdate ?? 0) - (a.pubdate ?? 0)),
    }));
}

interface Props {
  /** 抽屉里用于聚焦当前结论的来源（平台 / 博主），默认仍可切回全部 */
  initialPlatform?: PlatformFilter;
  initialAuthor?: string;
  note?: string;
}

/** 视频来源库：平台筛选 / 版权声明 / 抖音章节 / B 站分组，整体来自原知识库页。 */
export function VideoLibrary({ initialPlatform = "all", initialAuthor = "all", note }: Props) {
  const [platform, setPlatform] = useState<PlatformFilter>(initialPlatform);
  const [author, setAuthor] = useState(initialAuthor);

  const videoGroups = useMemo(groupBiliVideos, []);
  const biliGroups = videoGroups.filter((g) => author === "all" || g.author === author);
  const showDouyin = platform !== "bilibili" && (author === "all" || DOUYIN_BLOGGER.name === author);
  const showBili = platform !== "douyin";

  return (
    <div className="grid gap-4">
      {note && <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>}

      <Alert>
        <Info />
        <AlertTitle>版权与转载声明</AlertTitle>
        <AlertDescription>
          视频版权归作者所有，本站仅保存来源信息并提供跳转，不存储或转载视频内容。
          B 站视频页声明「未经作者授权，禁止转载」，本站遵守该声明：不嵌入、不搬运完整视频，仅提供标题、发布时间等来源信息与原平台链接。
          抖音素材同样只做外链跳转，未登录、未下载任何视频文件；其中章节与整体摘要是平台自动生成的 AI 内容，已单独标注，不当作博主逐字原话。
        </AlertDescription>
      </Alert>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="[&>div]:w-full sm:w-56">
            <NativeSelect value={platform} onChange={(e) => setPlatform(e.target.value as PlatformFilter)} className="w-full" aria-label="按平台筛选视频源">
              <NativeSelectOption value="all">全部平台（{VIDEO_TOTAL}）</NativeSelectOption>
              <NativeSelectOption value="douyin">抖音 · 谭成义（{DOUYIN_VIDEOS.length}）</NativeSelectOption>
              <NativeSelectOption value="bilibili">哔哩哔哩（{BLOGGER_VIDEOS.length}）</NativeSelectOption>
            </NativeSelect>
          </div>
          {author !== "all" && (
            <Button variant="outline" size="xs" onClick={() => setAuthor("all")}>
              只看 {author}
              <X className="size-3" />
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            共 {VIDEO_TOTAL} 条真实视频来源 · {VIDEO_SPLIT} · 抖音另含 {DOUYIN_STATS.chapters} 个平台AI章节（{DOUYIN_STATS.summaries} 个带摘要正文）
          </p>
        </div>
      </Card>

      {showDouyin && <DouyinSources />}

      {showBili && (biliGroups.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Video /></EmptyMedia>
            <EmptyTitle>还没有 B 站视频来源</EmptyTitle>
            <EmptyDescription>点击「添加来源」粘贴 B 站链接即可登记，经审核后进入来源库。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        biliGroups.map((g) => (
          <Card key={g.author}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                <span className="flex size-10 items-center justify-center rounded-lg bg-info/10 text-lg font-bold text-info">
                  {g.author.slice(0, 1)}
                </span>
                {g.author}
                <Badge variant="secondary">{g.videos.length} 个视频</Badge>
                <Badge variant="outline" className="border-info/40 bg-info/10 text-info">哔哩哔哩</Badge>
              </CardTitle>
              <CardDescription>按发布时间从新到旧排列，点击标题跳转原平台观看。逐字字幕需登录未获取，本站不展示时间轴原话。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1">
              {g.videos.map((v) => (
                <div key={v.bvid ?? v.url} className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-accent">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Play className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-2 text-sm font-medium hover:text-primary hover:underline"
                    >
                      {v.title}
                    </a>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {fmtUnixDate(v.pubdate)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {fmtDuration(v.duration)}
                      </span>
                      {v.bvid && <span className="font-mono">{v.bvid}</span>}
                    </p>
                  </div>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-info hover:underline"
                  >
                    原视频
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      ))}
    </div>
  );
}
