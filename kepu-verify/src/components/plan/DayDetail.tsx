import { BedDouble, BookOpen, Dumbbell, Moon } from "lucide-react";
import type { TrainingEntry } from "@/src/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MissingNote } from "@/src/components/form/bits";
import type { TrainingDay } from "@/src/components/plan/trainingEngine";
import { GROUP_LABEL } from "@/src/components/plan/trainingEngine";
import { loadConflict } from "@/src/components/plan/load";
import { ExerciseRow } from "@/src/components/plan/ExerciseRow";

export function DayDetail({ day, training, demo, onGoEvidence }: {
  day: TrainingDay;
  training: TrainingEntry[];
  demo: boolean;
  onGoEvidence: () => void;
}) {
  return (
    <Card className="gap-0 rounded-xl py-0">
      <CardHeader className="gap-2 border-b border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {day.kind === "train" ? <Dumbbell className="size-4 text-advice" /> : <Moon className="size-4 text-ai" />}
            {day.weekday} · {day.focus}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            {day.groups.map((g) => (
              <Badge key={g} variant="secondary">{GROUP_LABEL[g] ?? g}</Badge>
            ))}
            {day.cardioMin > 0 && (
              <Badge variant="outline" className="border-science/40 bg-science/10 text-foreground">
                有氧 {day.cardioMin} 分钟
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{day.note}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-4">
        {day.kind === "rest" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-ai/30 bg-ai-soft p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <BedDouble className="size-4 text-ai" />
              休息日也是计划的一部分
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              保证睡眠，肌肉在恢复中生长。可安排 {day.cardioMin > 0 ? `${day.cardioMin} 分钟低强度有氧（快走 / 单车）` : "散步、拉伸等轻量活动"}，不做力竭训练。
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onGoEvidence}>
                <BookOpen className="size-3.5" />看睡眠 / 恢复依据
              </Button>
            </div>
          </div>
        ) : day.exercises.length === 0 ? (
          <MissingNote>素材不足：动作库中暂无匹配该部位的动作，请先在动作库补充。</MissingNote>
        ) : (
          <>
            {day.exercises.map((pe, i) => (
              <ExerciseRow key={`${pe.exercise.id}-${i}`} pe={pe} index={i} training={training} demo={demo} />
            ))}
            {day.exercises.some(loadConflict) && (
              <MissingNote>
                部分动作的器械类型与负重估算分类不一致（如「平板卧推」被关键词误判为自重），已标注「负重待核对」，不给猜测数字。
              </MissingNote>
            )}
            <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
              本日 {day.exercises.reduce((s, e) => s + e.sets, 0)} 组 · 平均组间 {Math.round(day.exercises.reduce((s, e) => s + e.restSec, 0) / day.exercises.length)}s
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
