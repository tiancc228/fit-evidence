import { CircleAlert, Database, RefreshCw, ShieldQuestion, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { providerLabel } from "@/src/lib/evidence";
import type { RemoteState } from "@/src/components/kb/useRemoteMeta";

/** 自动获取的元数据一律带来源机构 + 待人工核对，绝不静默当作已核实。 */
export function ProviderBadge({ provider, auto = true, className }: { provider: string; auto?: boolean; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 border-science/40 bg-science-soft text-science", className)}>
      <Database className="size-3" />
      {auto ? "自动获取 · " : ""}
      {providerLabel(provider)}
      <span className="text-warn">· 待人工核对</span>
    </Badge>
  );
}

export function ManualBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 border-warn/40 bg-warn/10 text-warn", className)}>
      <ShieldQuestion className="size-3" />
      人工填写 · 待核对
    </Badge>
  );
}

const TONE = {
  not_found: "border-warn/40 bg-warn/10 text-warn",
  invalid: "border-bad/40 bg-bad/10 text-bad",
  error: "border-bad/40 bg-bad/10 text-bad",
} as const;

/**
 * 自动获取的非成功态。文案由 evidence.ts 给出（含「不会用猜测内容填补」的说明），
 * 这里只负责如实展示 + 重试入口，不做任何降级填充。
 */
export function RemoteNotice<T>({
  state,
  onRetry,
  subject,
  className,
}: {
  state: RemoteState<T>;
  onRetry?: () => void;
  subject: string;
  className?: string;
}) {
  if (state.status === "idle" || state.status === "ok") return null;

  if (state.status === "loading") {
    return (
      <p className={cn("flex items-center gap-2 rounded-md border border-info/40 bg-info/10 px-2.5 py-2 text-xs text-info", className)}>
        <Spinner className="size-3.5" />
        正在向官方接口请求{subject}，仅接受真实返回值，不会预填猜测内容…
      </p>
    );
  }

  const Icon = state.status === "not_found" ? CircleAlert : TriangleAlert;
  const title = state.status === "not_found" ? "未查到" : state.status === "invalid" ? "输入不合法" : "获取失败";

  return (
    <div className={cn("grid gap-2 rounded-md border px-2.5 py-2", TONE[state.status], className)}>
      <p className="flex items-start gap-1.5 text-xs leading-relaxed">
        <Icon className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <span className="font-semibold">{title}：</span>
          {state.message}
        </span>
      </p>
      {onRetry && state.status !== "invalid" && (
        <Button type="button" variant="outline" size="xs" className="w-fit" onClick={onRetry}>
          <RefreshCw className="size-3" />
          重试自动获取
        </Button>
      )}
    </div>
  );
}