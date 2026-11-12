import { AlertTriangle, ExternalLink, FlaskConical, Lightbulb, Play, Quote, ShieldAlert, Sparkles, Video } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtUnixDate, getSourceVideo } from "./data";

export const SCROLLBAR_X =
  "overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40";

const LAYER_META = {
  1: { label: "博主原话", className: "border-voice/30 bg-voice-soft", iconClass: "text-voice", Icon: Quote },
  2: { label: "AI 拆解结论", className: "border-ai/30 bg-ai-soft", iconClass: "text-ai", Icon: Sparkles },
  3: { label: "科学证据", className: "border-science/30 bg-science-soft", iconClass: "text-science", Icon: FlaskConical },
  4: { label: "产品最终建议", className: "border-advice/40 bg-advice-soft", iconClass: "text-advice", Icon: Lightbulb },
} as const;

export function LayerTag({ n, className }: { n: 1 | 2 | 3 | 4; className?: string }) {
  const m = LAYER_META[n];
  return (
    <Badge variant="outline" className={cn("gap-1.5", m.className, className)}>
      <m.Icon className={cn("size-3", m.iconClass)} />
      {m.label}
    </Badge>
  );
}

export function ProductAdviceTag({ label = "产品教学建议", className }: { label?: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 border-advice/40 bg-advice-soft text-foreground", className)}>
      <Lightbulb className="size-3 text-advice" />
      {label}
    </Badge>
  );
}

export function AiDisclaimerBadge() {
  return (
    <Badge variant="outline" className="gap-1 border-ai/30 bg-ai-soft text-foreground">
      <Sparkles className="size-3 text-ai" />
      AI 分析，仅供参考，非专业教练意见
    </Badge>
  );
}

/** 视频直达按钮：bvid 为 null 或不在真实来源清单中时不渲染链接。 */
export function VideoLink({ bvid, mini = false, className }: { bvid: string | null; mini?: boolean; className?: string }) {
  const video = getSourceVideo(bvid);
  if (!bvid) return null;
  if (!video) {
    return <span className={cn("text-xs text-muted-foreground", className)}>视频信息待核对（素材不足）</span>;
  }
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn("gap-1.5 border-chart-1/40 text-foreground hover:bg-chart-1/10", className)}
    >
      <a href={video.url} target="_blank" rel="noopener noreferrer" title={`动作资料关联视频：${video.title} · ${video.author}（是否精确匹配见动作详情）`}>
        <Play className="size-3.5 text-chart-1" />
        {mini ? "视频" : "关联视频"}
        <ExternalLink className="size-3 text-muted-foreground" />
      </a>
    </Button>
  );
}

/** 完整的来源信息卡：真实标题 / 作者 / 时长 / 发布日期 + 跳转原平台。 */
export function VideoSourceCard({ bvid }: { bvid: string }) {
  const video = getSourceVideo(bvid);
  if (!video) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        视频 {bvid} 未在真实来源清单中找到，暂不展示（素材不足）。
      </div>
    );
  }
  const pub = fmtUnixDate(video.pubdate);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
          <Video className="size-4 text-chart-1" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{video.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            B 站 · {video.author}
            {video.duration ? ` · ${video.duration}` : ""}
            {pub ? ` · ${pub} 发布` : ""}
          </p>
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
        <a href={video.url} target="_blank" rel="noopener noreferrer">
          <Play className="size-3.5" />
          去 B 站观看
          <ExternalLink className="size-3" />
        </a>
      </Button>
    </div>
  );
}

export function SafetyAlert({ className }: { className?: string }) {
  return (
    <Alert variant="destructive" className={cn("border-destructive/40 bg-destructive/5", className)}>
      <ShieldAlert />
      <AlertTitle>安全提示</AlertTitle>
      <AlertDescription>
        本工具不能替代专业教练和医生。训练中出现疼痛、麻木或明显不适，请立即停止训练并及时就医。
      </AlertDescription>
    </Alert>
  );
}

export function MissingNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />
      <span>{children}</span>
    </p>
  );
}