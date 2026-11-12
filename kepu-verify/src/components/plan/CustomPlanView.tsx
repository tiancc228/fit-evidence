import { useEffect, useState } from "react";
import { CalendarPlus, Copy, Dumbbell, ListChecks, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePlanStore } from "@/src/components/plan/planStore";
import { DayEditor } from "@/src/components/plan/DayEditor";

export function CustomPlanView({ onOpenMyPlan }: { onOpenMyPlan: () => void }) {
  const { state, actions } = usePlanStore();
  const [selectedUid, setSelectedUid] = useState<string | null>(state.plan.days[0]?.uid ?? null);

  useEffect(() => {
    if (selectedUid && state.plan.days.some((d) => d.uid === selectedUid)) return;
    setSelectedUid(state.plan.days[0]?.uid ?? null);
  }, [state.plan.days, selectedUid]);

  const selected = state.plan.days.find((d) => d.uid === selectedUid) ?? null;

  function createDay() {
    const uid = actions.addDay();
    if (uid) setSelectedUid(uid);
  }

  function duplicateDay(uid: string) {
    const copy = actions.duplicateDay(uid);
    if (copy) setSelectedUid(copy);
  }

  function removeDay(uid: string) {
    const day = state.plan.days.find((d) => d.uid === uid);
    if (!day) return;
    if (!window.confirm(`删除「${day.name}」？这个训练日的动作会一起删除。`)) return;
    actions.removeDay(uid);
  }

  return (
    <Card className="gap-0 rounded-xl py-0">
      <CardHeader className="gap-2 border-b border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Dumbbell className="size-4 text-advice" />
            自定义计划
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={createDay}>
              <CalendarPlus className="size-3.5" />
              新建训练日
            </Button>
            <Button size="sm" className="gap-1.5" onClick={onOpenMyPlan}>
              <ListChecks className="size-3.5" />
              用这套计划去训练
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Input
            value={state.plan.name}
            onChange={(e) => actions.setPlanName(e.target.value)}
            className="h-8 max-w-sm"
            aria-label="自定义计划名称"
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            改动会自动保存到本机（独立存储，含版本号，解析失败会安全回退）。这里只影响「我的自定义计划」，不会改动系统按档案生成的分化。
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {state.plan.days.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border p-4">
            <p className="text-sm font-medium">还没有训练日</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              新建一个训练日，再从动作库添加动作，设置组数、次数、重量、RPE / RIR 与组间休息。也可以去「计划模板」用现成模板生成草稿。
            </p>
            <Button size="sm" className="gap-1.5" onClick={createDay}>
              <CalendarPlus className="size-3.5" />
              新建训练日
            </Button>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(200px,260px)_1fr]">
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">训练日</p>
              {state.plan.days.map((day) => {
                const on = day.uid === selectedUid;
                const sets = day.exercises.reduce((s, it) => s + it.sets, 0);
                return (
                  <div
                    key={day.uid}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border p-1.5",
                      on ? "border-advice/60 bg-advice-soft" : "border-border bg-card",
                    )}
                  >
                    <button
                      onClick={() => setSelectedUid(day.uid)}
                      aria-pressed={on}
                      className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left"
                    >
                      <span className="block truncate text-xs font-medium">{day.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{day.exercises.length} 动作</Badge>
                        <span className="tabular-nums">{sets} 组</span>
                      </span>
                    </button>
                    <Button variant="ghost" size="icon-sm" aria-label="复制这一天" title="复制这一天"
                      onClick={() => duplicateDay(day.uid)}>
                      <Copy className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="删除这一天" title="删除这一天"
                      onClick={() => removeDay(day.uid)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="min-w-0">
              {selected ? (
                <DayEditor key={selected.uid} day={selected} actions={actions} />
              ) : (
                <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                  从左边选择一个训练日开始编辑。
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
