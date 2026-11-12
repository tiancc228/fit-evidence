import { useSyncExternalStore } from "react";
import { today, uid } from "@/src/lib/calc";

/** 计划本机存储的唯一入口。当前不写入 AppState，后续迁移到后端只需替换 load/persist。 */
export const PLAN_SCHEMA_VERSION = 1;
export const PLAN_STORE_KEY = "kepu-verify:plan-store:v1";
export const PLAN_DRAFT_KEY = "kepu-verify:plan-draft:v1";

export interface CustomItem {
  uid: string;
  exerciseId: string;
  sets: number;
  repsLow: number;
  repsHigh: number;
  /** null = 未设定，界面显示「按 RIR 自选」，不自动填公斤数。 */
  weightKg: number | null;
  rpe: number | null;
  rir: number | null;
  restSec: number;
}

export interface CustomDay {
  uid: string;
  name: string;
  exercises: CustomItem[];
}

export interface CustomPlan {
  name: string;
  days: CustomDay[];
  updatedAt: string;
}

export interface SavedTemplate {
  uid: string;
  name: string;
  day: CustomDay;
  createdAt: string;
}

export interface SessionSet {
  reps: string;
  weightKg: string;
  rpe: string;
  done: boolean;
}

export interface SessionExercise {
  uid: string;
  exerciseId: string;
  name: string;
  part: string;
  isBodyweight: boolean;
  restSec: number;
  /** 预填来源说明；空表示没有历史记录，用户的空白就是空白。 */
  prefilledFrom: string | null;
  sets: SessionSet[];
}

export interface SessionDraft {
  date: string;
  dayKey: string;
  versionId: "full" | "lite" | "safe";
  title: string;
  exercises: SessionExercise[];
  updatedAt: string;
}

export interface PlanStoreState {
  schemaVersion: number;
  source: "system" | "custom";
  plan: CustomPlan;
  templates: SavedTemplate[];
  draft: SessionDraft | null;
}

const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

const optFloat = (v: unknown, lo: number, hi: number): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return Math.round(n * 10) / 10;
};

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

function sanitizeItem(raw: unknown): CustomItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const exerciseId = str(r.exerciseId);
  if (!exerciseId) return null;
  return {
    uid: str(r.uid) || uid(),
    exerciseId,
    sets: clampInt(r.sets, 1, 20, 3),
    repsLow: clampInt(r.repsLow, 1, 50, 8),
    repsHigh: clampInt(r.repsHigh, 1, 50, 12),
    weightKg: optFloat(r.weightKg, 0, 500),
    rpe: optFloat(r.rpe, 1, 10),
    rir: optFloat(r.rir, 0, 5),
    restSec: clampInt(r.restSec, 0, 600, 90),
  };
}

function sanitizeDay(raw: unknown): CustomDay | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const items = Array.isArray(r.exercises) ? r.exercises.map(sanitizeItem).filter((x): x is CustomItem => x != null) : [];
  return {
    uid: str(r.uid) || uid(),
    name: str(r.name, "训练日"),
    exercises: items,
  };
}

function sanitizePlan(raw: unknown): CustomPlan {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const days = Array.isArray(r.days) ? r.days.map(sanitizeDay).filter((x): x is CustomDay => x != null) : [];
  return {
    name: str(r.name, "我的自定义计划"),
    days,
    updatedAt: str(r.updatedAt, today()),
  };
}

function sanitizeTemplate(raw: unknown): SavedTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const day = sanitizeDay(r.day);
  if (!day) return null;
  return {
    uid: str(r.uid) || uid(),
    name: str(r.name, day.name),
    day,
    createdAt: str(r.createdAt, today()),
  };
}

