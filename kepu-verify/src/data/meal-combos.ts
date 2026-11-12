import type { Goal, MealEntry } from "@/src/lib/types";
import { FOOD_BY_ID, scaleFood } from "@/src/data/foods";

export type MealSlot = MealEntry["slot"];
export type ComboRole = "protein" | "staple" | "veg" | "dairy" | "fruit" | "fat";
export type ComboTag = "high-protein" | "low-fat" | "light";

export interface ComboItem {
  foodId: string;
  grams: number;
  role: ComboRole;
}

interface ComboSeed {
  id: string;
  title: string;
  items: ComboItem[];
  slots: MealSlot[];
  tags: ComboTag[];
  note: string;
}

export interface MealCombo extends ComboSeed {
  /** 逐项克数，人话写法，如「2 个鸡蛋（全蛋）（100 g）」。 */
  detail: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  primaryProteinId: string | null;
}

function describeItem(item: ComboItem): string {
  const food = FOOD_BY_ID.get(item.foodId);
  if (!food) return `${item.grams} g`;
  if (food.gramsPerUnit != null && item.grams % food.gramsPerUnit === 0) {
    return `${item.grams / food.gramsPerUnit} ${food.unit}${food.name}（${item.grams} g）`;
  }
  return `${item.grams} g ${food.name}`;
}

function build(seed: ComboSeed): MealCombo {
  let kcal = 0;
  let protein = 0;
  let carb = 0;
  let fat = 0;
  let fiber = 0;
  for (const item of seed.items) {
    const food = FOOD_BY_ID.get(item.foodId);
    if (!food) continue;
    const n = scaleFood(food, item.grams);
    kcal += n.kcal;
    protein += n.protein;
    carb += n.carb;
    fat += n.fat;
    fiber += n.fiber;
  }
  return {
    ...seed,
    detail: seed.items.map(describeItem).join(" + "),
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carb: Math.round(carb),
    fat: Math.round(fat),
    fiber: Math.round(fiber),
    primaryProteinId: seed.items.find((i) => i.role === "protein")?.foodId ?? null,
  };
}

/**
 * 真实可执行的组合，不是单一食物折算。
 * 营养值不手抄：加载时按食物库每 100 g 参考值现算，避免与数据源脱节。
 */
