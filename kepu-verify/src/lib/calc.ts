import type { Activity, Goal, Profile, Sex } from "./types";

/** Mifflin-St Jeor resting energy equation. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "male" ? base + 5 : base - 161);
}

export const ACTIVITY_FACTOR: Record<Activity, { factor: number; label: string; desc: string }> = {
  sedentary: { factor: 1.2, label: "久坐", desc: "几乎不运动，办公室工作" },
  light: { factor: 1.375, label: "轻度活动", desc: "每周 1–3 次轻量训练" },
  moderate: { factor: 1.55, label: "中度活动", desc: "每周 3–5 次中等强度训练" },
  high: { factor: 1.725, label: "高度活动", desc: "每周 6–7 次高强度训练" },
  athlete: { factor: 1.9, label: "运动员级", desc: "每日两次训练或体力劳动" },
};

export function tdee(p: Profile): number {
  return Math.round(bmr(p.sex, p.weightKg, p.heightCm, p.age) * ACTIVITY_FACTOR[p.activity].factor);
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return +(weightKg / (m * m)).toFixed(1);
}

/** Chinese adult BMI cut-offs (WS/T 428-2013). */
export function bmiBand(v: number): { label: string; tone: "low" | "ok" | "warn" | "bad" } {
  if (v < 18.5) return { label: "体重过低", tone: "low" };
  if (v < 24) return { label: "体重正常", tone: "ok" };
  if (v < 28) return { label: "超重", tone: "warn" };
  return { label: "肥胖", tone: "bad" };
}

/** Body-fat reference bands, general adult population. */
export function bodyFatBand(pct: number, sex: Sex): { label: string; tone: "low" | "ok" | "warn" | "bad" } {
  const t = sex === "male"
    ? { essential: 5, athlete: 13, fit: 17, avg: 24 }
    : { essential: 13, athlete: 20, fit: 24, avg: 31 };
  if (pct < t.essential) return { label: "低于必需脂肪", tone: "bad" };
  if (pct <= t.athlete) return { label: "运动员水平", tone: "ok" };
  if (pct <= t.fit) return { label: "健美/紧实", tone: "ok" };
  if (pct <= t.avg) return { label: "普通水平", tone: "warn" };
  return { label: "偏高", tone: "bad" };
}

export interface StageResult {
  stage: string;
  headline: string;
  detail: string;
  bmiValue: number;
  bmiLabel: string;
  fatLabel: string | null;
  leanMassKg: number | null;
  ffmi: number | null;
  priority: string[];
}

export function assessStage(p: Profile): StageResult {
  const b = bmi(p.weightKg, p.heightCm);
  const band = bmiBand(b);
  const fat = p.bodyFatPct != null ? bodyFatBand(p.bodyFatPct, p.sex) : null;
  const lean = p.bodyFatPct != null ? +(p.weightKg * (1 - p.bodyFatPct / 100)).toFixed(1) : null;
  const ffmi = lean != null ? +(lean / Math.pow(p.heightCm / 100, 2)).toFixed(1) : null;

  let stage: string;
  let headline: string;
  let detail: string;
  let priority: string[];

  const highFat = p.bodyFatPct != null && (p.sex === "male" ? p.bodyFatPct > 20 : p.bodyFatPct > 30);
  const lowFat = p.bodyFatPct != null && (p.sex === "male" ? p.bodyFatPct < 10 : p.bodyFatPct < 18);

  if (b < 18.5) {
    stage = "偏瘦起步期";
    headline = "先把体重和力量基础建起来";
    detail = "当前 BMI 低于 18.5。此阶段优先保证能量与蛋白质充足，以复合动作建立神经适应与动作模式，不急于追求低体脂。";
    priority = ["热量盈余", "蛋白质足量", "动作模式学习", "避免过量有氧"];
  } else if (highFat) {
    stage = "减脂优先期";
    headline = "在保住肌肉的前提下制造温和缺口";
    detail = "体脂偏高，优先用温和热量缺口配合抗阻训练降低脂肪，同时用较高蛋白质摄入保护瘦体重。缺口不宜激进。";
    priority = ["温和热量缺口", "高蛋白保肌", "抗阻训练保留", "日常活动量"];
  } else if (lowFat && b < 24) {
    stage = "增肌窗口期";
    headline = "体脂较低，适合进入小幅盈余";
    detail = "体脂处于较低区间，增肌期营养分配效率较好。用小幅热量盈余配合渐进超负荷，控制增重速率避免脂肪过快累积。";
    priority = ["小幅热量盈余", "渐进超负荷", "训练容量递增", "睡眠恢复"];
  } else if (b >= 28) {
    stage = "体重管理期";
    headline = "先降体重，再谈塑形";
    detail = "BMI 已达肥胖区间。建议以饮食结构调整与规律活动为主，抗阻训练从低冲击动作起步，必要时咨询医师。";
    priority = ["饮食结构调整", "低冲击活动起步", "医学评估", "循序渐进"];
  } else {
    stage = "身体重塑期";
    headline = "体重正常，可同时增肌减脂";
    detail = "BMI 正常且体脂不算高，新手阶段可在维持热量附近同时提升肌肉量与降低脂肪，重点是训练质量与蛋白质分配。";
    priority = ["维持热量附近", "蛋白质分配", "动作质量", "渐进超负荷"];
  }

  return { stage, headline, detail, bmiValue: b, bmiLabel: band.label, fatLabel: fat?.label ?? null, leanMassKg: lean, ffmi, priority };
}

