import { useState } from "react";
import { AlertTriangle, Check, Circle, Clock, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TrainingDay } from "@/src/components/plan/trainingEngine";
import {
  buildVersions, estimateMinutes, totalSets, type VersionId,
} from "@/src/components/plan/trainingHelpers";

export function TrainingVersions({ day, value, onChange, onStart }: {
  day: TrainingDay;
  value: VersionId;
  onChange: (id: VersionId) => void;
  onStart: () => void;
}) {
  const versions = buildVersions(day);
  if (versions.length === 0) {
    return (
      <Card className="gap-0 rounded-xl py-0">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListChecks className="size-4 text-advice" />
            训练版本与预计时长
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">休息日没有训练版本；可做低强度活动，不做力竭训练。</p>
        </CardContent>
      </Card>
    );
  }
  const current = versions.find((v) => v.id === value) ?? versions[0];

  return (
    <Card className="gap-0 rounded-xl py-0">
      <CardHeader className="gap-1 border-b border-border p-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ListChecks className="size-4 text-advice" />
          训练版本与预计时长
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          预计时长 = 10 分钟热身 + Σ(组数 × (次数中值 × 3 秒 + 组间休息))，向上取整。版本为产品预设，可随时改练其他动作。
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {versions.map((v) => {
            const on = v.id === current.id;
            return (
              <button
                key={v.id}
                onClick={() => onChange(v.id)}
                aria-pressed={on}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                  on ? "border-advice/60 bg-advice-soft" : "border-border bg-card hover:bg-muted/50",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{v.label}</span>
                  {on && <Check className="size-3.5 text-advice" />}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {v.exercises.length} 个动作 · {totalSets(v.exercises)} 组
                </span>
                <span className="flex items-center gap-1 text-xs tabular-nums">
                  <Clock className="size-3 text-muted-foreground" />
                  约 {estimateMinutes(v.exercises)} 分钟
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {v.note}
                  {v.sameAsFull ? "（当前与完整版一致）" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={onStart}>
            <Circle className="size-3.5 fill-current" />
            开始训练 · {current.label}
          </Button>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {current.exercises.length} 个动作 · {totalSets(current.exercises)} 组 · 含热身约 {estimateMinutes(current.exercises)} 分钟
          </span>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium">
            <AlertTriangle className="size-3 text-warn" />
            负重说明
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            没有该动作的训练记录时，页面不给固定公斤数，训练执行里留空并按 RIR 2–3 自选；有记录时只预填上次重量，仍以当天实际为准。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] text-muted-foreground">完整版：按计划全做</Badge>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">精简版：时间不够时保留前 4 个</Badge>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">保底版：只做前 2 个</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