const SEEDS: ComboSeed[] = [
  // 早餐
  {
    id: "b-egg-milk-bread",
    title: "鸡蛋 + 牛奶 + 全麦面包",
    items: [
      { foodId: "egg", grams: 100, role: "protein" },
      { foodId: "milk", grams: 250, role: "dairy" },
      { foodId: "wholewheat-bread", grams: 40, role: "staple" },
    ],
    slots: ["breakfast"],
    tags: ["high-protein"],
    note: "蛋白质约 25 g，适合早餐起步；面包可换成同重量馒头。",
  },
  {
    id: "b-oats-yogurt-banana",
    title: "燕麦 + 无糖酸奶 + 香蕉",
    items: [
      { foodId: "oats", grams: 40, role: "staple" },
      { foodId: "yogurt-plain", grams: 150, role: "dairy" },
      { foodId: "banana", grams: 120, role: "fruit" },
    ],
    slots: ["breakfast"],
    tags: ["low-fat"],
    note: "脂肪低、碳水足，训练日早餐或来不及做饭时省事。",
  },
  {
    id: "b-sweetpotato-egg-milk",
    title: "红薯 + 2 个鸡蛋 + 牛奶",
    items: [
      { foodId: "sweet-potato", grams: 150, role: "staple" },
      { foodId: "egg", grams: 100, role: "protein" },
      { foodId: "milk", grams: 250, role: "dairy" },
    ],
    slots: ["breakfast"],
    tags: ["high-protein"],
    note: "薯类替一部分主食，饱腹感更强。",
  },
  // 午餐 / 晚餐
  {
    id: "l-chicken-rice-broccoli",
    title: "鸡胸肉 + 一小份主食 + 一份蔬菜",
    items: [
      { foodId: "chicken-breast", grams: 150, role: "protein" },
      { foodId: "rice-cooked", grams: 150, role: "staple" },
      { foodId: "broccoli", grams: 150, role: "veg" },
    ],
    slots: ["lunch", "dinner"],
    tags: ["high-protein", "low-fat"],
    note: "最常见的减脂正餐结构：蛋白够、脂肪低、有深色蔬菜。",
  },
  {
    id: "l-beef-rice-spinach",
    title: "瘦牛肉 + 米饭 + 深色蔬菜",
    items: [
      { foodId: "beef-lean", grams: 100, role: "protein" },
      { foodId: "rice-cooked", grams: 150, role: "staple" },
      { foodId: "spinach", grams: 150, role: "veg" },
    ],
    slots: ["lunch", "dinner"],
    tags: ["high-protein", "low-fat"],
    note: "红肉补铁，脂肪比五花肉低很多。",
  },
  {
    id: "l-tofu-yogurt-tomato",
    title: "豆腐 + 无糖酸奶 + 番茄",
    items: [
      { foodId: "tofu-north", grams: 200, role: "protein" },
      { foodId: "yogurt-plain", grams: 150, role: "dairy" },
      { foodId: "tomato", grams: 200, role: "veg" },
    ],
    slots: ["lunch", "dinner"],
    tags: ["high-protein"],
    note: "不吃肉时的植物蛋白组合，豆腐和酸奶都能补蛋白。",
  },
  {
    id: "l-bass-sweetpotato-bokchoy",
    title: "鲈鱼 + 红薯 + 油菜",
    items: [
      { foodId: "bass", grams: 100, role: "protein" },
      { foodId: "sweet-potato", grams: 150, role: "staple" },
      { foodId: "bokchoy", grams: 200, role: "veg" },
    ],
    slots: ["lunch", "dinner"],
    tags: ["high-protein", "low-fat"],
    note: "鱼优先、薯类替主食，符合指南的鱼禽优先建议。",
  },
  {
    id: "l-noodle-beef-bokchoy",
    title: "面条 + 瘦牛肉 + 油菜",
    items: [
      { foodId: "noodle-cooked", grams: 200, role: "staple" },
      { foodId: "beef-lean", grams: 100, role: "protein" },
      { foodId: "bokchoy", grams: 200, role: "veg" },
    ],
    slots: ["lunch", "dinner"],
    tags: ["high-protein"],
    note: "食堂最容易凑齐的一组：一碗面加一份肉和一份菜。",
  },
  {
    id: "l-shrimp-rice-broccoli",
    title: "虾 + 小份米饭 + 西兰花",
    items: [
      { foodId: "shrimp", grams: 150, role: "protein" },
      { foodId: "rice-cooked", grams: 100, role: "staple" },
      { foodId: "broccoli", grams: 200, role: "veg" },
    ],
    slots: ["lunch", "dinner"],
    tags: ["high-protein", "low-fat"],
    note: "虾的脂肪很低，适合当天脂肪预算已经不多的时候。",
  },
  {
    id: "l-tomato-egg-noodle",
    title: "番茄鸡蛋面",
    items: [
      { foodId: "noodle-cooked", grams: 150, role: "staple" },
      { foodId: "egg", grams: 100, role: "protein" },
      { foodId: "tomato", grams: 150, role: "veg" },
    ],
    slots: ["lunch", "dinner"],
    tags: [],
    note: "家常做法，注意少放油；蛋白质比纯素面高。",
  },
  // 加餐
  {
    id: "s-milk-almond",
    title: "牛奶 + 一小把杏仁",
    items: [
      { foodId: "milk", grams: 250, role: "dairy" },
      { foodId: "almond", grams: 15, role: "fat" },
    ],
    slots: ["snack"],
    tags: ["high-protein"],
    note: "坚果只到一小把，热量密度高，别整袋吃。",
  },
  {
    id: "s-greek-yogurt-blueberry",
    title: "希腊酸奶 + 蓝莓",
    items: [
      { foodId: "yogurt-greek", grams: 150, role: "dairy" },
      { foodId: "blueberry", grams: 100, role: "fruit" },
    ],
    slots: ["snack"],
    tags: ["high-protein", "low-fat"],
    note: "蛋白质密度高、添加糖为零，适合下午加餐。",
  },
  {
    id: "s-whey-banana",
    title: "乳清蛋白 + 香蕉",
    items: [
      { foodId: "whey", grams: 30, role: "protein" },
      { foodId: "banana", grams: 120, role: "fruit" },
    ],
    slots: ["snack"],
    tags: ["high-protein", "low-fat"],
    note: "训练前后都能用；不训练也可以换成酸奶加水果。",
  },
  {
    id: "s-yogurt-apple",
    title: "无糖酸奶 + 苹果",
    items: [
      { foodId: "yogurt-plain", grams: 150, role: "dairy" },
      { foodId: "apple", grams: 200, role: "fruit" },
    ],
    slots: ["snack"],
    tags: ["low-fat"],
    note: "热量低、体积大，适合嘴馋但不想超热量的时候。",
  },
  // 低脂高蛋白（收口用）
  {
    id: "t-shrimp-veg",
    title: "虾 + 大份蔬菜",
    items: [
      { foodId: "shrimp", grams: 150, role: "protein" },
      { foodId: "broccoli", grams: 150, role: "veg" },
      { foodId: "lettuce", grams: 100, role: "veg" },
    ],
    slots: ["lunch", "dinner"],
    tags: ["high-protein", "low-fat", "light"],
    note: "热量低、蛋白质密度高，脂肪余量不多时优先选它。",
  },
  {
    id: "t-chicken-veg",
    title: "鸡胸肉 + 大份蔬菜",
    items: [
      { foodId: "chicken-breast", grams: 100, role: "protein" },
      { foodId: "broccoli", grams: 200, role: "veg" },
    ],
    slots: ["lunch", "dinner"],
    tags: ["high-protein", "low-fat", "light"],
    note: "不配主食，用蔬菜填体积；训练日可加半碗饭。",
  },
  {
    id: "t-tofu-tomato",
    title: "南豆腐 + 番茄",
    items: [
      { foodId: "tofu-south", grams: 200, role: "protein" },
      { foodId: "tomato", grams: 200, role: "veg" },
    ],
    slots: ["snack", "lunch", "dinner"],
    tags: ["low-fat", "light"],
    note: "清淡、好消化，热量低但蛋白质一般，适合当加餐。",
  },
];

