import { useState } from "react";
import { ChevronDown, Dumbbell, Timer } from "lucide-react";
import type { TrainingEntry } from "@/src/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { PlanExercise } from "@/src/components/plan/trainingEngine";
import { loadConflict } from "@/src/components/plan/load";
import { LoadBadge } from "@/src/components/plan/LoadBadge";
import { ProductAdviceTag, VideoLink } from "@/src/components/form/bits";
import { StrengthPanel } from "@/src/components/plan/progress/StrengthPanel";

export function ExerciseRow({ pe, index, training, demo }: {
  pe: PlanExercise;
  index: number;
  training: TrainingEntry[];
  demo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ex = pe.exercise;
  const conflict = loadConflict(pe);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3 p-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-advice-soft text-xs font-semibold tabular-nums text-advice">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium">{ex.name}</span>
            <span className="text-xs text-muted-foreground">{ex.nameEn}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{ex.part}</Badge>
            <Badge variant="outline" className="text-muted-foreground">{ex.equipment}</Badge>
            <Badge variant="outline" className="border-advice/40 bg-advice-soft tabular-nums text-foreground">
              {pe.sets} 组 × {pe.repsLow}–{pe.repsHigh} 次
            </Badge>
            <Badge variant="outline" className="gap-1 tabular-nums text-muted-foreground">
              <Timer className="size-3" />
              组间 {pe.restSec}s
            </Badge>
            <LoadBadge pe={pe} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <VideoLink bvid={ex.videoBvid} mini />
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            要领 / 力量追踪
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 border-t border-border p-3">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium">动作要领</span>
              <ProductAdviceTag />
            </div>
            <ol className="flex flex-col gap-1">
              {ex.cues.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-science/15 text-[10px] tabular-nums">
                    {i + 1}
                  </span>
                  {c}
                </li>
              ))}
            </ol>
          </div>
          {ex.commonErrors.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium">常见错误 → 纠正</p>
              <ul className="flex flex-col gap-1.5">
                {ex.commonErrors.map((e, i) => (
                  <li key={i} className="rounded-md border border-border bg-muted/30 p-2 text-xs leading-relaxed">
                    <span className="font-medium text-warn">{e.error}</span>
                    <span className="text-muted-foreground">（{e.risk}）</span>
                    <span className="mt-0.5 block">{e.fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {conflict ? "负重估算与器械类型不一致，已标注待核对；先以能标准完成目标次数、留 2–3 次余力为准。" : pe.load.note}
            {pe.load.basis && !conflict ? ` 估算依据：${pe.load.basis}。` : ""}
          </p>
          <Button asChild variant="outline" size="sm" className="w-fit gap-1.5">
            <a href="#/form">
              <Dumbbell className="size-3.5" />
              去动作库看完整纠错与视频
            </a>
          </Button>
          <div className="border-t border-border pt-3">
            <StrengthPanel
              exerciseId={ex.id}
              exerciseName={ex.name}
              training={training}
              demo={demo}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