export interface MacroTarget {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  proteinPerKg: number;
  carbPerKg: number;
  delta: number;
  deltaPct: number;
  rationale: string;
  weeklyRateKg: string;
}

/**
 * Energy and macronutrient targets.
 * Protein ranges follow the resistance-training protein meta-analysis and ISSN
 * position stand; the higher cut range reflects lean-mass retention under deficit.
 */
export function macroTargets(p: Profile): MacroTarget {
  const base = tdee(p);
  let kcal: number;
  let proteinPerKg: number;
  let rationale: string;
  let weeklyRateKg: string;

  if (p.goal === "muscle") {
    kcal = Math.round(base * 1.12);
    proteinPerKg = 1.8;
    rationale = "增肌期采用约 +12% 的小幅盈余。蛋白质取 1.6–2.2 g/kg 区间中上值，兼顾合成刺激与依从性。";
    weeklyRateKg = "每周增重约 0.25%–0.5% 体重";
  } else if (p.goal === "fatloss") {
    kcal = Math.round(base * 0.8);
    proteinPerKg = 2.2;
    rationale = "减脂期采用约 −20% 的温和缺口。蛋白质提高到 2.0–2.7 g/kg 区间，用于在能量限制下保留瘦体重。";
    weeklyRateKg = "每周减重约 0.5%–1.0% 体重";
  } else {
    kcal = base;
    proteinPerKg = 2.0;
    rationale = "身体重塑期维持在 TDEE 附近，靠训练刺激与高蛋白分配同时改善体成分，体重变化可能不明显。";
    weeklyRateKg = "体重基本维持，围度与力量变化为主";
  }

  const proteinG = Math.round(p.weightKg * proteinPerKg);
  const fatG = Math.round(Math.max(p.weightKg * 0.7, (kcal * 0.22) / 9));
  const carbKcal = Math.max(0, kcal - proteinG * 4 - fatG * 9);
  const carbG = Math.round(carbKcal / 4);

  return {
    kcal, proteinG, fatG, carbG, proteinPerKg,
    carbPerKg: +(carbG / p.weightKg).toFixed(1),
    delta: kcal - base,
    deltaPct: Math.round(((kcal - base) / base) * 100),
    rationale, weeklyRateKg,
  };
}

export const GOAL_LABEL: Record<Goal, string> = {
  muscle: "增肌", fatloss: "减脂", recomp: "塑形/重塑",
};

/** 《中国居民膳食指南（2022）》 quantified daily targets, general adults. */
export const GUIDELINE_2022 = {
  title: "中国居民膳食指南（2022）",
  issuer: "中国营养学会",
  publishedAt: "2022-04-26",
  url: null as string | null,
  urlNote: "官方原文链接待人工补充（中国营养学会官网或正版出版渠道）",
  clauses: [
    { key: "grain", label: "谷类", range: "200–300 g", min: 200, max: 300, note: "其中全谷物和杂豆 50–150 g" },
    { key: "tuber", label: "薯类", range: "50–100 g", min: 50, max: 100, note: "" },
    { key: "veg", label: "蔬菜", range: "≥300 g", min: 300, max: 500, note: "深色蔬菜占 1/2 以上" },
    { key: "fruit", label: "水果", range: "200–350 g", min: 200, max: 350, note: "果汁不能代替鲜果" },
    { key: "animal", label: "鱼禽蛋瘦肉", range: "120–200 g", min: 120, max: 200, note: "优先鱼类和禽肉，吃鸡蛋不弃蛋黄" },
    { key: "dairy", label: "奶及奶制品", range: "≥300 g", min: 300, max: 500, note: "以液态奶当量计" },
    { key: "soynut", label: "大豆及坚果", range: "25–35 g", min: 25, max: 35, note: "" },
    { key: "oil", label: "烹调油", range: "25–30 g", min: 25, max: 30, note: "上限控制" },
    { key: "salt", label: "食盐", range: "<5 g", min: 0, max: 5, note: "含酱油等调味品中的钠" },
    { key: "water", label: "饮水", range: "1500–1700 ml", min: 1500, max: 1700, note: "温和气候、轻身体活动水平" },
    { key: "sugar", label: "添加糖", range: "<50 g，最好<25 g", min: 0, max: 25, note: "" },
  ],
  activity: { aerobic: "每周至少 5 天中等强度身体活动，累计 150 分钟以上", steps: "主动身体活动最好每天 6000 步", resistance: "鼓励适当进行高强度有氧运动，加强抗阻运动，每周 2–3 天", sedentary: "减少久坐时间，每小时起来动一动" },
  eight: ["食物多样，合理搭配", "吃动平衡，健康体重", "多吃蔬果、奶类、全谷、大豆", "适量吃鱼、禽、蛋、瘦肉", "少盐少油，控糖限酒", "规律进餐，足量饮水", "会烹会选，会看标签", "公筷分餐，杜绝浪费"],
};

