import type { PlanExercise } from "@/src/components/plan/trainingEngine";

export const BODYWEIGHT_EQUIPMENT = /徒手|单杠|弹力带|墙面|门框|自重/;

/** 估算器把「平板卧推」「俯卧腿弯举」误判为自重（关键词与「平板支撑」「俯卧撑」冲突）。
 *  器械类型对不上时不给猜测重量，如实标注待核对。 */
export function loadConflict(pe: PlanExercise): boolean {
  return pe.load.isBodyweight && !BODYWEIGHT_EQUIPMENT.test(pe.exercise.equipment);
}

export function loadText(pe: PlanExercise): string {
  if (loadConflict(pe)) return "负重待核对";
  if (pe.load.isBodyweight) return "自重";
  if (pe.load.lowKg == null || pe.load.highKg == null) return pe.load.basis;
  return `${pe.load.lowKg}–${pe.load.highKg} kg`;
}
