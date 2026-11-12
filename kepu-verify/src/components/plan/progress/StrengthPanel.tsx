import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Sigma, TriangleAlert } from "lucide-react";
import type { TrainingEntry } from "@/src/lib/types";
import { today } from "@/src/lib/calc";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MissingNote } from "@/src/components/form/bits";
import { cn } from "@/lib/utils";
import { strengthSummary } from "@/src/components/plan/progress/strengthMetrics";
import { TrendSparkline } from "@/src/components/plan/progress/TrendSparkline";

function Metric({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-xs leading-relaxed">{children}</div>
      {hint && <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StrengthPanel({ exerciseId, exerciseName, training, demo }: {
  exerciseId: string;
  exerciseName: string;
  training: TrainingEntry[];
  demo: boolean;
}) {
  const [rawOpen, setRawOpen] = useState(false);
  const entries = useMemo(() => training.filter((t) => t.exerciseId === exerciseId), [training, exerciseId]);
  const s = useMemo(() => strengthSummary(entries, today()), [entries]);
  const latestPr = s.prs[s.prs.length - 1] ?? null;

  return (
    <div className="rounded-lg border border-science/30 bg-science-soft/40 p-3" data-strength-panel={exerciseId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <Sigma className="size-3.5 text-science" />
          力量追踪
        </p>
        <div className="flex items-center gap-1.5">
          {demo && <Badge variant="outline" className="border-warn/40 bg-warn/10 text-[10px] text-warn">示例数据</Badge>}
          <Badge variant="outline" className={cn("text-[10px]", s.hasAny ? "border-science/40 bg-science/10 text-foreground" : "text-muted-foreground")}>
            {s.hasAny ? `${s.sets.length} 组记录` : "暂无记录"}
          </Badge>
        </div>
      </div>

      {!s.hasAny ? (
        <div className="mt-2">
          <MissingNote>
            暂无「{exerciseName}」的训练记录。完成一次训练并保存后，这里才会计数；没有记录时不显示任何估算数字。
          </MissingNote>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="上次训练" hint={s.last ? undefined : "只统计早于今天的记录"}>
              {s.last ? (
                <>
                  <p className="font-medium tabular-nums">{s.last.date}（{s.last.daysAgo === 0 ? "今天" : `${s.last.daysAgo} 天前`}）</p>
                  <p className="mt-0.5 tabular-nums text-muted-foreground">{s.last.summary}</p>
                  <p className="mt-0.5 tabular-nums text-[10px] text-muted-foreground">{s.last.sets} 组 · 容量 {Math.round(s.last.volume)} kg·次</p>
                </>
              ) : (
                <p className="text-muted-foreground">暂无早于今天的训练记录</p>
              )}
            </Metric>

            <Metric label="本次训练（今天）">
              {s.today ? (
                <>
                  <p className="font-medium tabular-nums">{s.today.sets} 组 · 容量 {Math.round(s.today.volume)} kg·次</p>
                  <p className="mt-0.5 tabular-nums text-muted-foreground">{s.today.summary}</p>
                </>
              ) : (
                <p className="text-muted-foreground">今天还没有保存的训练记录（未保存的草稿不计入）</p>
              )}
            </Metric>

            <Metric label="历史最佳工作组" hint="按 Epley 估算 1RM 取最高的一组；平手时取更重的重量。自重不参与 1RM 比较。">
              {s.best ? (
                <>
                  <p className="font-medium tabular-nums">{s.best.weightKg} kg × {s.best.reps} 次</p>
                  <p className="mt-0.5 tabular-nums text-muted-foreground">{s.best.date} · 估算 1RM {s.best.e1rm} kg</p>
                </>
              ) : s.bestBodyweightReps ? (
                <>
                  <p className="font-medium tabular-nums">自重 × {s.bestBodyweightReps.reps} 次</p>
                  <p className="mt-0.5 tabular-nums text-muted-foreground">{s.bestBodyweightReps.date}（自重不计算 1RM）</p>
                </>
              ) : (
                <p className="text-muted-foreground">暂无负重组</p>
              )}
            </Metric>

            <Metric label="估算 1RM" hint="Epley：重量 × (1 + 次数 ÷ 30)；次数越高误差越大，只作趋势参考，不是实测极限。">
              {s.e1rm ? (
                <>
                  <p className="flex flex-wrap items-baseline gap-1.5 font-medium tabular-nums">
                    ≈ {s.e1rm.e1rm} kg
                    <Badge variant="outline" className="border-science/40 bg-science/10 text-[10px] text-foreground">估算</Badge>
                  </p>
                  <p className="mt-0.5 tabular-nums text-muted-foreground">
                    来源：{s.e1rm.weightKg} kg × {s.e1rm.reps} 次（{s.e1rm.date}）
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">没有可用于估算的负重组（自重或次数 &gt; 30 不计）</p>
              )}
            </Metric>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Metric
              label="最近 30 天重量趋势"
              hint={`窗口 ${s.trend.start} 至 ${s.trend.end}；每天取最大重量。${s.trend.enough ? "" : "数据点不足，暂不连线。"}`}
            >
              {s.trend.points.length === 0 ? (
                <p className="text-muted-foreground">最近 30 天没有负重组记录</p>
              ) : (
                <TrendSparkline trend={s.trend} exerciseName={exerciseName} />
              )}
            </Metric>

            <Metric label="同重量次数变化" hint={s.sameWeight ? `基准为上次训练最高组重量 ${s.sameWeight.weightKg} kg` : "还没有可用重量"}>
              {s.sameWeight ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] tabular-nums">{s.sameWeight.weightKg} kg</Badge>
                    {s.sameWeight.delta != null && (
                      <Badge variant="outline" className={cn("text-[10px] tabular-nums", s.sameWeight.delta > 0 ? "border-ok/40 bg-ok/10 text-ok" : s.sameWeight.delta < 0 ? "border-warn/40 bg-warn/10 text-warn" : "text-muted-foreground")}>
                        {s.sameWeight.delta > 0 ? "+" : ""}{s.sameWeight.delta} 次
                      </Badge>
                    )}
                  </div>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {s.sameWeight.rows.slice(-5).map((r) => (
                      <li key={r.date} className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums">
                        <span className="text-muted-foreground">{r.date}</span>
                        <span>{r.reps} 次</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-muted-foreground">暂无可用重量，自重动作请看组数 / 次数</p>
              )}
            </Metric>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Metric
              label="本周训练容量"
              hint={`${s.week.start} 至 ${s.week.end}，容量 = 重量 × 次数。${s.week.bodyweightSets > 0 ? `含 ${s.week.bodyweightSets} 组自重（按 0 kg 计）。` : ""}`}
            >
              <p className="font-medium tabular-nums">{Math.round(s.week.volume)} kg·次</p>
              <p className="mt-0.5 tabular-nums text-muted-foreground">
                {s.week.sets} 组 · {s.week.reps} 次
                {s.week.deltaPct != null ? ` · 较上周 ${s.week.deltaPct >= 0 ? "+" : ""}${s.week.deltaPct}%` : " · 上周无容量数据"}
              </p>
            </Metric>

            <Metric label="PR 记录" hint="PR 按 Epley 估算 1RM 的历次新高计算；同一天只算一次，首次记录也计入。">
              {latestPr ? (
                <>
                  <p className="font-medium tabular-nums">{latestPr.date} · {latestPr.weightKg} kg × {latestPr.reps} 次</p>
                  <p className="mt-0.5 tabular-nums text-muted-foreground">
                    估算 1RM {latestPr.e1rm} kg · 共 {s.prs.length} 次 PR
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {s.prs.slice(-3).reverse().map((pr) => (
                      <li key={pr.date} className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
                        <span>{pr.date}</span>
                        <span>{pr.previous == null ? "首次记录" : `${pr.previous} → ${pr.e1rm} kg`}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-muted-foreground">还没有可计算的 PR（需要负重组）</p>
              )}
            </Metric>
          </div>

          <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            所有数字只来自本机真实的训练记录（重量 / 次数 / RPE）；估算 1RM 与 PR 均为估算，不是实测极限。
          </p>

          <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              原始记录（{entries.length} 条）
              <ChevronDown className={cn("size-3.5 transition-transform", rawOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1.5">
              <ul className="flex flex-col gap-1">
                {[...entries]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((entry) => (
                    <li key={entry.id} className="rounded-md border border-border bg-card p-2 text-[11px] tabular-nums">
                      <p className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{entry.date}</span>
                        <span className="text-muted-foreground">{entry.sets.length} 组</span>
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        {entry.sets
                          .map((set) => `${set.weightKg > 0 ? `${set.weightKg} kg` : "自重"} × ${set.reps}${set.rpe != null ? ` @RPE ${set.rpe}` : ""}`)
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
