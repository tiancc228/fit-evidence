import type { DayBalance, MacroTarget } from "@/src/lib/calc";
import { GUIDELINE_2022 } from "@/src/lib/calc";
import type { MealEntry, Profile, SleepEntry } from "@/src/lib/types";
import { FOOD_BY_ID } from "@/src/data/foods";
import rawSources from "@/src/data/real-sources.json";

export type AdviceTone = "ok" | "warn" | "bad" | "info";

export interface AdviceSource {
  kind: "evidence" | "guideline" | "general";
  label: string;
  title?: string;
  doi?: string | null;
  pmid?: string | null;
  url?: string | null;
}

export interface AdviceItem {
  id: string;
  category: string;
  text: string;
  tone: AdviceTone;
  sources: AdviceSource[];
}

interface RawEvidence {
  doi: string | null;
  pmid: string | null;
  title: string;
  authors: string[];
  journal: string | null;
  year: number | null;
  url: string | null;
}

const EVIDENCE = (rawSources as unknown as { evidence: RawEvidence[] }).evidence;

/** Pull a real paper from the captured source library by exact DOI — never invented. */
function cite(doi: string): AdviceSource | null {
  const e = EVIDENCE.find((x) => x.doi === doi);
  if (!e) return null;
  return {
    kind: "evidence",
    label: `${e.authors?.[0] ?? "佚名"} 等 · ${e.journal ?? "期刊未标注"} · ${e.year ?? "年份未标注"}`,
    title: e.title,
    doi: e.doi,
    pmid: e.pmid,
    url: e.url,
  };
}

function guideline(key: string): AdviceSource {
  const c = GUIDELINE_2022.clauses.find((x) => x.key === key);
  return {
    kind: "guideline",
    label: `《${GUIDELINE_2022.title}》· ${c ? `${c.label} ${c.range}` : "相关条款"}`,
    url: GUIDELINE_2022.url,
  };
}

const GENERAL_SLEEP: AdviceSource = {
  kind: "general",
  label: "通用恢复建议 · 素材不足：本证据库未收录睡眠时长与增肌的直接文献，不据此伪造引用",
  url: null,
};

function compact(sources: (AdviceSource | null)[]): AdviceSource[] {
  return sources.filter((s): s is AdviceSource => s != null);
}

export interface AdviceArgs {
  profile: Profile;
  meals: MealEntry[];
  balance: DayBalance;
  target: MacroTarget;
  weekTrainingDays: number;
  sleep: SleepEntry[];
}

