import type { Exercise } from "@/src/lib/types";
import { EXERCISES } from "@/src/data/exercises";
import { loadCategory, rankExercisesForGroup } from "@/src/components/plan/trainingEngine";
import type { Level } from "@/src/components/plan/dietEngine";
import type { CustomDay, CustomItem, CustomPlan } from "@/src/components/plan/planStore";
import { uid } from "@/src/lib/calc";

export interface TemplateDaySpec {
  name: string;
  groups: string[];
  take: number;
}

export interface PlanTemplateDef {
  id: string;
  name: string;
  frequency: string;
  level: string;
  summary: string;
  /** 可一键设为系统计划的分化；自定义模板没有。 */
  systemSplit?: "full" | "upperlower" | "ppl" | "three";
  systemDays?: number;
  daySpecs: TemplateDaySpec[];
  appliesTo: string[];
  notFor?: string[];
  caution?: string;
  noviceWarning?: boolean;
  homeOnly?: boolean;
}

/** 只用真实动作库；器械不足时该部位少给动作，不补虚构动作。 */
const HOME_EQUIPMENT = /^(徒手|哑铃|弹力带|单杠)/;
const NOT_HOME = /凳|器械|龙门架|绳索|杠铃|腿举|提踵机/;

function homeReady(ex: Exercise): boolean {
  return HOME_EQUIPMENT.test(ex.equipment) && !NOT_HOME.test(ex.equipment);
}

function pickForGroup(
  spec: TemplateDaySpec,
  level: Level,
  used: Set<string>,
  homeOnly: boolean,
): Exercise[] {
  const pool = homeOnly ? EXERCISES.filter(homeReady) : EXERCISES;
  // 按部位轮转取动作，保证「腿/胸/背」这类多部位训练日不会只塞满第一个部位。
  const queues = spec.groups.map((group) =>
    rankExercisesForGroup(group, pool, level).filter((ex) => !used.has(ex.id)),
  );
  const out: Exercise[] = [];
  let round = 0;
  while (out.length < spec.take) {
    let added = false;
    for (const queue of queues) {
      if (out.length >= spec.take) break;
      const ex = queue[round];
      if (!ex || used.has(ex.id)) continue;
      out.push(ex);
      used.add(ex.id);
      added = true;
    }
    if (!added) break;
    round++;
  }
  return out;
}

function itemFor(ex: Exercise): CustomItem {
  const cat = loadCategory(ex);
  const isIsolation = cat === "isolation";
  const isCore = cat === "core";
  return {
    uid: uid(),
    exerciseId: ex.id,
    sets: 3,
    repsLow: isCore ? 15 : isIsolation ? 10 : 8,
    repsHigh: isCore ? 20 : isIsolation ? 15 : 12,
    weightKg: null,
    rpe: null,
    rir: null,
    restSec: isCore ? 60 : isIsolation ? 60 : 120,
  };
}

export function buildTemplatePlan(def: PlanTemplateDef, level: Level): CustomPlan {
  const used = new Set<string>();
  const days: CustomDay[] = def.daySpecs.map((spec) => {
    const picked = pickForGroup(spec, level, used, def.homeOnly === true);
    return {
      uid: uid(),
      name: spec.name,
      exercises: picked.map(itemFor),
    };
  });
  return {
    name: def.name,
    days,
    updatedAt: "",
  };
}

