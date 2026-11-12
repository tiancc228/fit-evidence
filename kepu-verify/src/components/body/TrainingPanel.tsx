import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Dumbbell, Plus, Trash2, Timer, Layers, Weight, Flame, Info, CalendarDays } from "lucide-react";

import { useApp } from "@/src/lib/store";
import type { Profile, TrainingEntry } from "@/src/lib/types";
import { EXERCISES, EXERCISE_BY_ID, EXERCISE_PARTS } from "@/src/data/exercises";
import { today, addDays, fmtDate } from "@/src/lib/calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { EmptyState, InfoNote, SectionHeading, StatTile, SCROLL_Y } from "@/src/components/body/shared";

const partConfig = { sets: { label: "组数", color: "var(--chart-1)" } } satisfies ChartConfig;

function startOfWeek(): { weekStart: string; weekEnd: string } {
  const t = today();
  const d = new Date(t + "T00:00:00");
  const offset = (d.getDay() + 6) % 7;
  const weekStart = addDays(t, -offset);
  return { weekStart, weekEnd: addDays(weekStart, 6) };
}

function Rating({ label, value, onChange, hint }: { label: string; value: number; onChange: (n: number) => void; hint: string }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "h-8 flex-1 rounded-md border text-xs font-medium transition-colors",
              value === n ? "border-chart-1 bg-chart-1/15 text-chart-1" : "bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function TrainingPanel() {
  const { state, addTraining, removeEntry } = useApp();
  const profile = state.profile as Profile | null;
  const training = state.training as TrainingEntry[];
  const { weekStart, weekEnd } = startOfWeek();

  const [date, setDate] = React.useState(today());
  const [exerciseId, setExerciseId] = React.useState("");
  const [durationMin, setDurationMin] = React.useState("45");
  const [setCount, setSetCount] = React.useState("3");
  const [reps, setReps] = React.useState("10");
  const [weightKg, setWeightKg] = React.useState("20");
  const [feel, setFeel] = React.useState(3);
  const [pump, setPump] = React.useState(3);
  const [soreness, setSoreness] = React.useState(2);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const selected = exerciseId ? EXERCISE_BY_ID.get(exerciseId) : undefined;

  const week = React.useMemo(
    () => training.filter((t) => t.date >= weekStart && t.date <= weekEnd),
    [training, weekStart, weekEnd],
  );
  const weekDays = new Set(week.map((t) => t.date)).size;
  const weekDuration = week.reduce((s, t) => s + t.durationMin, 0);
  const weekSets = week.reduce((s, t) => s + t.sets.length, 0);
  const weekVolume = week.reduce((s, t) => s + t.sets.reduce((a, x) => a + x.reps * x.weightKg, 0), 0);
  const weekBurn = profile
    ? Math.round(week.reduce((s, t) => s + ((EXERCISE_BY_ID.get(t.exerciseId)?.met ?? 3.5) * 3.5 * profile.weightKg / 200) * t.durationMin, 0))
    : 0;

  const partData = EXERCISE_PARTS.map((part) => ({
    part,
    sets: week.filter((t) => t.part === part).reduce((s, t) => s + t.sets.length, 0),
  })).filter((d) => d.sets > 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ex = EXERCISE_BY_ID.get(exerciseId);
    if (!ex) {
      setError("请先选择一个动作。");
      return;
    }
    const dur = Number(durationMin);
    const sc = Number(setCount);
    const rp = Number(reps);
    const wt = Number(weightKg);
    if (!Number.isFinite(dur) || dur < 5 || dur > 300) return setError("时长需在 5–300 分钟之间。");
    if (!Number.isInteger(sc) || sc < 1 || sc > 20) return setError("组数需在 1–20 之间。");
    if (!Number.isInteger(rp) || rp < 1 || rp > 50) return setError("次数需在 1–50 之间。");
    if (!Number.isFinite(wt) || wt < 0 || wt > 500) return setError("重量需在 0–500 kg 之间（自重动作填 0）。");
    setError(null);
    const entry: Omit<TrainingEntry, "id"> = {
      date: date || today(),
      exerciseId: ex.id,
      name: ex.name,
      part: ex.part,
      sets: Array.from({ length: sc }, () => ({ reps: rp, weightKg: wt, rpe: null })),
      durationMin: dur,
      feel: feel as TrainingEntry["feel"],
      pump: pump as TrainingEntry["pump"],
      soreness: soreness as TrainingEntry["soreness"],
      photoId: null,
      note: note.trim(),
    };
    addTraining(entry);
    toast.success(`已记录 ${ex.name} ${sc} 组`);
    setNote("");
  }

  return (
    <Card>
      <CardHeader>
        <SectionHeading
          icon={Dumbbell}
          title="训练记录"
          desc="记下时长、动作、组数、重量和肌肉感受。新手优先把动作做标准，再慢慢加重量。"
        />
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={submit} className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="tr-date">日期</Label>
              <Input id="tr-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="tr-exercise">动作</Label>
              <Select value={exerciseId} onValueChange={setExerciseId}>
                <SelectTrigger id="tr-exercise" className="w-full">
                  <SelectValue placeholder="选择训练动作" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {EXERCISE_PARTS.map((part) => (
                    <SelectGroup key={part}>
                      <SelectLabel>{part}</SelectLabel>
                      {EXERCISES.filter((e) => e.part === part).map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {selected ? (
                <p className="text-[11px] text-muted-foreground">
                  部位：{selected.part} · 器械：{selected.equipment} · 难度：{selected.level === "novice" ? "新手" : selected.level === "intermediate" ? "进阶" : "高级"} · 强度参考 MET {selected.met}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tr-duration">时长（分钟）</Label>
              <Input id="tr-duration" type="number" inputMode="numeric" min={5} max={300} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tr-sets">组数</Label>
              <Input id="tr-sets" type="number" inputMode="numeric" min={1} max={20} value={setCount} onChange={(e) => setSetCount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tr-reps">每组次数</Label>
              <Input id="tr-reps" type="number" inputMode="numeric" min={1} max={50} value={reps} onChange={(e) => setReps(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tr-weight">重量（kg，自重填 0）</Label>
              <Input id="tr-weight" type="number" inputMode="decimal" step={0.5} min={0} max={500} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Rating label="整体感受" value={feel} onChange={setFeel} hint="1 很吃力 · 5 状态很好" />
            <Rating label="泵感 / 肌肉充血" value={pump} onChange={setPump} hint="1 没感觉 · 5 很胀" />
            <Rating label="当前酸痛" value={soreness} onChange={setSoreness} hint="1 不酸 · 5 很酸" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tr-note">备注</Label>
            <Input id="tr-note" placeholder="例如：深蹲膝盖无不适，下次加 2.5kg" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit">
            <Plus className="size-4" />
            记录这次训练
          </Button>
        </form>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 text-muted-foreground" />
            本周训练量
            <span className="text-xs font-normal text-muted-foreground">（{fmtDate(weekStart)} ~ {fmtDate(weekEnd)}）</span>
          </div>
          {week.length === 0 ? (
            <EmptyState icon={Dumbbell} title="本周还没有训练记录" desc="在上方记录第一次训练，就能看到本周容量和各部位分布。新手每周 2–3 次抗阻训练是个好起点。" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile icon={CalendarDays} label="训练天数" value={weekDays} unit="天" accent="bg-chart-1" />
                <StatTile icon={Timer} label="总时长" value={weekDuration} unit="分钟" accent="bg-chart-5" />
                <StatTile icon={Layers} label="总组数" value={weekSets} unit="组" accent="bg-chart-2" />
                <StatTile icon={Weight} label="总容量" value={Math.round(weekVolume)} unit="kg" accent="bg-chart-3" hint="组数×次数×重量，渐进超负荷看它" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-sm font-medium">各部位组数分布</p>
                  <ChartContainer config={partConfig} className="w-full aspect-auto" style={{ height: Math.max(160, partData.length * 34) }}>
                    <BarChart data={partData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="part" width={56} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="sets" fill="var(--color-sets)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
                <div className="flex flex-col justify-center gap-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Flame className="size-4 text-chart-1" />
                    <span className="text-muted-foreground">本周训练估算消耗</span>
                  </div>
                  <p className="text-3xl font-semibold tabular-nums">{profile ? weekBurn : "—"} <span className="text-base font-normal text-muted-foreground">kcal</span></p>
                  <InfoNote icon={Info}>
                    按 MET 公式估算（MET×3.5×体重÷200×分钟），仅供参考。{!profile ? "填写资料后才能计算消耗。" : "动作库缺少 MET 时按轻度 3.5 估算。"}
                  </InfoNote>
                </div>
              </div>
            </>
          )}
        </div>

        {training.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">最近训练</p>
            <div className={cn("max-h-64 space-y-2 pr-1", SCROLL_Y)}>
              {[...training].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map((t) => {
                const vol = t.sets.reduce((s, x) => s + x.reps * x.weightKg, 0);
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t.name}</span>
                        <Badge variant="secondary" className="text-[11px]">{t.part}</Badge>
                        <span className="text-xs tabular-nums text-muted-foreground">{fmtDate(t.date)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.sets.length} 组 × {t.sets[0]?.reps ?? 0} 次 × {t.sets[0]?.weightKg ?? 0} kg · {t.durationMin} 分钟 · 容量 {Math.round(vol)} kg · 感受 {t.feel}/5
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`删除 ${t.name} 记录`}
                      onClick={() => {
                        removeEntry("training", t.id);
                        toast.success("已删除该训练记录");
                      }}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