function sanitizeDraft(raw: unknown): SessionDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (str(r.date) !== today()) return null;
  if (!Array.isArray(r.exercises)) return null;
  const exercises: SessionExercise[] = [];
  for (const x of r.exercises) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    if (!str(e.exerciseId) || !Array.isArray(e.sets)) continue;
    const sets: SessionSet[] = [];
    for (const s of e.sets) {
      if (!s || typeof s !== "object") continue;
      const v = s as Record<string, unknown>;
      sets.push({
        reps: str(v.reps),
        weightKg: str(v.weightKg),
        rpe: str(v.rpe),
        done: v.done === true,
      });
    }
    if (sets.length === 0) continue;
    exercises.push({
      uid: str(e.uid) || uid(),
      exerciseId: str(e.exerciseId),
      name: str(e.name, "动作"),
      part: str(e.part),
      isBodyweight: e.isBodyweight === true,
      restSec: clampInt(e.restSec, 0, 600, 90),
      prefilledFrom: typeof e.prefilledFrom === "string" ? e.prefilledFrom : null,
      sets,
    });
  }
  if (exercises.length === 0) return null;
  return {
    date: str(r.date),
    dayKey: str(r.dayKey, "session"),
    versionId: r.versionId === "lite" || r.versionId === "safe" ? r.versionId : "full",
    title: str(r.title, "训练"),
    exercises,
    updatedAt: str(r.updatedAt, new Date().toISOString()),
  };
}

const EMPTY: PlanStoreState = {
  schemaVersion: PLAN_SCHEMA_VERSION,
  source: "system",
  plan: { name: "我的自定义计划", days: [], updatedAt: today() },
  templates: [],
  draft: null,
};

function readJson(key: string): unknown {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function load(): PlanStoreState {
  const planRaw = readJson(PLAN_STORE_KEY);
  const draftRaw = readJson(PLAN_DRAFT_KEY);
  const p = (planRaw && typeof planRaw === "object" ? planRaw : {}) as Record<string, unknown>;
  // schemaVersion 不匹配时安全回退到空计划，而不是猜测字段含义。
  if (p.schemaVersion != null && p.schemaVersion !== PLAN_SCHEMA_VERSION) {
    return { ...EMPTY, draft: null };
  }
  const templates = Array.isArray(p.templates)
    ? p.templates.map(sanitizeTemplate).filter((x): x is SavedTemplate => x != null)
    : [];
  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    source: p.source === "custom" ? "custom" : "system",
    plan: sanitizePlan(p.plan),
    templates,
    draft: sanitizeDraft(draftRaw),
  };
}

let state: PlanStoreState = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      PLAN_STORE_KEY,
      JSON.stringify({
        schemaVersion: state.schemaVersion,
        source: state.source,
        plan: state.plan,
        templates: state.templates,
      }),
    );
    if (state.draft) localStorage.setItem(PLAN_DRAFT_KEY, JSON.stringify(state.draft));
    else localStorage.removeItem(PLAN_DRAFT_KEY);
  } catch {
    /* 隐私模式 / 配额不足：内存状态仍可用 */
  }
}

