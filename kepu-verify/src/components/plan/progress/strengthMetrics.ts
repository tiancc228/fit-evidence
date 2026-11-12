import type { TrainingEntry } from "@/src/lib/types";

/** 估算 1RM（Epley）。只有 1–30 次、负重量 > 0 才给数；其余情况返回 null，不硬编一个数字。 */
export function epley1RM(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !(reps >= 1) || reps > 30) return null;
  return Math.round(weightKg * (1 + reps / 30) * 2) / 2;
}

export interface StrengthSet {
  date: string;
  weightKg: number;
  reps: number;
  rpe: number | null;
  e1rm: number | null;
}

export interface SessionSummary {
  date: string;
  sets: number;
  reps: number;
  volume: number;
  summary: string;
}

export interface BestSet {
  date: string;
  weightKg: number;
  reps: number;
  e1rm: number;
}

export interface PRRecord extends BestSet {
  previous: number | null;
}

export interface WeekVolume {
  start: string;
  end: string;
  sets: number;
  reps: number;
  volume: number;
  bodyweightSets: number;
  prevStart: string;
  prevEnd: string;
  prevSets: number;
  prevVolume: number;
  deltaPct: number | null;
}

export interface StrengthSummary {
  hasAny: boolean;
  sets: StrengthSet[];
  last: (SessionSummary & { daysAgo: number }) | null;
  today: SessionSummary | null;
  best: BestSet | null;
  bestBodyweightReps: { date: string; reps: number } | null;
  e1rm: BestSet | null;
  trend: { points: { date: string; weightKg: number }[]; enough: boolean; start: string; end: string };
  sameWeight: { weightKg: number; rows: { date: string; reps: number }[]; delta: number | null } | null;
  week: WeekVolume;
  prs: PRRecord[];
}

const DAY_MS = 86400000;

