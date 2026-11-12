import type { Goal, Profile } from "@/src/lib/types";
import { GUIDELINE_2022, macroTargets, type MacroTarget } from "@/src/lib/calc";
import {
  ANTI_INFLAMMATORY_PICKS,
  FOOD_BY_ID,
  STAPLE_PICKS,
  VEGETABLE_PICKS,
  scaleFood,
} from "@/src/data/foods";

export type Level = "novice" | "intermediate";
export type SplitKind = "auto" | "full" | "upperlower" | "ppl" | "three";
export type MealPattern = "balanced" | "lunchHeavy" | "periworkout";

export interface PlanConfig {
  goal: Goal;
  trainingDays: number;
  level: Level;
  split: SplitKind;
  stapleId: string;
  proteinId: string;
  vegTotalG: number;
  darkRatioPct: number;
  mealPattern: MealPattern;
}

export interface PlanFood {
  foodId: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

export type MealSlot = "breakfast" | "lunch" | "dinner";

export interface PlanMeal {
  slot: MealSlot;
  label: string;
  foods: PlanFood[];
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

export interface MacroSum {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

export interface StapleAlt {
  foodId: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  fat: number;
  why: string;
  isChosen: boolean;
}

export interface VegItem {
  foodId: string;
  name: string;
  grams: number;
  why: string;
}

export interface VegPlan {
  totalG: number;
  darkG: number;
  lightG: number;
  dark: VegItem[];
  light: VegItem[];
  darkOptions: VegItem[];
  lightOptions: VegItem[];
  clause: (typeof GUIDELINE_2022.clauses)[number];
}

export interface AntiItem {
  foodId: string;
  name: string;
  grams: number;
  kcal: number;
  why: string;
  swap: string;
}

export interface DayDiet {
  target: MacroTarget;
  weightKg: number;
  carbMultiple: number;
  stapleCarbBudgetG: number;
  stapleAlternatives: StapleAlt[];
  vegetables: VegPlan;
  antiInflammatory: AntiItem[];
  meals: PlanMeal[];
  totals: MacroSum;
  fruitG: number;
  dairyG: number;
  dairyName: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round5 = (v: number) => Math.round(v / 5) * 5;

function pf(foodId: string, grams: number): PlanFood {
  const f = FOOD_BY_ID.get(foodId)!;
  const s = scaleFood(f, Math.max(0, grams));
  return { foodId, name: f.name, grams: Math.max(0, Math.round(grams)), kcal: s.kcal, protein: s.protein, carb: s.carb, fat: s.fat };
}

function sum(items: { kcal: number; protein: number; carb: number; fat: number }[]): MacroSum {
  return {
    kcal: items.reduce((s, x) => s + x.kcal, 0),
    protein: +items.reduce((s, x) => s + x.protein, 0).toFixed(1),
    carb: +items.reduce((s, x) => s + x.carb, 0).toFixed(1),
    fat: +items.reduce((s, x) => s + x.fat, 0).toFixed(1),
  };
}

function meal(slot: MealSlot, label: string, foods: PlanFood[]): PlanMeal {
  const s = sum(foods);
  return { slot, label, foods: foods.filter((f) => f.grams > 0), ...s };
}

/** Closest integer grams whose scaled kcal hits target (used for coarse balancing). */
function solveGramsForKcal(foodId: string, targetKcal: number, lo: number, hi: number): number {
  const f = FOOD_BY_ID.get(foodId)!;
  let best = lo;
  let bestErr = Infinity;
  for (let g = lo; g <= hi; g++) {
    const err = Math.abs(scaleFood(f, g).kcal - targetKcal);
    if (err < bestErr) {
      bestErr = err;
      best = g;
    }
    if (err === 0) return g;
  }
  return best;
}

export const PROTEIN_OPTIONS = [
  { id: "chicken-breast", label: "鸡胸肉" },
  { id: "beef-lean", label: "瘦牛肉" },
  { id: "bass", label: "鲈鱼" },
  { id: "shrimp", label: "虾" },
  { id: "tofu-north", label: "北豆腐" },
];

export const MEAL_PATTERN_LABEL: Record<MealPattern, string> = {
  balanced: "均衡分配",
  lunchHeavy: "午餐为主",
  periworkout: "早餐碳水前置（训练前）",
};

const ENERGY_RATIOS: Record<MealPattern, [number, number, number]> = {
  balanced: [0.32, 0.38, 0.3],
  lunchHeavy: [0.3, 0.45, 0.25],
  periworkout: [0.38, 0.34, 0.28],
};

export function defaultConfig(p: Profile): PlanConfig {
  return {
    goal: p.goal,
    trainingDays: clamp(p.trainingDaysPerWeek || 3, 1, 6),
    level: "novice",
    split: "auto",
    stapleId: "rice-cooked",
    proteinId: "chicken-breast",
    vegTotalG: 400,
    darkRatioPct: 60,
    mealPattern: "balanced",
  };
}

/**
 * Builds a one-day diet whose three meals sum EXACTLY to the daily kcal target.
 * Every gram/kcal is derived from foods.ts via scaleFood; macro targets come from
 * calc.ts macroTargets. Lean protein sources are chosen under a fat-loss goal so
 * the bundled fat does not overshoot the energy budget.
 */
export function buildDiet(profile: Profile, config: PlanConfig): DayDiet {
  const t = macroTargets(profile);
  const weight = profile.weightKg;
  const lean = config.goal === "fatloss";

  const secondaryId = lean ? "egg-white" : "egg";
  const secondaryG = lean ? 150 : 100;
  const dairyId = lean ? "milk-skim" : "milk";
  const dairyG = 300;
  const nutsG = lean ? 5 : config.goal === "muscle" ? 15 : 12;
  const fruitG = 200;

  // --- vegetables (guideline: >=300 g, dark >= 1/2) ---
  const vegTotalG = clamp(Math.round(config.vegTotalG), 300, 500);
  const darkG = Math.round((vegTotalG * clamp(config.darkRatioPct, 50, 100)) / 100);
  const lightG = vegTotalG - darkG;
  const darkBroc = Math.round(darkG * 0.4);
  const darkSpin = Math.round(darkG * 0.35);
  const darkCarrot = darkG - darkBroc - darkSpin;
  const lightCuc = Math.round(lightG * 0.6);
  const lightMush = lightG - lightCuc;
  const vegSpec: { id: string; grams: number }[] = [
    { id: "broccoli", grams: darkBroc },
    { id: "spinach", grams: darkSpin },
    { id: "carrot", grams: darkCarrot },
    { id: "cucumber", grams: lightCuc },
    { id: "mushroom", grams: lightMush },
  ];
  const vegFoods = vegSpec.map((v) => pf(v.id, v.grams));

  const fruit = pf("apple", fruitG);
  const dairy = pf(dairyId, dairyG);
  const secondary = pf(secondaryId, secondaryG);
  const nuts = pf("walnut", nutsG);

  const fixed = [...vegFoods, fruit, dairy, secondary, nuts];
  const fixedSum = sum(fixed);

  // --- self-consistent solve: staples carry protein too, so size meat against them ---
  const primary = FOOD_BY_ID.get(config.proteinId) ?? FOOD_BY_ID.get("chicken-breast")!;
  const staple = FOOD_BY_ID.get(config.stapleId) ?? FOOD_BY_ID.get("rice-cooked")!;
  const rice = FOOD_BY_ID.get("rice-cooked")!;
  const whey = FOOD_BY_ID.get("whey")!;
  const PRIMARY_CAP = 700;

  let primaryGrams = clamp(round5((t.proteinG - fixedSum.protein) / (primary.protein / 100)), 0, PRIMARY_CAP);
  let featuredGrams = 0;
  let riceGrams = 0;
  let carbBudget = 0;
  for (let iter = 0; iter < 8; iter++) {
    const nonStapleCarb = fixedSum.carb + pf(primary.id, primaryGrams).carb;
    carbBudget = Math.max(0, Math.round(t.carbG - nonStapleCarb));
    featuredGrams = clamp(Math.round((carbBudget * 0.5) / (staple.carb / 100)), 0, 1200);
    riceGrams = clamp(Math.round((carbBudget * 0.5) / (rice.carb / 100)), 0, 1200);
    const stapleProtein = pf(staple.id, featuredGrams).protein + pf("rice-cooked", riceGrams).protein;
    const next = clamp(round5((t.proteinG - fixedSum.protein - stapleProtein) / (primary.protein / 100)), 0, 2000);
    if (next === primaryGrams) break;
    primaryGrams = next;
  }
  // cap meat volume, top up remaining protein with whey
  let wheyGrams = 0;
  if (primaryGrams > PRIMARY_CAP) {
    primaryGrams = PRIMARY_CAP;
    const stapleProtein = pf(staple.id, featuredGrams).protein + pf("rice-cooked", riceGrams).protein;
    const gap = t.proteinG - fixedSum.protein - stapleProtein - pf(primary.id, primaryGrams).protein;
    wheyGrams = clamp(round5(gap / (whey.protein / 100)), 0, 120);
    const nonStapleCarb = fixedSum.carb + pf(primary.id, primaryGrams).carb + pf("whey", wheyGrams).carb;
    carbBudget = Math.max(0, Math.round(t.carbG - nonStapleCarb));
    featuredGrams = clamp(Math.round((carbBudget * 0.5) / (staple.carb / 100)), 0, 1200);
    riceGrams = clamp(Math.round((carbBudget * 0.5) / (rice.carb / 100)), 0, 1200);
  }
  const primaryItem = pf(primary.id, primaryGrams);
  const wheyItem = pf("whey", wheyGrams);

  // --- oil to reach the fat target (accounts for every bundled fat source) ---
  const oil = FOOD_BY_ID.get("cooking-oil")!;
  const fatSoFar =
    fixedSum.fat + primaryItem.fat + wheyItem.fat + pf(staple.id, featuredGrams).fat + pf("rice-cooked", riceGrams).fat;
  const oilGrams = clamp(Math.round((t.fatG - fatSoFar) / (oil.fat / 100)), 0, 45);

  // --- distribute into three meals; pattern sets each meal's energy share ---
  const energyRatio = ENERGY_RATIOS[config.mealPattern];
  const featuredB = Math.round(featuredGrams * 0.5);
  const featuredL = featuredGrams - featuredB;
  const proteinL = Math.round(primaryGrams * 0.6);
  const proteinD = primaryGrams - proteinL;
  const oilL = Math.round(oilGrams * 0.5);
  const oilD = oilGrams - oilL;
  const wheyB = Math.round(wheyItem.grams * 0.5);
  const wheyD = wheyItem.grams - wheyB;

  // split each vegetable roughly half lunch / half dinner
  const vegLunch: PlanFood[] = [];
  const vegDinner: PlanFood[] = [];
  for (const v of vegSpec) {
    const half = Math.round(v.grams * 0.5);
    vegLunch.push(pf(v.id, half));
    vegDinner.push(pf(v.id, v.grams - half));
  }

  const bBase = [pf(staple.id, featuredB), pf(secondaryId, secondaryG), fruit, nuts, pf("whey", wheyB)];
  const lBase = [pf(staple.id, featuredL), pf(primary.id, proteinL), ...vegLunch, pf("cooking-oil", oilL)];
  const dBase = [pf(primary.id, proteinD), ...vegDinner, pf("cooking-oil", oilD), pf("whey", wheyD)];
  const dairyKcal = scaleFood(FOOD_BY_ID.get(dairyId)!, dairyG).kcal;
  const bNon = sum(bBase).kcal + dairyKcal;
  const lNon = sum(lBase).kcal;
  const dNon = sum(dBase).kcal;
  const riceNeeded = Math.max(0, t.kcal - (bNon + lNon + dNon));
  // balancing rice shares follow the meal energy pattern, clamped >= 0 then renormalised
  let rk = [
    Math.max(0, Math.round(energyRatio[0] * t.kcal) - bNon),
    Math.max(0, Math.round(energyRatio[1] * t.kcal) - lNon),
    Math.max(0, Math.round(energyRatio[2] * t.kcal) - dNon),
  ];
  const rkSum = rk[0] + rk[1] + rk[2];
  if (rkSum > 0) rk = rk.map((x) => Math.round((x * riceNeeded) / rkSum));
  let riceB = solveGramsForKcal("rice-cooked", rk[0], 0, 900);
  let riceL = solveGramsForKcal("rice-cooked", rk[1], 0, 900);
  let riceD = solveGramsForKcal("rice-cooked", rk[2], 0, 900);

  let milkGrams = dairyG;
  const buildMeals = (milkG: number): PlanMeal[] => [
    meal("breakfast", "早餐", [...bBase, pf(dairyId, milkG), pf("rice-cooked", riceB)]),
    meal("lunch", "午餐", [...lBase, pf("rice-cooked", riceL)]),
    meal("dinner", "晚餐", [...dBase, pf("rice-cooked", riceD)]),
  ];

  // balance kcal exactly: coarse via dinner rice, fine via milk (slope < 1 hits every integer)
  let meals = buildMeals(milkGrams);
  let residual = t.kcal - sum(meals).kcal;
  if (residual !== 0) {
    riceD = solveGramsForKcal("rice-cooked", pf("rice-cooked", riceD).kcal + residual, 0, 950);
    meals = buildMeals(milkGrams);
    residual = t.kcal - sum(meals).kcal;
  }
  if (residual !== 0) {
    const baseMilkKcal = scaleFood(FOOD_BY_ID.get(dairyId)!, dairyG).kcal;
    for (let g = dairyG - 80; g <= dairyG + 80; g++) {
      if (scaleFood(FOOD_BY_ID.get(dairyId)!, g).kcal - baseMilkKcal === residual) {
        milkGrams = g;
        break;
      }
    }
    meals = buildMeals(milkGrams);
  }

  const totals = sum(meals);

  // --- staple alternatives: grams of each staple that supply the staple carb budget ---
  const altIds = [config.stapleId, "rice-cooked", "oats", "sweet-potato"].filter(
    (id, i, arr) => arr.indexOf(id) === i,
  );
  const chosenFirst = [config.stapleId, ...altIds.filter((id) => id !== config.stapleId)].slice(0, 3);
  const stapleAlternatives: StapleAlt[] = chosenFirst.map((id) => {
    const f = FOOD_BY_ID.get(id)!;
    const grams = Math.round(carbBudget / (f.carb / 100));
    const s = scaleFood(f, grams);
    const pick = STAPLE_PICKS.find((p) => p.id === id);
    return {
      foodId: id,
      name: f.name,
      grams,
      kcal: s.kcal,
      protein: s.protein,
      fat: s.fat,
      why: pick?.why ?? "可替换主食",
      isChosen: id === config.stapleId,
    };
  });

  // --- vegetable display plan ---
  const vegClause = GUIDELINE_2022.clauses.find((c) => c.key === "veg")!;
  const darkChosen: VegItem[] = [
    { foodId: "broccoli", grams: darkBroc },
    { foodId: "spinach", grams: darkSpin },
    { foodId: "carrot", grams: darkCarrot },
  ].map((v) => ({
    foodId: v.foodId,
    name: FOOD_BY_ID.get(v.foodId)!.name,
    grams: v.grams,
    why: VEGETABLE_PICKS.dark.find((p) => p.id === v.foodId)?.why ?? "",
  }));
  const lightChosen: VegItem[] = [
    { foodId: "cucumber", grams: lightCuc },
    { foodId: "mushroom", grams: lightMush },
  ].map((v) => ({
    foodId: v.foodId,
    name: FOOD_BY_ID.get(v.foodId)!.name,
    grams: v.grams,
    why: VEGETABLE_PICKS.light.find((p) => p.id === v.foodId)?.why ?? "",
  }));
  const vegetables: VegPlan = {
    totalG: vegTotalG,
    darkG,
    lightG,
    dark: darkChosen,
    light: lightChosen,
    darkOptions: VEGETABLE_PICKS.dark.map((p) => ({
      foodId: p.id,
      name: FOOD_BY_ID.get(p.id)!.name,
      grams: 0,
      why: p.why,
    })),
    lightOptions: VEGETABLE_PICKS.light.map((p) => ({
      foodId: p.id,
      name: FOOD_BY_ID.get(p.id)!.name,
      grams: 0,
      why: p.why,
    })),
    clause: vegClause,
  };

  // --- anti-inflammatory pattern (swaps, not extra calories) ---
  const antiPortions: Record<string, { grams: number; swap: string }> = {
    salmon: { grams: 120, swap: "替换等蛋白量的部分鸡胸/瘦肉" },
    blueberry: { grams: 100, swap: "替换部分水果（如苹果）" },
    broccoli: { grams: darkBroc, swap: "已计入深色蔬菜" },
    spinach: { grams: darkSpin, swap: "已计入深色蔬菜" },
    walnut: { grams: nutsG, swap: "已计入坚果份量" },
    "olive-oil": { grams: 10, swap: "替换等量烹调油" },
    tomato: { grams: 100, swap: "可加入浅色蔬菜份额" },
    soybean: { grams: 25, swap: "替换部分肉类蛋白（约 25 g 干豆）" },
  };
  const antiInflammatory: AntiItem[] = ANTI_INFLAMMATORY_PICKS.map((p) => {
    const f = FOOD_BY_ID.get(p.id)!;
    const portion = antiPortions[p.id] ?? { grams: 100, swap: "适量加入" };
    return {
      foodId: p.id,
      name: f.name,
      grams: portion.grams,
      kcal: scaleFood(f, portion.grams).kcal,
      why: p.why,
      swap: portion.swap,
    };
  });

  return {
    target: t,
    weightKg: weight,
    carbMultiple: t.carbPerKg,
    stapleCarbBudgetG: carbBudget,
    stapleAlternatives,
    vegetables,
    antiInflammatory,
    meals,
    totals,
    fruitG,
    dairyG: milkGrams,
    dairyName: FOOD_BY_ID.get(dairyId)!.name,
  };
}