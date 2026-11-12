import { History, Info } from "lucide-react";
import type { TrainingEntry } from "@/src/lib/types";
import { today } from "@/src/lib/calc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MissingNote } from "@/src/components/form/bits";
import { daysAgo, entryVolume, summarizeSets, weekBounds } from "@/src/components/plan/trainingHelpers";

export function LastSummary({ training, demo }: { training: TrainingEntry[]; demo: boolean }) {
  const { start, end } = weekBounds(today());
  const weekEntries = training.filter((t) => t.date >= start && t.date <= end);
  const weekDays = new Set(weekEntries.map((t) => t.date)).size;
  const weekSets = weekEntries.reduce((s, t) => s + t.sets.length, 0);
  const recent = [...training].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)).slice(0, 3);

  return (
    <Card className="gap-0 rounded-xl py-0">
      <CardHeader className="gap-1 border-b border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="size-4 text-advice" />
            上次完成情况
          </CardTitle>
          <div className="flex items-center gap-2">
            {demo && <Badge variant="outline" className="border-warn/40 bg-warn/10 text-[10px] text-warn">示例数据</Badge>}
            <span className="text-[11px] tabular-nums text-muted-foreground">
              本周 {weekDays} 练 · {weekSets} 组
            </span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">只统计本机真实的训练记录；没有记录就不显示数字。</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-4">
        {recent.length === 0 ? (
          <MissingNote>暂无训练记录，完成一次训练后这里会显示上次练了什么。</MissingNote>
        ) : (
          recent.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{entry.name}</p>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {entry.date} · {daysAgo(entry.date) === 0 ? "今天" : `${daysAgo(entry.date)} 天前`}
                </span>
              </div>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">{summarizeSets(entry)}</p>
              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                {entry.sets.length} 组 · 容量 {Math.round(entryVolume(entry))} kg·次
                {entry.sets.every((s) => s.weightKg === 0) ? "（自重按 0 计）" : ""}
              </p>
            </div>
          ))
        )}
        {recent.length > 0 && (
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            容量 = 重量 × 次数 的合计，仅用于和自己比较，不是训练处方。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