export function parseDate(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00`).getTime();
}

export function shiftDate(dateISO: string, days: number): string {
  const d = new Date(parseDate(dateISO) + days * DAY_MS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function weekStartOf(dateISO: string): string {
  const d = new Date(parseDate(dateISO));
  return shiftDate(dateISO, -((d.getDay() + 6) % 7));
}

export function setsFor(entries: TrainingEntry[]): StrengthSet[] {
  const out: StrengthSet[] = [];
  for (const entry of entries) {
    for (const s of entry.sets) {
      const reps = Number(s.reps);
      const weightKg = Number(s.weightKg);
      if (!Number.isFinite(reps) || reps <= 0) continue;
      if (!Number.isFinite(weightKg) || weightKg < 0) continue;
      out.push({
        date: entry.date,
        weightKg,
        reps,
        rpe: s.rpe,
        e1rm: epley1RM(weightKg, reps),
      });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}

function summarize(date: string, sets: StrengthSet[]): SessionSummary {
  return {
    date,
    sets: sets.length,
    reps: sets.reduce((s, x) => s + x.reps, 0),
    volume: sets.reduce((s, x) => s + x.weightKg * x.reps, 0),
    summary: sets.map((s) => (s.weightKg > 0 ? `${s.weightKg} kg × ${s.reps}` : `自重 × ${s.reps}`)).join(" · "),
  };
}

/** 按日期聚合并取每一天的汇总，日期升序。 */
function byDate(sets: StrengthSet[]): Map<string, StrengthSet[]> {
  const m = new Map<string, StrengthSet[]>();
  for (const s of sets) {
    const list = m.get(s.date);
    if (list) list.push(s);
    else m.set(s.date, [s]);
  }
  return m;
}

function bestOfSets(sets: StrengthSet[]): BestSet | null {
  let best: BestSet | null = null;
  for (const s of sets) {
    if (s.e1rm == null) continue;
    if (!best || s.e1rm > best.e1rm || (s.e1rm === best.e1rm && s.weightKg > best.weightKg)) {
      best = { date: s.date, weightKg: s.weightKg, reps: s.reps, e1rm: s.e1rm };
    }
  }
  return best;
}

export function lastSessionBefore(entries: TrainingEntry[], todayISO: string): SessionSummary | null {
  const dates = [...new Set(entries.map((e) => e.date))].filter((d) => d < todayISO).sort();
  const last = dates[dates.length - 1];
  if (!last) return null;
  return summarize(last, setsFor(entries).filter((s) => s.date === last));
}

export function todaySession(entries: TrainingEntry[], todayISO: string): SessionSummary | null {
  const sets = setsFor(entries).filter((s) => s.date === todayISO);
  return sets.length > 0 ? summarize(todayISO, sets) : null;
}

export function bestWorkingSet(entries: TrainingEntry[]): BestSet | null {
  return bestOfSets(setsFor(entries));
}

export function bestBodyweightReps(entries: TrainingEntry[]): { date: string; reps: number } | null {
  let best: { date: string; reps: number } | null = null;
  for (const s of setsFor(entries)) {
    if (s.weightKg !== 0) continue;
    if (!best || s.reps > best.reps) best = { date: s.date, reps: s.reps };
  }
  return best;
}

/** 30 天重量趋势：每天取最大重量；少于 2 个日期只列点，不画线。 */
export function trend30(entries: TrainingEntry[], todayISO: string): StrengthSummary["trend"] {
  const end = todayISO;
  const start = shiftDate(todayISO, -29);
  const points: { date: string; weightKg: number }[] = [];
  for (const [date, sets] of byDate(setsFor(entries))) {
    if (date < start || date > end) continue;
    const max = Math.max(...sets.map((s) => s.weightKg));
    if (max > 0) points.push({ date, weightKg: max });
  }
  points.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { points, enough: points.length >= 2, start, end };
}

/** 同重量次数变化：以「上次训练」最高组重量为基准，看同一重量下的次数变化。 */
export function sameWeightReps(entries: TrainingEntry[], todayISO: string): StrengthSummary["sameWeight"] {
  const sets = setsFor(entries);
  const last = lastSessionBefore(entries, todayISO);
  const lastDate = last?.date;
  const lastSets = lastDate ? sets.filter((s) => s.date === lastDate) : [];
  const weights = lastSets.map((s) => s.weightKg).filter((w) => w > 0);
  let weight = weights.length ? Math.max(...weights) : 0;
  if (!(weight > 0)) {
    const allWeights = sets.map((s) => s.weightKg).filter((w) => w > 0);
    weight = allWeights.length ? Math.max(...allWeights) : 0;
  }
  if (!(weight > 0)) return null;

  const rows: { date: string; reps: number }[] = [];
  for (const [date, list] of byDate(sets)) {
    const matching = list.filter((s) => Math.abs(s.weightKg - weight) < 0.01);
    if (matching.length === 0) continue;
    rows.push({ date, reps: Math.max(...matching.map((s) => s.reps)) });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  const delta = rows.length >= 2 ? rows[rows.length - 1].reps - rows[0].reps : null;
  return { weightKg: weight, rows, delta };
}

export function weekVolume(entries: TrainingEntry[], todayISO: string): WeekVolume {
  const start = weekStartOf(todayISO);
  const end = shiftDate(start, 6);
  const prevStart = shiftDate(start, -7);
  const prevEnd = shiftDate(start, -1);
  const sets = setsFor(entries);

  const pick = (from: string, to: string) => sets.filter((s) => s.date >= from && s.date <= to);
  const cur = pick(start, end);
  const prev = pick(prevStart, prevEnd);

  const volume = cur.reduce((s, x) => s + x.weightKg * x.reps, 0);
  const prevVolume = prev.reduce((s, x) => s + x.weightKg * x.reps, 0);
  return {
    start, end,
    sets: cur.length,
    reps: cur.reduce((s, x) => s + x.reps, 0),
    volume,
    bodyweightSets: cur.filter((s) => s.weightKg === 0).length,
    prevStart, prevEnd,
    prevSets: prev.length,
    prevVolume,
    deltaPct: prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null,
  };
}

/** PR：按日期滚动取 e1RM 新高；同一天只算一次。 */
export function prHistory(entries: TrainingEntry[]): PRRecord[] {
  const daily: { date: string; best: BestSet }[] = [];
  for (const [date, sets] of byDate(setsFor(entries))) {
    const best = bestOfSets(sets);
    if (best) daily.push({ date, best });
  }
  daily.sort((a, b) => (a.date < b.date ? -1 : 1));
  const prs: PRRecord[] = [];
  let previous: number | null = null;
  for (const { date, best } of daily) {
    if (previous == null || best.e1rm > previous) {
      prs.push({ ...best, date, previous });
      previous = best.e1rm;
    }
  }
  return prs;
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.max(0, Math.round((parseDate(toISO) - parseDate(fromISO)) / DAY_MS));
}

export function strengthSummary(entries: TrainingEntry[], todayISO: string): StrengthSummary {
  const sets = setsFor(entries);
  const last = lastSessionBefore(entries, todayISO);
  const today = todaySession(entries, todayISO);
  const best = bestOfSets(sets);
  const prs = prHistory(entries);
  return {
    hasAny: entries.length > 0 && sets.length > 0,
    sets,
    last: last ? { ...last, daysAgo: daysBetween(last.date, todayISO) } : null,
    today,
    best,
    bestBodyweightReps: bestBodyweightReps(entries),
    e1rm: best,
    trend: trend30(entries, todayISO),
    sameWeight: sameWeightReps(entries, todayISO),
    week: weekVolume(entries, todayISO),
    prs,
  };
}
