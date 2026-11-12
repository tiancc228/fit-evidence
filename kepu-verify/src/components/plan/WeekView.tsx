import { CalendarDays, Dumbbell, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TrainingDay } from "@/src/components/plan/trainingEngine";

export function WeekView({ week, activeDayIndex, todayIdx, splitLabel, onSelectDay }: {
  week: TrainingDay[];
  activeDayIndex: number;
  todayIdx: number;
  splitLabel: string;
  onSelectDay: (dayIndex: number) => void;
}) {
  return (
    <Card className="gap-0 rounded-xl py-0">
      <CardHeader className="gap-1 border-b border-border p-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarDays className="size-4 text-advice" />
          整周安排 · {splitLabel}
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          点选任意一天查看详情。{week[todayIdx]?.weekday}是今天。
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {week.map((d) => {
            const on = d.dayIndex === activeDayIndex;
            const sets = d.exercises.reduce((s, e) => s + e.sets, 0);
            return (
              <button
                key={d.dayIndex}
                onClick={() => onSelectDay(d.dayIndex)}
                aria-pressed={on}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2.5 text-left transition-colors",
                  on ? "border-advice/60 bg-advice-soft" : "border-border bg-card hover:bg-muted/50",
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium">{d.weekday}</span>
                  {d.dayIndex === todayIdx && <span className="size-1.5 rounded-full bg-advice" title="今天" />}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  {d.kind === "train" ? <Dumbbell className="size-3 text-advice" /> : <Moon className="size-3 text-ai" />}
                  {d.kind === "train" ? `${sets} 组` : "休息"}
                </span>
                <span className="line-clamp-2 text-[11px] leading-snug">{d.focus}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
