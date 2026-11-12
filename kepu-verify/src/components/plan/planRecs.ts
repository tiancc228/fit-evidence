import { GUIDELINE_2022 } from "@/src/lib/calc";
import { SPLIT_LABEL, type TrainingDay } from "@/src/components/plan/trainingEngine";
import type { Rec } from "@/src/components/plan/ConclusionCard";

export function buildRecs({ vol, split, week }: {
  vol: { trainDays: number; totalSets: number; avgRestSec: number };
  split: keyof typeof SPLIT_LABEL;
  week: TrainingDay[];
}): Rec[] {
  const restCardio = week.find((d) => d.kind === "rest")?.cardioMin ?? 0;
  return [
    {
      id: "frequency", title: "训练频率与分化", topic: "frequency", exact: ["training-frequency", "training-split"],
      value: `每周 ${vol.trainDays} 练 · ${SPLIT_LABEL[split]}`,
      basis: `分化由每周天数决定，也可手动指定。指南建议抗阻运动每周 2–3 天起步。`,
    },
    {
      id: "volume", title: "训练容量与组间休息", topic: "volume", exact: ["training-volume", "rest-interval"],
      value: `每周 ${vol.totalSets} 组 · 平均组间 ${vol.avgRestSec} 秒`,
      basis: "组数与次数区间按目标与水平给出；新手先减一组，把动作质量放在重量之前。",
    },
    {
      id: "progression", title: "渐进超负荷", topic: "volume", exact: ["training-volume"],
      value: "达标再加重：上肢 +2.5 kg，下肢 +5 kg",
      basis: "产品训练建议：能在目标次数上限仍留 2–3 次余力，下次才加重；每 4–6 周安排减载周。对应证据见训练容量与新手适应条目，不把博主原话或文献结论改写成处方。",
    },
    {
      id: "novice", title: "新手起步与负重", topic: "novice", exact: ["novice-adaptation", "load-equipment", "range-of-motion", "joint-care"],
      value: "先动作质量，RIR 2–3 起步",
      basis: "没有训练记录时不给固定公斤数，按 RIR 2–3 自选起步重量；有记录后按上次重量给建议。",
    },
    {
      id: "technique", title: "动作选择与替代", topic: "novice", exact: ["exercise-technique", "load-equipment"],
      value: "先固定器械找感觉，再学自由重量；疼痛就换动作",
      basis: "计划里的动作全部来自动作库，要领与纠错属产品教学建议；博主的握法、呼吸、肩胛控制等技巧单独标注出处。",
    },
    {
      id: "intensity", title: "组内强度（RPE / RIR）与力竭", topic: "failure", exact: ["training-failure"],
      value: "RIR 2–3（约 RPE 7–8），不必每组力竭",
      basis: "RIR 表示还能做几次，RPE 表示主观用力程度；10 − RIR 只是粗略换算（RIR 2 约等于 RPE 8）。新手阶段留余力更利于恢复与技术稳定。",
    },
    {
      id: "cardio", title: "有氧安排", topic: "cardio",
      value: restCardio > 0 ? `休息日 ${restCardio} 分钟低强度有氧` : "以抗阻为主，日常步数补足",
      basis: `指南：${GUIDELINE_2022.activity.aerobic}；${GUIDELINE_2022.activity.steps}。`,
    },
    {
      id: "sleep", title: "睡眠与恢复", topic: "sleep", exact: ["sleep-recovery"],
      value: "7–9 小时 / 晚",
      basis: "休息日不是浪费：肌肉在恢复中生长，睡眠不足会同时影响训练表现与恢复。",
    },
    {
      id: "creatine", title: "可选补剂", topic: "creatine", exact: ["creatine", "glutamine"],
      value: "肌酸非必需，训练与饮食稳定后再考虑",
      basis: "补剂只在训练与恢复已经稳定时考虑；页面不推荐任何具体品牌或购买链接。",
    },
  ];
}