export const PLAN_TEMPLATES: PlanTemplateDef[] = [
  {
    id: "full",
    name: "全身训练",
    frequency: "每周 2–3 天",
    level: "新手起步",
    summary: "每次覆盖腿、胸、背、肩、核心，动作少、频率高，便于反复练动作模式。",
    systemSplit: "full",
    systemDays: 3,
    daySpecs: [{ name: "全身", groups: ["legs", "chest", "back", "shoulders", "core"], take: 6 }],
    appliesTo: ["刚接触抗阻训练", "每周只能练 2–3 天", "想把主要动作先学标准"],
    caution: "单次动作覆盖全身，注意组间休息与热身，不要把每組都练到力竭。",
  },
  {
    id: "upperlower",
    name: "上下肢分化",
    frequency: "每周 4 天",
    level: "有基础",
    summary: "上肢 / 下肢交替，单次部位集中，适合每周 4 天稳定训练。",
    systemSplit: "upperlower",
    systemDays: 4,
    daySpecs: [
      { name: "上肢", groups: ["chest", "back", "shoulders", "arms"], take: 6 },
      { name: "下肢", groups: ["legs", "core"], take: 5 },
    ],
    appliesTo: ["每周能稳定训练 4 天", "主要复合动作已能标准完成", "想在上下肢之间留恢复时间"],
  },
  {
    id: "ppl",
    name: "推 / 拉 / 腿",
    frequency: "每周 3–6 天",
    level: "有基础",
    summary: "按动作模式分化：推日、拉日、腿日，可按 3 天或 6 天循环。",
    systemSplit: "ppl",
    systemDays: 3,
    daySpecs: [
      { name: "推（胸/肩/三头）", groups: ["chest", "shoulders", "arms"], take: 6 },
      { name: "拉（背/二头）", groups: ["back", "arms"], take: 4 },
      { name: "腿/臀", groups: ["legs", "core"], take: 5 },
    ],
    appliesTo: ["每周能安排 3 天以上", "需要连续训练日也不冲突", "已熟悉推、拉、蹲铰链模式"],
    caution: "同一部位两次训练之间尽量间隔 48 小时；新手先用 3 天版本。",
  },
  {
    id: "three",
    name: "胸背腿三分化",
    frequency: "每周 3 天",
    level: "新手～进阶",
    summary: "每次专注一个大部位，单次训练目标清晰，适合每周 3 天。",
    systemSplit: "three",
    systemDays: 3,
    daySpecs: [
      { name: "胸 + 三头", groups: ["chest", "arms"], take: 5 },
      { name: "背 + 二头", groups: ["back", "arms"], take: 5 },
      { name: "腿 + 肩 + 核心", groups: ["legs", "shoulders", "core"], take: 6 },
    ],
    appliesTo: ["每周固定 3 天", "希望单次训练部位集中", "能接受每个部位每周只练一次"],
  },
  {
    id: "five",
    name: "五分化（胸/背/腿/肩/手臂）",
    frequency: "每周 5 天",
    level: "进阶",
    summary: "每个肌群单独一天，单次容量集中，需要稳定出勤与恢复条件。",
    daySpecs: [
      { name: "胸", groups: ["chest"], take: 4 },
      { name: "背", groups: ["back"], take: 4 },
      { name: "腿/臀", groups: ["legs"], take: 4 },
      { name: "肩", groups: ["shoulders"], take: 4 },
      { name: "手臂", groups: ["arms"], take: 4 },
    ],
    appliesTo: [
      "每周能稳定训练 5 天、缺练能补",
      "已有 6–12 个月以上系统训练经验",
      "主要动作模式熟练、能自我调整强度",
      "睡眠与恢复稳定",
    ],
    notFor: ["训练新手", "每周只能练 3–4 天", "经常缺练、无法按日补练"],
    caution: "单肌群每周只练一次，缺练一天不易补；新手请先用全身或上下肢分化，不建议把五分化作为第一套计划。",
    noviceWarning: true,
  },
  {
    id: "home",
    name: "居家训练",
    frequency: "每周 2–4 天",
    level: "新手～进阶",
    summary: "只用徒手、哑铃、弹力带、单杠类动作，按真实器械过滤，不硬塞健身房动作。",
    homeOnly: true,
    daySpecs: [
      { name: "居家 A（腿/胸/背）", groups: ["legs", "chest", "back"], take: 4 },
      { name: "居家 B（肩/手臂/核心）", groups: ["shoulders", "arms", "core"], take: 4 },
      { name: "居家 C（腿/核心）", groups: ["legs", "core"], take: 4 },
    ],
    appliesTo: ["没有健身房器械", "家里有哑铃或弹力带", "每周能练 2–4 天"],
    caution: "居家负重上限有限，进阶靠单侧、慢速离心、增加组数或更难变式；需要凳子的动作已排除。某个部位没有可用居家动作时，该训练日会少一个动作，不拿虚构动作补齐。",
  },
];

export function templateExerciseCount(def: PlanTemplateDef): number {
  return def.daySpecs.reduce((sum, spec) => sum + spec.take, 0);
}