export const MEAL_COMBOS: MealCombo[] = SEEDS.map(build);

export type NextMealMode = "fill" | "trim" | "maintain";

export interface ComboSuggestion extends MealCombo {
  score: number;
  reason: string;
}

export interface TrimMove {
  id: string;
  title: string;
  detail: string;
  /** 预计能省下的热量；0 表示没有可靠数字，不虚构。 */
  saveKcal: number;
}

export interface NextMealPlan {
  mode: NextMealMode;
  headline: string;
  combos: ComboSuggestion[];
  moves: TrimMove[];
  notes: string[];
}

export interface NextMealInput {
  remainingKcal: number;
  proteinGap: number;
  fatGap: number;
  slot: MealSlot;
  goal: Goal;
  meals: MealEntry[];
}

const TOLERANCE = 120;

function usageOf(meals: MealEntry[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const m of meals) {
    if (!m.foodId) continue;
    usage.set(m.foodId, (usage.get(m.foodId) ?? 0) + 1);
  }
  return usage;
}

function scoreCombo(
  combo: MealCombo,
  remainingKcal: number,
  proteinGap: number,
  slot: MealSlot,
  usage: Map<string, number>,
): ComboSuggestion {
  const proteinScore = proteinGap > 0 ? Math.min(1, combo.protein / proteinGap) : 0.5;
  const kcalScore = 1 - Math.min(1, Math.abs(combo.kcal - remainingKcal) / Math.max(remainingKcal, 200));
  const slotScore = combo.slots[0] === slot ? 1 : 0.75;
  const repeatPenalty = Math.min(0.3, (usage.get(combo.primaryProteinId ?? "") ?? 0) * 0.15);
  const weights = proteinGap > 15 ? { protein: 0.45, kcal: 0.35, slot: 0.2 } : { protein: 0.2, kcal: 0.6, slot: 0.2 };
  const score = weights.protein * proteinScore + weights.kcal * kcalScore + weights.slot * slotScore - repeatPenalty;
  const proteinText = proteinGap > 15
    ? `蛋白质 +${combo.protein} g（还差 ${proteinGap} g）`
    : `蛋白质 +${combo.protein} g`;
  return {
    ...combo,
    score: Math.round(score * 1000) / 1000,
    reason: `热量约 +${combo.kcal} kcal（缺口 ${Math.max(0, remainingKcal)}），${proteinText}，脂肪 +${combo.fat} g。${combo.note}`,
  };
}

