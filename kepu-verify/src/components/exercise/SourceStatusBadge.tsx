import { BadgeCheck, GitCompareArrows, VideoOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SourceStatus } from "./sources";

const META: Record<
  SourceStatus,
  { label: string; className: string; iconClass: string; Icon: typeof BadgeCheck }
> = {
  exact: {
    label: "有可靠教学来源",
    className: "border-ok/40 bg-ok/10 text-foreground",
    iconClass: "text-ok",
    Icon: BadgeCheck,
  },
  near: {
    label: "有相关变式参考",
    className: "border-warn/40 bg-warn/10 text-foreground",
    iconClass: "text-warn",
    Icon: GitCompareArrows,
  },
  none: {
    label: "暂无可靠教学来源",
    className: "border-border bg-muted text-muted-foreground",
    iconClass: "text-muted-foreground",
    Icon: VideoOff,
  },
};

export default function SourceStatusBadge({
  status,
  count,
  className,
}: {
  status: SourceStatus;
  count?: number;
  className?: string;
}) {
  const meta = META[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5", meta.className, className)}>
      <meta.Icon className={cn("size-3", meta.iconClass)} />
      {meta.label}
      {count != null && count > 0 ? <span className="font-mono text-[10px] opacity-70">×{count}</span> : null}
    </Badge>
  );
}

export { META as SOURCE_STATUS_META };
