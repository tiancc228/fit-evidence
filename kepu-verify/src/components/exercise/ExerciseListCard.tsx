import { ChevronRight, Dumbbell } from "lucide-react";
import type { Exercise } from "@/src/lib/types";
import { Badge } from "@/components/ui/badge";
import type { SourceStatus } from "./sources";
import SourceStatusBadge from "./SourceStatusBadge";

export default function ExerciseListCard({
  exercise,
  status,
  onOpen,
}: {
  exercise: Exercise;
  status: SourceStatus;
  onOpen: (exercise: Exercise) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(exercise)}
      aria-label={`查看「${exercise.name}」动作详情`}
      className="group flex w-full flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
          <Dumbbell className="size-4 text-chart-1" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-tight">{exercise.name}</h3>
          <Badge variant="secondary" className="mt-1.5">{exercise.part}</Badge>
        </div>
      </div>
      <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <SourceStatusBadge status={status} />
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
