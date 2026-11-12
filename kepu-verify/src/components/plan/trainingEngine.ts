import type { Exercise, Goal, Profile } from "@/src/lib/types";
import { GUIDELINE_2022 } from "@/src/lib/calc";
import type { Level, PlanConfig, SplitKind } from "@/src/components/plan/dietEngine";

export type LoadCategory = "squat" | "hinge" | "push" | "pull" | "shoulder" | "isolation" | "bodyweight" | "core";

export interface LoadEstimate {
  isBodyweight: boolean;
  lowKg: number | null;
  highKg: number | null;
  basis: string;
  note: string;
}

export interface PlanExercise {
  exercise: Exercise;
  group: string;
  sets: number;
  repsLow: number;
  repsHigh: number;
  restSec: number;
  load: LoadEstimate;
  isIsolation: boolean;
}

export interface TrainingDay {
  dayIndex: number;
  weekday: string;
  kind: "train" | "rest";
  focus: string;
  groups: string[];
  exercises: PlanExercise[];
  cardioMin: number;
  note: string;
}

export const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export const SPLIT_LABEL: Record<Exclude<SplitKind, "auto">, string> = {
  full: "全身训练",
  upperlower: "上下肢分化",
  ppl: "推/拉/腿分化",
  three: "三分化（胸/背/腿）",
};

export const GROUP_LABEL: Record<string, string> = {
  chest: "胸",
  back: "背",
  legs: "腿/臀",
  shoulders: "肩",
  arms: "手臂",
  core: "核心",
};

interface FocusTemplate {
  focus: string;
  groups: string[];
  armFocus?: "biceps" | "triceps";
}

const TEMPLATES: Record<Exclude<SplitKind, "auto">, FocusTemplate[]> = {
  full: [{ focus: "全身", groups: ["legs", "chest", "back", "shoulders", "core"] }],
  upperlower: [
    { focus: "上肢", groups: ["chest", "back", "shoulders", "arms"] },
    { focus: "下肢", groups: ["legs", "core"] },
  ],
  ppl: [
    { focus: "推（胸/肩/三头）", groups: ["chest", "shoulders", "arms"], armFocus: "triceps" },
    { focus: "拉（背/二头）", groups: ["back", "arms"], armFocus: "biceps" },
    { focus: "腿/臀", groups: ["legs", "core"] },
  ],
  three: [
    { focus: "胸 + 三头", groups: ["chest", "arms"], armFocus: "triceps" },
    { focus: "背 + 二头", groups: ["back", "arms"], armFocus: "biceps" },
    { focus: "腿 + 肩 + 核心", groups: ["legs", "shoulders", "core"] },
  ],
};

const ARM_KEYWORDS: Record<"biceps" | "triceps", string[]> = {
  biceps: ["二头", "弯举", "curl", "biceps"],
  triceps: ["三头", "臂屈伸", "extension", "triceps", "pushdown", "下压"],
};

/** Which days of the week are training days for a given weekly frequency. */
const TRAIN_DAY_PATTERN: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

export function resolveSplit(config: PlanConfig): Exclude<SplitKind, "auto"> {
  if (config.split !== "auto") return config.split;
  const d = config.trainingDays;
  if (d <= 2) return "full";
  if (d === 3) return "three";
  if (d === 4) return "upperlower";
  if (d === 5) return "ppl";
  return "ppl";
}

const GROUP_KEYWORDS: Record<string, string[]> = {
  chest: ["胸", "chest", "bench", "卧推", "胸推"],
  back: ["背", "back", "row", "划船", "下拉", "pulldown", "pull-down", "lat", "引体"],
  legs: ["腿", "leg", "squat", "蹲", "臀", "glute", "股", "腘", "硬拉", "deadlift", "弓步", "lunge", "腿举"],
  shoulders: ["肩", "shoulder", "推举", "侧平举", "lateral", "前平举", "rear delt"],
  arms: ["臂", "arm", "curl", "弯举", "二头", "三头", "肱", "臂屈伸", "extension"],
  core: ["腹", "core", "abs", "平板", "plank", "卷腹", "crunch", "核心", "腰"],
};

function textOf(ex: Exercise): string {
  return `${ex.part} ${ex.name} ${ex.nameEn} ${ex.pattern}`.toLowerCase();
}

function groupScore(ex: Exercise, group: string): number {
  const text = textOf(ex);
  const kw = GROUP_KEYWORDS[group] ?? [];
  let score = 0;
  for (const k of kw) if (text.includes(k.toLowerCase())) score += 2;
  // exact part match is the strongest signal
  if (ex.part && (ex.part.includes(GROUP_LABEL[group]) || GROUP_LABEL[group].includes(ex.part))) score += 3;
  return score;
}

