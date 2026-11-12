import type { TrainingEntry } from "@/src/lib/types";
import { addDays, today } from "@/src/lib/calc";
import { EXERCISE_BY_ID } from "@/src/data/exercises";
import {
  GROUP_LABEL, loadCategory, type PlanExercise, type TrainingDay,
} from "@/src/components/plan/trainingEngine";
import type { CustomPlan } from "@/src/components/plan/planStore";

export const PART_TO_GROUP: Record<string, string> = {
  胸: "chest",
  背: "back",
  腿: "legs",
  肩: "shoulders",
  手臂: "arms",
  核心: "core",
  体态矫正: "core",
};

export const WARMUP_MIN = 10;

export function repsMid(pe: { repsLow: number; repsHigh: number }): number {
  return Math.round((pe.repsLow + pe.repsHigh) / 2);
}

/** 预计时长 = 10 分钟热身 + Σ(组数 × (次数中值 × 3 秒 + 组间休息))，向上取整。 */
export function estimateMinutes(exercises: PlanExercise[]): number {
  const seconds = exercises.reduce((sum, pe) => sum + pe.sets * (repsMid(pe) * 3 + pe.restSec), 0);
  return WARMUP_MIN + Math.ceil(seconds / 60);
}

export function totalSets(exercises: PlanExercise[]): number {
  return exercises.reduce((s, pe) => s + pe.sets, 0);
}

export type VersionId = "full" | "lite" | "safe";

export interface PlanVersion {
  id: VersionId;
  label: string;
  note: string;
  exercises: PlanExercise[];
  sameAsFull: boolean;
}

/** 三个版本是确定性的产品预设，不依赖随机数，也不改训练内容之外的东西。 */
export function buildVersions(day: TrainingDay): PlanVersion[] {
  if (day.kind === "rest" || day.exercises.length === 0) return [];
  const full = day.exercises;
  const lite = full.slice(0, 4);
  const safe = full.slice(0, 2).map((pe) => ({ ...pe, sets: Math.max(1, Math.ceil(pe.sets / 2)) }));
  return [
    { id: "full", label: "完整版", note: "全部动作、原计划组数。", exercises: full, sameAsFull: false },
    {
      id: "lite", label: "精简版", note: "按计划顺序保留前 4 个动作，组数不变。",
      exercises: lite, sameAsFull: lite.length === full.length,
    },
    { id: "safe", label: "保底版", note: "只做前 2 个动作，组数减半（至少 1 组）。", exercises: safe, sameAsFull: false },
  ];
}

export function customDaysToTrainingDays(plan: CustomPlan): TrainingDay[] {
  const days: TrainingDay[] = [];
  plan.days.forEach((day, index) => {
    const exercises: PlanExercise[] = [];
    for (const item of day.exercises) {
      const ex = EXERCISE_BY_ID.get(item.exerciseId);
      if (!ex) continue;
      const cat = loadCategory(ex);
      const bodyweightMove = cat === "bodyweight" || cat === "core";
      const hasWeight = item.weightKg != null && item.weightKg > 0;
      const isBodyweight = bodyweightMove && !hasWeight;
      exercises.push({
        exercise: ex,
        group: PART_TO_GROUP[ex.part] ?? "core",
        sets: item.sets,
        repsLow: item.repsLow,
        repsHigh: item.repsHigh,
        restSec: item.restSec,
        load: hasWeight
          ? {
              isBodyweight: false,
              lowKg: item.weightKg,
              highKg: item.weightKg,
              basis: "自定义计划",
              note: `重量为你在自定义计划里设定的 ${item.weightKg} kg，不是估算值。`,
            }
          : isBodyweight
            ? {
                isBodyweight: true,
                lowKg: null,
                highKg: null,
                basis: "自重",
                note: "自重动作，先保证动作质量与全程控制；能轻松完成后增加难度或负重。",
              }
            : {
                isBodyweight: false,
                lowKg: null,
                highKg: null,
                basis: "按 RIR 自选",
                note: "未在自定义计划里设定重量：选择能标准完成目标次数、保留 2–3 次余力的重量。",
              },
        isIsolation: cat === "isolation",
      });
    }
    const groups = [...new Set(exercises.map((pe) => pe.group))];
    days.push({
      dayIndex: index,
      weekday: `第 ${index + 1} 天`,
      kind: "train",
      focus: day.name,
      groups,
      exercises,
      cardioMin: 0,
      note: exercises.length === 0
        ? "这个训练日还没有动作，去「自定义计划」里从动作库添加。"
        : "自定义计划不绑定星期：按顺序训练或自行选择。重量未设定时按 RIR 自选，不自动填数字。",
    });
  });
  return days;
}

export function groupLabel(group: string): string {
  return GROUP_LABEL[group] ?? group;
}

export function daysAgo(dateISO: string): number {
  const a = new Date(`${dateISO}T00:00:00`).getTime();
  const b = new Date(`${today()}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** 同一动作最近一条训练记录（按日期，同日按后写入优先）。 */
export function lastRecordFor(training: TrainingEntry[], exerciseId: string): TrainingEntry | null {
  let best: TrainingEntry | null = null;
  for (const entry of training) {
    if (entry.exerciseId !== exerciseId) continue;
    if (!best || entry.date >= best.date) best = entry;
  }
  return best;
}

export function topSetWeight(entry: TrainingEntry | null): number | null {
  if (!entry) return null;
  const weights = entry.sets.map((s) => s.weightKg).filter((w) => w > 0);
  return weights.length ? Math.max(...weights) : null;
}

export function summarizeSets(entry: TrainingEntry): string {
  return entry.sets
    .map((s) => (s.weightKg > 0 ? `${s.weightKg} kg × ${s.reps}` : `自重 × ${s.reps}`))
    .join(" · ");
}

export function entryVolume(entry: TrainingEntry): number {
  return entry.sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

export function weekBounds(dateISO: string): { start: string; end: string } {
  const d = new Date(`${dateISO}T00:00:00`);
  const offset = (d.getDay() + 6) % 7;
  const start = addDays(dateISO, -offset);
  return { start, end: addDays(start, 6) };
}

export function planDurationLabel(exercises: PlanExercise[]): string {
  return `${estimateMinutes(exercises)} 分钟（含 ${WARMUP_MIN} 分钟热身）`;
}
