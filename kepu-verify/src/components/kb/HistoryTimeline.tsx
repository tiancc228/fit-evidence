import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Claim, ReviewState, Verdict } from "@/src/lib/types";
import { HISTORY_ACTION, REVIEW_META, VERDICT_META, fmtDateTime } from "@/src/components/kb/meta";
import { providerLabel } from "@/src/lib/evidence";

function traceLabel(s: string | null): string {
  if (s == null) return "—";
  if (s in REVIEW_META) return REVIEW_META[s as ReviewState].label;
  if (s in VERDICT_META) return VERDICT_META[s as Verdict].label;
  return s;
}

/** 挂载文献的留痕 to 字段存的是结构化 JSON，展示时还原成人类可读的文献行。 */
function attachLabel(to: string | null): string | null {
  if (!to) return null;
  try {
    const p = JSON.parse(to) as { ref?: { title?: string; doi?: string | null; pmid?: string | null; provider?: string }; relation?: string; strength?: string };
    if (!p.ref?.title) return null;
    const ids = [p.ref.doi ? `DOI ${p.ref.doi}` : null, p.ref.pmid ? `PMID ${p.ref.pmid}` : null].filter(Boolean).join(" · ");
    return `${p.ref.title}${ids ? `（${ids}）` : ""} · ${providerLabel(p.ref.provider ?? "未知来源")} · 待人工核对`;
  } catch {
    return null;
  }
}

export function HistoryTimeline({ history }: { history: Claim["review"]["history"] }) {
  if (history.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        暂无审核留痕。
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" />
        留痕由系统追加，不可删除或修改。
      </p>
      <ol className="relative ml-2 grid gap-4 border-l border-border pl-5">
        {history.map((h, i) => (
          <li key={`${h.at}-${i}`} className="relative">
            <span
              className={cn(
                "absolute top-1 -left-[26px] size-2.5 rounded-full border-2 border-background",
                h.actor === "human" ? "bg-primary" : "bg-ai",
              )}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{h.action}</span>
              <Badge variant="outline" className={h.actor === "human" ? "border-primary/40 text-primary" : "border-ai/40 text-ai"}>
                {h.actor === "human" ? "人工" : h.actor}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{fmtDateTime(h.at)}</span>
              {i === history.length - 1 && (
                <Badge variant="secondary" className="text-xs">最新</Badge>
              )}
            </div>
            {h.action === HISTORY_ACTION.attachEvidence ? (
              <p className="mt-1 rounded-md border border-science/30 bg-science-soft px-2.5 py-1.5 text-xs leading-relaxed text-science">
                {attachLabel(h.to) ?? "挂载记录格式异常，已忽略（不猜测内容）"}
              </p>
            ) : h.action === HISTORY_ACTION.detachEvidence ? (
              <p className="mt-1 text-xs text-muted-foreground">移除挂载：{h.to ?? "—"}</p>
            ) : (
              (h.from != null || h.to != null) && (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5">{traceLabel(h.from)}</span>
                  <span>→</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{traceLabel(h.to)}</span>
                </p>
              )
            )}
            {h.note && (
              <p className="mt-1 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {h.note}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}