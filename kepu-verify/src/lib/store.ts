import { useSyncExternalStore } from "react";
import type {
  AppState, BodyEntry, Claim, MealEntry, PhotoRecord, Profile,
  SleepEntry, TrainingEntry, Verdict,
} from "@/src/lib/types";
import { addDays, today, uid } from "@/src/lib/calc";
import { FOOD_BY_ID, scaleFood } from "@/src/data/foods";

const KEY = "kepu-verify:state:v1";

const EMPTY: AppState = {
  profile: null,
  body: [],
  meals: [],
  training: [],
  sleep: [],
  photos: [],
  claimOverrides: {},
  aiKeyConfigured: false,
  savedViews: [],
};

/** Demo records so the app opens populated. Clearly labelled in the UI; wipeable. */
function seed(): AppState {
  const profile: Profile = {
    name: "示例用户",
    sex: "male",
    age: 26,
    heightCm: 175,
    weightKg: 78.4,
    bodyFatPct: 22,
    activity: "moderate",
    goal: "fatloss",
    trainingDaysPerWeek: 4,
    createdAt: addDays(today(), -28),
  };

  const body: BodyEntry[] = [];
  for (let i = 13; i >= 0; i--) {
    const t = (13 - i) / 13;
    body.push({
      id: uid(),
      date: addDays(today(), -i),
      weightKg: +(80.2 - 1.8 * t + (i % 3 === 0 ? 0.15 : -0.1)).toFixed(1),
      bodyFatPct: +(23.4 - 1.4 * t).toFixed(1),
      waistCm: +(92 - 3.5 * t).toFixed(1),
      chestCm: 101,
      armCm: +(33.5 + 0.3 * t).toFixed(1),
      thighCm: 57,
      photoId: null,
      note: i === 0 ? "晨起空腹称重" : "",
    });
  }

  const plan: { slot: MealEntry["slot"]; foodId: string; grams: number }[] = [
    { slot: "breakfast", foodId: "oats", grams: 60 },
    { slot: "breakfast", foodId: "egg", grams: 100 },
    { slot: "breakfast", foodId: "milk", grams: 250 },
    { slot: "breakfast", foodId: "blueberry", grams: 100 },
    { slot: "lunch", foodId: "rice-cooked", grams: 250 },
    { slot: "lunch", foodId: "chicken-breast", grams: 150 },
    { slot: "lunch", foodId: "broccoli", grams: 200 },
    { slot: "lunch", foodId: "olive-oil", grams: 10 },
    { slot: "dinner", foodId: "sweet-potato", grams: 200 },
    { slot: "dinner", foodId: "salmon", grams: 150 },
    { slot: "dinner", foodId: "spinach", grams: 200 },
    { slot: "dinner", foodId: "olive-oil", grams: 5 },
    { slot: "snack", foodId: "yogurt-greek", grams: 150 },
    { slot: "snack", foodId: "whey", grams: 30 },
  ];

  const meals: MealEntry[] = plan.flatMap(({ slot, foodId, grams }) => {
    const f = FOOD_BY_ID.get(foodId);
    if (!f) return [];
    const n = scaleFood(f, grams);
    return [{
      id: uid(), date: today(), slot, foodId, label: f.name, grams,
      kcal: n.kcal, protein: n.protein, carb: n.carb, fat: n.fat,
      photoId: null, source: "database" as const, note: "",
    }];
  });

  const training: TrainingEntry[] = [
    {
      id: uid(), date: today(), exerciseId: "barbell-bench-press", name: "杠铃卧推", part: "胸",
      sets: [{ reps: 8, weightKg: 60, rpe: 7 }, { reps: 8, weightKg: 60, rpe: 8 }, { reps: 7, weightKg: 60, rpe: 9 }],
      durationMin: 18, feel: 4, pump: 4, soreness: 2, photoId: null, note: "最后一组略吃力",
    },
    {
      id: uid(), date: today(), exerciseId: "lat-pulldown", name: "高位下拉", part: "背",
      sets: [{ reps: 10, weightKg: 50, rpe: 7 }, { reps: 10, weightKg: 50, rpe: 8 }, { reps: 9, weightKg: 50, rpe: 8 }],
      durationMin: 15, feel: 3, pump: 3, soreness: 2, photoId: null, note: "背阔肌感受一般",
    },
    {
      id: uid(), date: today(), exerciseId: "goblet-squat", name: "高脚杯深蹲", part: "腿",
      sets: [{ reps: 12, weightKg: 24, rpe: 6 }, { reps: 12, weightKg: 24, rpe: 7 }, { reps: 12, weightKg: 24, rpe: 7 }],
      durationMin: 15, feel: 4, pump: 4, soreness: 3, photoId: null, note: "",
    },
    {
      id: uid(), date: addDays(today(), -2), exerciseId: "romanian-deadlift", name: "罗马尼亚硬拉", part: "腿",
      sets: [{ reps: 10, weightKg: 50, rpe: 7 }, { reps: 10, weightKg: 50, rpe: 8 }, { reps: 9, weightKg: 50, rpe: 8 }],
      durationMin: 20, feel: 4, pump: 3, soreness: 4, photoId: null, note: "腘绳肌酸胀明显",
    },
  ];

  const sleep: SleepEntry[] = [];
  for (let i = 6; i >= 0; i--) {
    sleep.push({
      id: uid(), date: addDays(today(), -i),
      hours: [7.5, 6.5, 8, 7, 6, 7.5, 7.5][6 - i],
      quality: ([4, 3, 5, 4, 2, 4, 4][6 - i]) as SleepEntry["quality"],
    });
  }

  return { ...EMPTY, profile, body, meals, training, sleep };
}