function pickDistinct(scored: ComboSuggestion[], limit: number): ComboSuggestion[] {
  const picked: ComboSuggestion[] = [];
  const seen = new Set<string>();
  for (const combo of scored) {
    const key = combo.primaryProteinId ?? combo.id;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(combo);
    if (picked.length === limit) break;
  }
  if (picked.length === 0 && scored.length > 0) picked.push(scored[0]);
  return picked;
}

function sortScored(combos: ComboSuggestion[]): ComboSuggestion[] {
  return [...combos].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function goalNote(goal: Goal): string {
  if (goal === "fatloss") return "减脂期把剩余热量补在蛋白质和蔬菜上，比补糖和油更划算。";
  if (goal === "muscle") return "增肌期不必硬把缺口补到 0，但蛋白质和主食要跟上。";
  return "重塑期保持蛋白质足量即可，热量别大起大落。";
}

function buildTrimMoves(meals: MealEntry[]): TrimMove[] {
  const moves: TrimMove[] = [];
  const sumKcal = (list: MealEntry[]) => Math.round(list.reduce((s, m) => s + m.kcal, 0));

  const drinks = meals.filter((m) => m.foodId === "cola" || m.foodId === "milk-tea");
  if (drinks.length > 0) {
    const kcal = sumKcal(drinks);
    moves.push({
      id: "trim-drink",
      title: "含糖饮料换成白水或无糖茶",
      detail: `今天记了 ${drinks.length} 份含糖饮料，换掉约省 ${kcal} kcal。`,
      saveKcal: kcal,
    });
  }

  const oily = meals.filter((m) => m.foodId === "cooking-oil" || m.foodId === "olive-oil");
  if (oily.length > 0) {
    const kcal = Math.min(90, sumKcal(oily));
    moves.push({
      id: "trim-oil",
      title: "烹调油少 1 勺（约 10 g）",
      detail: "少一勺油约省 90 kcal，炒菜改成蒸、煮、凉拌更容易做到。",
      saveKcal: kcal,
    });
  }

  const snacks = meals.filter((m) =>
    m.foodId === "fried-chicken" || m.foodId === "chips" || m.foodId === "cookie" || m.foodId === "dark-choc");
  if (snacks.length > 0) {
    const kcal = Math.round(sumKcal(snacks) / 2);
    moves.push({
      id: "trim-snack",
      title: "油炸和高脂零食减半",
      detail: `今天这类食物合计约 ${sumKcal(snacks)} kcal，减半约省 ${kcal} kcal。`,
      saveKcal: kcal,
    });
  }

  const staples = meals.filter((m) => m.foodId === "rice-cooked" || m.foodId === "noodle-cooked");
  if (moves.length < 3 && staples.length > 0) {
    const kcal = Math.round(sumKcal(staples) / 3);
    moves.push({
      id: "trim-staple",
      title: "主食减约 1/3",
      detail: `今天主食合计约 ${sumKcal(staples)} kcal，减 1/3 约省 ${kcal} kcal，蛋白质不用动。`,
      saveKcal: kcal,
    });
  }

  if (moves.length === 0) {
    moves.push({
      id: "trim-generic",
      title: "下一餐先减油、减糖，不动蛋白质",
      detail: "优先去掉含糖饮料、油炸和额外烹调油；肉、蛋、奶、豆制品照常吃。",
      saveKcal: 0,
    });
  }
  return moves.slice(0, 3);
}

export function pickNextMealCombos(input: NextMealInput): NextMealPlan {
  const { remainingKcal, proteinGap, fatGap, slot, goal, meals } = input;
  const notes: string[] = [];
  const fatTight = fatGap < 15;
  const usage = usageOf(meals);

  if (fatTight) {
    notes.push(
      fatGap < 0
        ? `今日脂肪已超出目标 ${Math.abs(fatGap)} g，组合按低脂筛，不再额外加坚果或油。`
        : `今日脂肪余量只剩 ${fatGap} g，组合按低脂筛。`,
    );
  }
  notes.push(goalNote(goal));

  if (remainingKcal <= -TOLERANCE) {
    const pool = MEAL_COMBOS.filter(
      (c) => c.slots.includes(slot) && c.kcal <= 300 && c.fat <= 8,
    );
    const combos = pickDistinct(
      sortScored(pool.map((c) => scoreCombo(c, 0, Math.max(proteinGap, 0), slot, usage))),
      2,
    ).map((c) => ({
      ...c,
      reason: `下一餐按这组吃：热量约 ${c.kcal} kcal，蛋白质 ${c.protein} g、脂肪 ${c.fat} g，不再额外加油。`,
    }));
    return {
      mode: "trim",
      headline: `今天已超出目标 ${Math.abs(remainingKcal)} kcal，下一餐先收口，别再补主食和油。`,
      combos,
      moves: buildTrimMoves(meals),
      notes,
    };
  }

  if (remainingKcal < TOLERANCE) {
    const pool = MEAL_COMBOS.filter(
      (c) => c.slots.includes(slot) && c.tags.includes("light") && c.kcal <= Math.max(remainingKcal, 120) + 80,
    );
    const combos = proteinGap > 15
      ? pickDistinct(sortScored(pool.map((c) => scoreCombo(c, remainingKcal, proteinGap, slot, usage))), 1)
      : [];
    return {
      mode: "maintain",
      headline: `今天已在目标 ±${TOLERANCE} kcal 以内，不需要刻意补。`,
      combos,
      moves: [],
      notes: proteinGap > 15
        ? [...notes, `蛋白质还差 ${proteinGap} g：下一餐优先蛋奶、瘦肉或豆制品，不用额外加主食。`]
        : [...notes, "热量和蛋白质都接近目标，下一餐按平常吃即可。"],
    };
  }

  // fill
  const slotPool = MEAL_COMBOS.filter((c) => c.slots.includes(slot));
  let pool = slotPool.filter((c) => c.kcal <= remainingKcal + 150);
  if (fatTight) {
    const cap = fatGap < 0 ? 10 : Math.max(8, Math.min(fatGap, 15));
    const lowFat = pool.filter((c) => c.fat <= cap);
    if (lowFat.length > 0) pool = lowFat;
  }
  if (pool.length === 0) {
    pool = slotPool.filter((c) => c.kcal <= remainingKcal + 300);
    notes.push("今天剩余热量不多，下面的组合略多于缺口：可以只吃一半，或把主食留到下一餐。");
  }
  if (pool.length === 0) pool = slotPool;
  if (fatTight) {
    const lowFat = pool.filter((c) => c.fat <= 8);
    if (lowFat.length > 0) pool = lowFat;
  }
  if (proteinGap > 30) {
    // 蛋白缺口大时，先剔除只有 5 g 蛋白的水果加餐这类组合。
    const proteinRich = pool.filter((c) => c.protein >= 12);
    if (proteinRich.length > 0) pool = proteinRich;
  }

  const combos = pickDistinct(
    sortScored(pool.map((c) => scoreCombo(c, remainingKcal, proteinGap, slot, usage))),
    3,
  );
  if (combos.some((c) => c.kcal > remainingKcal + 120)) {
    notes.push("标着「略多」的组合不用硬吃完，按饥饿感留一部分即可。");
  }

  return {
    mode: "fill",
    headline: `距今日目标还差 ${remainingKcal} kcal` +
      (proteinGap > 15 ? `，蛋白质差 ${proteinGap} g。` : "，蛋白质已接近目标。"),
    combos,
    moves: [],
    notes,
  };
}