export interface DayBalance {
  intake: number;
  protein: number;
  carb: number;
  fat: number;
  /** MET 估算的训练消耗。仅作信息展示，不参与净热量计算（活动系数已含训练）。 */
  burnExercise: number;
  target: number;
  /** 维持热量 TDEE，供各页面统一计算"相对维持"的差值。 */
  maintenance?: number;
  net: number;
  verdict: "deficit" | "surplus" | "balanced";
  verdictLabel: string;
  advice: string;
  proteinGap: number;
}

export function dayBalance(
  p: Profile,
  meals: { kcal: number; protein: number; carb: number; fat: number }[],
  trainings: { durationMin: number; met: number; weightKg: number }[],
): DayBalance {
  const t = macroTargets(p);
  const intake = Math.round(meals.reduce((s, m) => s + m.kcal, 0));
  const protein = Math.round(meals.reduce((s, m) => s + m.protein, 0));
  const carb = Math.round(meals.reduce((s, m) => s + m.carb, 0));
  const fat = Math.round(meals.reduce((s, m) => s + m.fat, 0));
  const burnExercise = Math.round(
    trainings.reduce((s, x) => s + (x.met * 3.5 * x.weightKg / 200) * x.durationMin, 0),
  );
  // 活动系数（ACTIVITY_FACTOR）的说明本身已包含每周训练次数，TDEE 已经把训练算进去。
  // 再从摄入里扣一次 burnExercise 就是重复计算，因此净热量只对比目标摄入。
  const net = intake - t.kcal;
  const maintenance = tdee(p);
  const abs = Math.abs(net);
  let verdict: DayBalance["verdict"];
  let verdictLabel: string;
  if (abs <= 120) { verdict = "balanced"; verdictLabel = "接近目标"; }
  else if (net < 0) { verdict = "deficit"; verdictLabel = "热量缺口"; }
  else { verdict = "surplus"; verdictLabel = "热量盈余"; }

  const proteinGap = t.proteinG - protein;
  const advice = buildAdvice(p.goal, verdict, net, proteinGap, t);

  return { intake, protein, carb, fat, burnExercise, target: t.kcal, maintenance, net, verdict, verdictLabel, advice, proteinGap };
}

function buildAdvice(goal: Goal, verdict: DayBalance["verdict"], net: number, proteinGap: number, t: MacroTarget): string {
  const parts: string[] = [];
  if (goal === "fatloss") {
    if (verdict === "deficit" && Math.abs(net) > 700) parts.push(`今日缺口约 ${Math.abs(net)} kcal，偏激进。长期过大缺口会增加瘦体重流失风险，建议把缺口收回到 ${Math.round(t.kcal * 0.15)}–${Math.round(t.kcal * 0.25)} kcal 区间。`);
    else if (verdict === "deficit") parts.push(`今日缺口约 ${Math.abs(net)} kcal，处于温和区间，方向正确。`);
    else if (verdict === "surplus") parts.push(`今日盈余约 ${net} kcal，与减脂目标相反。优先检查烹调油、含糖饮料与加餐。`);
    else parts.push("今日接近维持热量，减脂进度会很慢，可小幅下调摄入或增加日常活动。");
  } else if (goal === "muscle") {
    if (verdict === "surplus") parts.push(`今日盈余约 ${net} kcal，符合增肌方向。注意盈余不宜长期超过 +20%，否则脂肪增长占比上升。`);
    else if (verdict === "deficit") parts.push(`今日缺口约 ${Math.abs(net)} kcal，与增肌目标相反，训练表现与恢复可能受影响。`);
    else parts.push("今日接近维持热量，增肌效率偏低，可上调约 10%–15%。");
  } else {
    parts.push(verdict === "balanced" ? "今日接近维持热量，符合身体重塑策略。" : `今日${verdict === "deficit" ? "缺口" : "盈余"}约 ${Math.abs(net)} kcal，重塑期建议维持在 TDEE 附近。`);
  }
  if (proteinGap > 15) parts.push(`蛋白质还差约 ${proteinGap} g 未达目标（${t.proteinG} g）。可用一份乳制品、蛋类或瘦肉补足。`);
  else if (proteinGap <= 0) parts.push("蛋白质已达标，注意平均分配到各餐而非集中一餐。");
  return parts.join(" ");
}

export function fmtDate(d: string | Date): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export function today(): string { return fmtDate(new Date()); }
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}