export function loadCategory(ex: Exercise): LoadCategory {
  const t = textOf(ex);
  const has = (...kw: string[]) => kw.some((k) => t.includes(k.toLowerCase()));
  if (has("俯卧撑", "push-up", "pushup", "引体", "pull-up", "chin-up", "平板", "plank", "卷腹", "crunch", "自重", "bodyweight", "双杠", "dip", "仰卧")) return "bodyweight";
  if (has("腹", "core", "abs", "核心")) return "core";
  if (has("硬拉", "deadlift", "罗马尼亚", "rdl", "臀桥", "hip thrust", "早安", "good morning")) return "hinge";
  if (has("蹲", "squat", "弓步", "lunge", "腿举", "leg press", "腿屈伸", "腿弯举")) return "squat";
  if (has("弯举", "curl", "臂屈伸", "extension", "飞鸟", "fly", "侧平举", "lateral", "二头", "三头")) return "isolation";
  if (has("卧推", "bench", "胸推", "chest press", "俯卧", "push")) return "push";
  if (has("推举", "overhead", "肩", "shoulder")) return "shoulder";
  if (has("划船", "row", "下拉", "pulldown", "pull-down", "pull", "背")) return "pull";
  return "isolation";
}

const roundPlate = (kg: number) => Math.max(0, Math.round(kg / 2.5) * 2.5);

/**
 * 负重建议。没有个人训练历史时不给精确公斤数：
 * 体重倍数只是群体统计，套到个体身上误差可达数十公斤，写死一个区间等于假装精确。
 * 只有传入上次实际使用的重量时，才给出个性化建议。
 */
export function estimateLoad(
  ex: Exercise,
  level: Level,
  lastWeightKg: number | null = null,
): LoadEstimate {
  const cat = loadCategory(ex);
  if (cat === "bodyweight" || cat === "core") {
    return { isBodyweight: true, lowKg: null, highKg: null, basis: "自重", note: "自重动作，先保证动作质量与全程控制；能轻松完成后再增加难度或负重。" };
  }
  if (lastWeightKg == null || !(lastWeightKg > 0)) {
    return {
      isBodyweight: false,
      lowKg: null,
      highKg: null,
      basis: "按 RIR 自选",
      note: "选择能标准完成目标次数、同时保留 2–3 次余力（RIR 2–3）的重量；动作稳定后再逐周加重。有训练记录后按上次重量给建议。",
    };
  }
  const kg = roundPlate(lastWeightKg);
  return {
    isBodyweight: false,
    lowKg: kg,
    highKg: kg,
    basis: `上次 ${roundPlate(lastWeightKg)} kg`,
    note: "以能完成目标次数上限、仍留 2–3 次余力为准；达标后上肢 +2.5 kg、下肢 +5 kg，次数回到区间下限。",
  };
}

interface Prescription {
  sets: number;
  repsLow: number;
  repsHigh: number;
  restSec: number;
}

function prescribe(goal: Goal, level: Level, isIsolation: boolean, isCore: boolean): Prescription {
  let base: Prescription;
  if (goal === "muscle") base = { sets: 4, repsLow: 8, repsHigh: 12, restSec: 120 };
  else if (goal === "fatloss") base = { sets: 3, repsLow: 12, repsHigh: 15, restSec: 75 };
  else base = { sets: 4, repsLow: 8, repsHigh: 12, restSec: 90 };

  if (isCore) base = { ...base, sets: 3, repsLow: 12, repsHigh: 20, restSec: 60 };
  if (isIsolation) base = { ...base, sets: Math.max(2, base.sets - 1), repsLow: base.repsLow + 2, repsHigh: base.repsHigh + 3, restSec: Math.max(45, base.restSec - 30) };
  if (level === "novice") base = { ...base, sets: Math.max(2, base.sets - 1) };
  return base;
}

