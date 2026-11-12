import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlanExercise } from "@/src/components/plan/trainingEngine";
import { loadConflict, loadText } from "@/src/components/plan/load";

export function LoadBadge({ pe }: { pe: PlanExercise }) {
  const conflict = loadConflict(pe);
  return (
    <Badge
      variant="outline"
      className={cn("tabular-nums", conflict ? "border-warn/40 bg-warn/10 text-warn" : "border-science/40 bg-science/10 text-foreground")}
      title={conflict ? `器械为「${pe.exercise.equipment}」，但估算器按自重处理，不给猜测重量。以 RIR 2–3 自选起步重量。` : pe.load.note}
    >
      {loadText(pe)}
    </Badge>
  );
}