function commit(next: PlanStoreState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function getSnapshot() { return state; }

/** 导出接口：后续迁移进 AppState 或后端时读取完整快照。 */
export function getPlanSnapshot(): PlanStoreState {
  return state;
}

const cloneItem = (item: CustomItem): CustomItem => ({ ...item, uid: uid() });
const cloneDay = (day: CustomDay, name = day.name): CustomDay => ({
  uid: uid(),
  name,
  exercises: day.exercises.map(cloneItem),
});

function updatePlan(fn: (plan: CustomPlan) => CustomPlan, patch: Partial<PlanStoreState> = {}) {
  commit({ ...state, ...patch, plan: { ...fn(state.plan), updatedAt: today() } });
}

export function usePlanStore() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const actions = {
    setSource(source: "system" | "custom") {
      commit({ ...state, source });
    },

    setPlanName(name: string) {
      updatePlan((p) => ({ ...p, name }));
    },

    addDay(name?: string) {
      const day: CustomDay = {
        uid: uid(),
        name: name?.trim() || `训练日 ${state.plan.days.length + 1}`,
        exercises: [],
      };
      updatePlan((p) => ({ ...p, days: [...p.days, day] }));
      return day.uid;
    },

    renameDay(dayUid: string, name: string) {
      updatePlan((p) => ({
        ...p,
        days: p.days.map((d) => (d.uid === dayUid ? { ...d, name } : d)),
      }));
    },

    removeDay(dayUid: string) {
      updatePlan((p) => ({ ...p, days: p.days.filter((d) => d.uid !== dayUid) }));
    },

    duplicateDay(dayUid: string) {
      const src = state.plan.days.find((d) => d.uid === dayUid);
      if (!src) return null;
      const copy = cloneDay(src, `${src.name} 副本`);
      updatePlan((p) => ({ ...p, days: [...p.days, copy] }));
      return copy.uid;
    },

    addExercise(dayUid: string, item: Omit<CustomItem, "uid">) {
      updatePlan((p) => ({
        ...p,
        days: p.days.map((d) => (d.uid === dayUid ? { ...d, exercises: [...d.exercises, { ...item, uid: uid() }] } : d)),
      }));
    },

    updateExercise(dayUid: string, itemUid: string, patch: Partial<Omit<CustomItem, "uid" | "exerciseId">>) {
      updatePlan((p) => ({
        ...p,
        days: p.days.map((d) => (d.uid === dayUid
          ? { ...d, exercises: d.exercises.map((it) => (it.uid === itemUid ? { ...it, ...patch } : it)) }
          : d)),
      }));
    },

    replaceExercise(dayUid: string, itemUid: string, exerciseId: string) {
      updatePlan((p) => ({
        ...p,
        days: p.days.map((d) => (d.uid === dayUid
          ? { ...d, exercises: d.exercises.map((it) => (it.uid === itemUid ? { ...it, exerciseId } : it)) }
          : d)),
      }));
    },

    removeExercise(dayUid: string, itemUid: string) {
      updatePlan((p) => ({
        ...p,
        days: p.days.map((d) => (d.uid === dayUid
          ? { ...d, exercises: d.exercises.filter((it) => it.uid !== itemUid) }
          : d)),
      }));
    },

    moveExercise(dayUid: string, from: number, to: number) {
      updatePlan((p) => ({
        ...p,
        days: p.days.map((d) => {
          if (d.uid !== dayUid) return d;
          if (to < 0 || to >= d.exercises.length || from === to) return d;
          const next = [...d.exercises];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return { ...d, exercises: next };
        }),
      }));
    },

    saveDayAsTemplate(dayUid: string, name: string) {
      const day = state.plan.days.find((d) => d.uid === dayUid);
      if (!day) return;
      const tpl: SavedTemplate = {
        uid: uid(),
        name: name.trim() || day.name,
        day: cloneDay(day, name.trim() || day.name),
        createdAt: today(),
      };
      commit({ ...state, templates: [...state.templates, tpl] });
    },

    appendTemplateDay(template: SavedTemplate) {
      const copy = cloneDay(template.day, template.name);
      updatePlan((p) => ({ ...p, days: [...p.days, copy] }));
      return copy.uid;
    },

    removeTemplate(templateUid: string) {
      commit({ ...state, templates: state.templates.filter((t) => t.uid !== templateUid) });
    },

    replacePlan(plan: CustomPlan, source: "system" | "custom" = "custom") {
      const cleanDays = plan.days.map((d) => cloneDay(d));
      commit({
        ...state,
        source,
        plan: { name: plan.name, days: cleanDays, updatedAt: today() },
        draft: null,
      });
    },

    setDraft(draft: SessionDraft | null) {
      commit({ ...state, draft });
    },

    clearDraft() {
      commit({ ...state, draft: null });
    },
  };

  return { state: s, actions };
}