/** Select exercises for one training day from the (injected) library, without fabricating any. */
export function pickExercises(
  groups: string[],
  exercises: Exercise[],
  config: PlanConfig,
  weightKg: number,
  usedIds: Set<string>,
  armFocus?: "biceps" | "triceps",
): PlanExercise[] {
  const out: PlanExercise[] = [];
  const perGroup = groups.length >= 4 ? 1 : 2;
  for (const group of groups) {
    const ranked = exercises
      .map((ex) => ({ ex, score: groupScore(ex, group) }))
      .filter((x) => x.score > 0)
      .filter((x) => {
        if (group !== "arms" || !armFocus) return true;
        const t = textOf(x.ex);
        const hit = ARM_KEYWORDS[armFocus].some((k) => t.includes(k.toLowerCase()));
        // keep arm exercises that match the focus, or generic arm moves with no clear side
        const other = ARM_KEYWORDS[armFocus === "biceps" ? "triceps" : "biceps"].some((k) => t.includes(k.toLowerCase()));
        return hit || !other;
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const la = a.ex.level === config.level ? 0 : 1;
        const lb = b.ex.level === config.level ? 0 : 1;
        if (la !== lb) return la - lb;
        const ua = usedIds.has(a.ex.id) ? 1 : 0;
        const ub = usedIds.has(b.ex.id) ? 1 : 0;
        return ua - ub;
      });
    let taken = 0;
    for (const { ex } of ranked) {
      if (taken >= perGroup) break;
      if (out.some((o) => o.exercise.id === ex.id)) continue;
      const cat = loadCategory(ex);
      const isIsolation = cat === "isolation";
      const isCore = cat === "core" || group === "core";
      const rx = prescribe(config.goal, config.level, isIsolation, isCore);
      out.push({
        exercise: ex,
        group,
        sets: rx.sets,
        repsLow: rx.repsLow,
        repsHigh: rx.repsHigh,
        restSec: rx.restSec,
        load: estimateLoad(ex, config.level),
        isIsolation,
      });
      usedIds.add(ex.id);
      taken++;
    }
  }
  return out.slice(0, 7);
}

/** Rank the real exercise library for a body-part group; used by plan templates.
 *  Returns an empty array when the library has no matching movement, never a placeholder. */
export function rankExercisesForGroup(group: string, exercises: Exercise[], level: Level): Exercise[] {
  return exercises
    .map((ex) => ({ ex, score: groupScore(ex, group) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const la = a.ex.level === level ? 0 : 1;
      const lb = b.ex.level === level ? 0 : 1;
      if (la !== lb) return la - lb;
      return a.ex.id < b.ex.id ? -1 : 1;
    })
    .map((x) => x.ex);
}

export function buildWeek(config: PlanConfig, exercises: Exercise[], profile: Profile): TrainingDay[] {
  const split = resolveSplit(config);
  const templates = TEMPLATES[split];
  const trainDays = TRAIN_DAY_PATTERN[Math.min(6, Math.max(1, config.trainingDays))] ?? [0, 2, 4];
  const usedIds = new Set<string>();
  let ti = 0;
  const week: TrainingDay[] = [];
  for (let d = 0; d < 7; d++) {
    const isTrain = trainDays.includes(d);
    if (!isTrain) {
      const cardioMin = config.goal === "fatloss" ? 30 : config.goal === "recomp" ? 20 : 0;
      week.push({
        dayIndex: d,
        weekday: WEEKDAYS[d],
        kind: "rest",
        focus: "休息/恢复",
        groups: [],
        exercises: [],
        cardioMin,
        note:
          config.goal === "fatloss"
            ? `主动恢复：可加 ${cardioMin} 分钟低强度有氧（快走/单车），并保证睡眠。`
            : "休息日：保证睡眠，肌肉在恢复中生长。",
      });
      continue;
    }
    const tpl = templates[ti % templates.length];
    ti++;
    const exs = pickExercises(tpl.groups, exercises, config, profile.weightKg, usedIds, tpl.armFocus);
    week.push({
      dayIndex: d,
      weekday: WEEKDAYS[d],
      kind: "train",
      focus: tpl.focus,
      groups: tpl.groups,
      exercises: exs,
      cardioMin: config.goal === "fatloss" ? 15 : 0,
      note:
        exs.length === 0
          ? "素材不足：动作库中暂无匹配该部位的动作，请先在动作库补充。"
          : `训练前充分热身；${config.goal === "fatloss" ? "训练后可加 15 分钟低强度有氧。" : "组间专注动作质量。"}`,
    });
  }
  return week;
}

export const AEROBIC_GUIDELINE = GUIDELINE_2022.activity.aerobic;
export const RESISTANCE_GUIDELINE = GUIDELINE_2022.activity.resistance;

export function weeklyVolume(week: TrainingDay[]): { trainDays: number; totalSets: number; avgRestSec: number } {
  const train = week.filter((d) => d.kind === "train");
  const totalSets = train.reduce((s, d) => s + d.exercises.reduce((a, e) => a + e.sets, 0), 0);
  const rests = train.flatMap((d) => d.exercises.map((e) => e.restSec));
  const avgRestSec = rests.length ? Math.round(rests.reduce((a, b) => a + b, 0) / rests.length) : 0;
  return { trainDays: train.length, totalSets, avgRestSec };
}