export function buildOverviewAdvice({ profile, meals, balance, target, weekTrainingDays, sleep }: AdviceArgs): AdviceItem[] {
  const items: AdviceItem[] = [];

  // 1) 能量方向 —— 直接采用 calc.ts 中 buildAdvice 的输出（dayBalance.advice）。
  const energyTone: AdviceTone = balance.verdict === "balanced" ? "ok" : Math.abs(balance.net) > 700 ? "bad" : "warn";
  items.push({
    id: "energy",
    category: "能量平衡",
    text: balance.advice,
    tone: energyTone,
    sources: compact([
      cite("10.1186/s12970-017-0174-y"),
      cite("10.1123/ijsnem.21.2.97"),
      cite("10.1136/bjsports-2017-097608"),
    ]),
  });

  // 2) 蛋白质分配
  if (balance.proteinGap > 15) {
    items.push({
      id: "protein",
      category: "蛋白质",
      text: `蛋白质距目标还差约 ${balance.proteinGap} g（目标 ${target.proteinG} g）。补一份乳制品、蛋类或瘦肉，并尽量把蛋白质平均分到 3–4 餐，每餐约 25–40 g，比集中一餐更利于肌肉合成。`,
      tone: "warn",
      sources: compact([cite("10.1136/bjsports-2017-097608"), cite("10.1186/s12970-017-0177-8")]),
    });
  } else {
    items.push({
      id: "protein",
      category: "蛋白质",
      text: `蛋白质已接近或达到目标（${target.proteinG} g）。保持每餐均匀分配，训练后的一餐记得带上优质蛋白。`,
      tone: "ok",
      sources: compact([cite("10.1186/s12970-017-0177-8")]),
    });
  }

  // 3) 膳食结构 —— 仅在有可识别食物记录时给出量化提示。
  const grams = { veg: 0, fruit: 0, dairy: 0, grain: 0, sugary: 0 };
  let identifiable = 0;
  for (const m of meals) {
    if (!m.foodId) continue;
    const f = FOOD_BY_ID.get(m.foodId);
    if (!f) continue;
    identifiable++;
    if (f.category === "蔬菜") grams.veg += m.grams;
    else if (f.category === "水果") grams.fruit += m.grams;
    else if (f.category === "奶类") grams.dairy += m.grams;
    else if (f.category === "谷薯") grams.grain += m.grams;
    if (m.foodId === "cola" || m.foodId === "milk-tea") grams.sugary += m.grams;
  }
  if (identifiable > 0) {
    if (grams.veg < 300) {
      items.push({
        id: "veg",
        category: "蔬菜",
        text: `今天蔬菜约 ${Math.round(grams.veg)} g，低于指南推荐的每天 ≥300 g（深色蔬菜占一半以上）。加一份西兰花、菠菜或油菜就能补上。`,
        tone: "warn",
        sources: [guideline("veg")],
      });
    }
    if (grams.dairy < 300) {
      items.push({
        id: "dairy",
        category: "奶类",
        text: `今天奶类约 ${Math.round(grams.dairy)} g，指南建议每天 ≥300 g 液态奶当量。一杯牛奶或无糖酸奶既补钙也补蛋白。`,
        tone: "info",
        sources: [guideline("dairy")],
      });
    }
    if (grams.fruit < 200) {
      items.push({
        id: "fruit",
        category: "水果",
        text: `今天水果约 ${Math.round(grams.fruit)} g，指南建议 200–350 g，果汁不能代替鲜果。加一个苹果或橙子。`,
        tone: "info",
        sources: [guideline("fruit")],
      });
    }
    if (grams.sugary > 0) {
      items.push({
        id: "sugar",
        category: "控糖",
        text: `今天记录了约 ${Math.round(grams.sugary)} g 含糖饮料。指南建议添加糖每天 <50 g、最好 <25 g，减脂期尤其要留意液体热量。`,
        tone: "warn",
        sources: [guideline("sugar")],
      });
    }
  } else if (meals.length === 0) {
    items.push({
      id: "diet-empty",
      category: "饮食记录",
      text: "今天还没有饮食记录。先记下三餐，才能判断能量缺口/盈余和三大营养素是否达标。",
      tone: "info",
      sources: [guideline("grain")],
    });
  }

  // 4) 训练频率
  const plan = profile.trainingDaysPerWeek;
  if (weekTrainingDays === 0) {
    items.push({
      id: "training",
      category: "训练",
      text: "本周还没有抗阻训练。指南建议每周 2–3 天抗阻运动；新手先从每周 2–3 次全身训练起步，把动作做标准比加重量更重要。",
      tone: "warn",
      sources: compact([{ kind: "guideline", label: `《${GUIDELINE_2022.title}》· 抗阻运动每周 2–3 天`, url: GUIDELINE_2022.url }, cite("10.1007/s40279-016-0543-8")]),
    });
  } else if (weekTrainingDays < Math.min(plan, 2)) {
    items.push({
      id: "training",
      category: "训练",
      text: `本周已练 ${weekTrainingDays} 天，低于你的计划（${plan} 天）。尽量补到每周至少 2 次抗阻训练，同一肌群每周刺激约 2 次更利于增肌。`,
      tone: "warn",
      sources: compact([{ kind: "guideline", label: `《${GUIDELINE_2022.title}》· 抗阻运动每周 2–3 天`, url: GUIDELINE_2022.url }, cite("10.1007/s40279-016-0543-8")]),
    });
  } else {
    items.push({
      id: "training",
      category: "训练",
      text: `本周已练 ${weekTrainingDays} 天，节奏不错。保持渐进超负荷（逐步加重量或次数），并给肌群留出恢复时间。`,
      tone: "ok",
      sources: compact([cite("10.1007/s40279-016-0543-8")]),
    });
  }

  // 5) 睡眠 —— 证据库无睡眠专项文献，如实标注素材不足，给通用建议。
  const recent = [...sleep].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  if (recent.length === 0) {
    items.push({
      id: "sleep",
      category: "睡眠",
      text: "还没有睡眠记录。睡眠是恢复与增肌的关键一环，先记录几晚的时长和质量，便于发现恢复短板。",
      tone: "info",
      sources: [GENERAL_SLEEP],
    });
  } else {
    const avg = recent.reduce((s, x) => s + x.hours, 0) / recent.length;
    if (avg < 7) {
      items.push({
        id: "sleep",
        category: "睡眠",
        text: `近 ${recent.length} 晚平均睡眠 ${avg.toFixed(1)} 小时，偏少。建议争取 7–9 小时并规律作息，睡眠不足会拖累恢复与训练表现。`,
        tone: "warn",
        sources: [GENERAL_SLEEP],
      });
    } else {
      items.push({
        id: "sleep",
        category: "睡眠",
        text: `近 ${recent.length} 晚平均睡眠 ${avg.toFixed(1)} 小时，充足。继续保持规律作息，让训练成果得以巩固。`,
        tone: "ok",
        sources: [GENERAL_SLEEP],
      });
    }
  }

  return items;
}