function load(): AppState {
  if (typeof localStorage === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...EMPTY, ...parsed };
  } catch {
    return seed();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded (large photos) — keep in-memory state usable */
  }
}

function commit(next: AppState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function getSnapshot() { return state; }

export function isDemoData(): boolean {
  return state.profile?.name === "示例用户";
}

export function useApp() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    state: s,

    setProfile(p: Profile) {
      commit({ ...state, profile: p });
    },

    addBody(e: Omit<BodyEntry, "id">) {
      commit({ ...state, body: [...state.body, { ...e, id: uid() }] });
    },

    addMeal(e: Omit<MealEntry, "id">) {
      commit({ ...state, meals: [...state.meals, { ...e, id: uid() }] });
    },

    addTraining(e: Omit<TrainingEntry, "id">) {
      commit({ ...state, training: [...state.training, { ...e, id: uid() }] });
    },

    addSleep(e: Omit<SleepEntry, "id">) {
      commit({ ...state, sleep: [...state.sleep, { ...e, id: uid() }] });
    },

    addPhoto(p: Omit<PhotoRecord, "id">): string {
      const id = uid();
      commit({ ...state, photos: [...state.photos, { ...p, id }] });
      return id;
    },

    removeEntry(kind: "body" | "meals" | "training" | "sleep" | "photos", id: string) {
      commit({ ...state, [kind]: state[kind].filter((x) => x.id !== id) } as AppState);
    },

    setClaimOverride(
      id: string,
      patch: { verdict?: Verdict; advice?: string; review?: Claim["review"] },
    ) {
      const prev = state.claimOverrides[id] ?? {};
      commit({
        ...state,
        claimOverrides: { ...state.claimOverrides, [id]: { ...prev, ...patch } },
      });
    },

    addSavedView(v: AppState["savedViews"][number]) {
      commit({ ...state, savedViews: [...state.savedViews, v] });
    },

    removeSavedView(id: string) {
      commit({ ...state, savedViews: state.savedViews.filter((v) => v.id !== id) });
    },

    setAiKeyConfigured(v: boolean) {
      commit({ ...state, aiKeyConfigured: v });
    },

    /** Wipe demo records and start from the user's own data. */
    clearAll() {
      commit({ ...EMPTY });
    },

    restoreDemo() {
      commit(seed());
    },
  };
}

/** Merge a base claim with the reviewer's local overrides. */
export function applyOverride(claim: Claim, overrides: AppState["claimOverrides"]): Claim {
  const o = overrides[claim.id];
  if (!o) return claim;
  return {
    ...claim,
    review: o.review ?? claim.review,
    layer3: { ...claim.layer3, verdict: o.verdict ?? claim.layer3.verdict },
    layer4: { ...claim.layer4, advice: o.advice ?? claim.layer4.advice },
  };
}