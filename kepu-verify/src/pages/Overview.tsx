import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Flame,
  Activity,
  Dumbbell,
  Moon,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
  TriangleAlert,
  CircleCheck,
  Info,
  ArrowRight,
  Plus,
  Trash2,
  BedDouble,
  Gauge,
  Beef,
  Wheat,
  Droplet,
  Lightbulb,
  ExternalLink,
  CalendarDays,
} from "lucide-react";

import { useApp } from "@/src/lib/store";
import type { MealEntry, Profile, SleepEntry, TrainingEntry } from "@/src/lib/types";
import {
  dayBalance,
  macroTargets,
  bmr,
  tdee,
  today,
  fmtDate,
  addDays,
  GOAL_LABEL,
} from "@/src/lib/calc";
import { EXERCISE_BY_ID } from "@/src/data/exercises";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { TrainingPanel } from "@/src/components/body/TrainingPanel";
import { buildOverviewAdvice, type AdviceItem, type AdviceSource, type AdviceTone } from "@/src/components/body/advice";
import {
  EmptyState,
  InfoNote,
  LayerTag,
  MeterRow,
  SectionHeading,
  StatTile,
  SCROLL_Y,
} from "@/src/components/body/shared";

const sleepConfig = { hours: { label: "睡眠（小时）", color: "var(--chart-3)" } } satisfies ChartConfig;

const ADVICE_TONE: Record<AdviceTone, { icon: typeof Info; cls: string }> = {
  ok: { icon: CircleCheck, cls: "text-ok" },
  warn: { icon: TriangleAlert, cls: "text-warn" },
  bad: { icon: TriangleAlert, cls: "text-bad" },
  info: { icon: Info, cls: "text-info" },
};

function weekRange() {
  const t = today();
  const d = new Date(t + "T00:00:00");
  const weekStart = addDays(t, -((d.getDay() + 6) % 7));
  return { weekStart, weekEnd: addDays(weekStart, 6) };
}

export default function Overview() {
  const { state } = useApp();
  const profile = state.profile as Profile | null;
  const meals = state.meals as MealEntry[];
  const training = state.training as TrainingEntry[];
  const sleep = state.sleep as SleepEntry[];
  const day = today();

  const todayMeals = React.useMemo(() => meals.filter((m) => m.date === day), [meals, day]);
  const todayTraining = React.useMemo(() => training.filter((t) => t.date === day), [training, day]);
  const { weekStart, weekEnd } = weekRange();
  const weekTrainingDays = React.useMemo(
    () => new Set(training.filter((t) => t.date >= weekStart && t.date <= weekEnd).map((t) => t.date)).size,
    [training, weekStart, weekEnd],
  );

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
        <PageHeader />
        <EmptyState
          icon={LayoutDashboard}
          title="先建立你的身体档案"
          desc="总览需要你的性别、年龄、身高、体重和目标来计算消耗与营养目标。请到「身体状态评估」页填写资料，再回来查看每日能量平衡与建议。"
        />
      </div>
    );
  }

  const target = macroTargets(profile);
  const resting = bmr(profile.sex, profile.weightKg, profile.heightCm, profile.age);
  const total = tdee(profile);
  const activityBurn = Math.max(0, total - resting);
  const balance = dayBalance(
    profile,
    todayMeals.map((m) => ({ kcal: m.kcal, protein: m.protein, carb: m.carb, fat: m.fat })),
    todayTraining.map((t) => ({ durationMin: t.durationMin, met: EXERCISE_BY_ID.get(t.exerciseId)?.met ?? 3.5, weightKg: profile.weightKg })),
  );
  const advice = buildOverviewAdvice({ profile, meals: todayMeals, balance, target, weekTrainingDays, sleep });

  const aligned = balance.verdict === "balanced";
  const tone: AdviceTone = aligned ? "ok" : Math.abs(balance.net) > 700 ? "bad" : "warn";
  const heroGradient =
    tone === "ok" ? "from-ok/20 via-ok/10 to-info/15 border-ok/40"
    : tone === "bad" ? "from-bad/20 via-warn/10 to-advice/15 border-bad/40"
    : "from-warn/20 via-voice/10 to-advice/15 border-warn/40";
  const VerdictIcon = balance.net > 0 ? TrendingUp : balance.net < 0 ? TrendingDown : Minus;
  const headline = aligned
    ? `今天摄入接近你的${GOAL_LABEL[profile.goal]}目标`
    : balance.net > 0
      ? `今天摄入高于${GOAL_LABEL[profile.goal]}目标`
      : `今天摄入低于${GOAL_LABEL[profile.goal]}目标`;
  const adjust = aligned
    ? "保持当前的摄入与活动节奏即可。"
    : balance.net > 0
      ? `想回到目标，今天再减少约 ${balance.net} kcal（少吃一点，或增加等量活动）。`
      : `想回到目标，今天再增加约 ${Math.abs(balance.net)} kcal（优先补蛋白质和主食）。`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader right={<Badge variant="outline" className="gap-1"><Target className="size-3" />{GOAL_LABEL[profile.goal]}目标</Badge>} />

      {/* 结论卡片：直接回答用户的问题 */}
      <Card className={cn("rise overflow-hidden bg-gradient-to-br", heroGradient)} style={{ animationDelay: "60ms" }}>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-sm font-semibold backdrop-blur", aligned ? "border-ok/50 text-ok" : tone === "bad" ? "border-bad/50 text-bad" : "border-warn/50 text-warn")}>
              {aligned ? <CircleCheck className="size-4" /> : <TriangleAlert className="size-4" />}
              {aligned ? "对目标合理 · 达标" : "对目标需调整"}
            </span>
            <Badge variant="secondary" className="gap-1">
              <VerdictIcon className="size-3" />
              {balance.verdictLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">相对你的目标摄入而言</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{headline}</h2>
              <p className="text-sm text-muted-foreground">
                目标摄入 {target.kcal} kcal（维持热量 {total} kcal，按目标 {target.deltaPct >= 0 ? "+" : ""}{target.deltaPct}% 调整）
              </p>
            </div>
            <div className="text-right">
              <div className={cn("text-4xl font-semibold tabular-nums tracking-tight md:text-5xl", tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-warn")}>
                {balance.net > 0 ? "+" : ""}{balance.net}
              </div>
              <div className="text-xs text-muted-foreground">kcal · 净缺口/盈余</div>
            </div>
          </div>
          <div className="rounded-lg bg-background/70 p-3 backdrop-blur">
            <p className="text-sm leading-relaxed">{balance.advice}</p>
            <p className="mt-2 flex items-start gap-1.5 text-sm font-medium">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-advice" />
              {adjust}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            判定规则：净盈亏 = 摄入 − 目标摄入；绝对值 ≤120 kcal 视为接近目标。目标摄入 = 维持热量(TDEE) × 目标系数，而 TDEE 的活动系数已包含每周训练量，因此训练消耗只作展示，不再从摄入里扣一次。
          </p>
          <details className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium text-foreground">计算方式</summary>
            <ul className="mt-2 space-y-1 leading-relaxed">
              <li>基础代谢 BMR：Mifflin-St Jeor 公式（体重、身高、年龄、性别）。</li>
              <li>活动系数：久坐 1.2 / 轻度 1.375 / 中度 1.55 / 高度 1.725 / 运动员级 1.9，每一档都按「每周训练次数」定义。</li>
              <li>维持热量 TDEE = BMR × 活动系数。</li>
              <li>目标摄入 = TDEE × 目标系数（增肌 ×1.12，减脂 ×0.80，重塑 ×1.00）。</li>
              <li>训练消耗：MET × 3.5 × 体重 ÷ 200 × 分钟，属于上面活动量的组成部分，仅作参考。</li>
              <li>净盈亏 = 摄入 − 目标摄入。</li>
            </ul>
          </details>
        </CardContent>
      </Card>

      <div className="rise grid gap-6 lg:grid-cols-2" style={{ animationDelay: "100ms" }}>
        {/* 能量收支 */}
        <Card>
          <CardHeader>
            <SectionHeading icon={Flame} title="当日能量平衡" desc={`${fmtDate(day)} · 摄入与消耗的去向`} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatTile icon={Flame} label="摄入" value={balance.intake} unit="kcal" accent="bg-chart-1" />
              <StatTile icon={Gauge} label="基础代谢" value={resting} unit="kcal" accent="bg-chart-3" />
              <StatTile icon={Activity} label="日常活动（含训练）" value={activityBurn} unit="kcal" accent="bg-chart-5" />
              <StatTile icon={Dumbbell} label="其中训练约" value={balance.burnExercise} unit="kcal" accent="bg-chart-2" hint="MET 估算 · 属于上面一项的子集,仅参考" />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">目标摄入</span>
              <span className="font-semibold tabular-nums">{target.kcal} kcal</span>
            </div>
            {todayMeals.length === 0 ? (
              <InfoNote icon={Info}>今天还没有饮食记录，摄入按 0 计算。到饮食页记录三餐后，这里会实时更新。</InfoNote>
            ) : (
              <InfoNote icon={Info}>训练消耗按 MET×3.5×体重÷200×分钟估算；日常活动消耗 = 每日总消耗 − 基础代谢。均为估算值。</InfoNote>
            )}
          </CardContent>
        </Card>

        {/* 三大营养素 */}
        <Card>
          <CardHeader>
            <SectionHeading icon={Target} title="三大营养素达标" desc="对比今日实际摄入与目标" />
          </CardHeader>
          <CardContent className="space-y-5">
            <MeterRow icon={Beef} label="蛋白质" current={balance.protein} target={target.proteinG} unit="g" barClass="bg-chart-2" explain={`目标约 ${target.proteinPerKg} g/kg 体重`} />
            <MeterRow icon={Wheat} label="碳水" current={balance.carb} target={target.carbG} unit="g" barClass="bg-chart-4" explain={`目标约 ${target.carbPerKg} g/kg 体重`} />
            <MeterRow icon={Droplet} label="脂肪" current={balance.fat} target={target.fatG} unit="g" barClass="bg-chart-1" explain="不低于总热量约 20%" />
            <InfoNote icon={Info}>{target.rationale}</InfoNote>
          </CardContent>
        </Card>
      </div>

      <TrainingPanel />

      <SleepCard />

      {/* 建议 */}
      <Card className="rise" style={{ animationDelay: "140ms" }}>
        <CardHeader>
          <SectionHeading
            icon={Lightbulb}
            title="今日建议"
            desc="每条都标注依据来源，可追溯到真实文献或膳食指南条款。"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoNote icon={Info}>
            下面都是「产品最终建议」，依据为<span className="font-medium text-foreground">科学证据</span>（真实文献，可点原文）或<span className="font-medium text-foreground">膳食指南</span>条款；证据不足时如实标注「素材不足」。它们不是博主原话，也不是 AI 凭空生成。
          </InfoNote>
          <div className="grid gap-3 md:grid-cols-2">
            {advice.map((item) => (
              <AdviceCard key={item.id} item={item} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PageHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="rise space-y-3">
      <div className="energy-line h-1 w-28 rounded-full" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-chart-2 to-chart-3 text-primary-foreground shadow-sm">
            <LayoutDashboard className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">今日总览</h1>
            <p className="text-sm text-muted-foreground">饮食、训练、睡眠、身体数据，一页看清今天做得怎么样。</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1"><CalendarDays className="size-3" />{fmtDate(today())}</Badge>
          {right}
        </div>
      </div>
    </header>
  );
}

function AdviceCard({ item }: { item: AdviceItem }) {
  const t = ADVICE_TONE[item.tone];
  const Icon = t.icon;
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", t.cls)} />
        <Badge variant="secondary" className="text-[11px]">{item.category}</Badge>
        <LayerTag kind="advice" className="ml-auto" />
      </div>
      <p className="text-sm leading-relaxed">{item.text}</p>
      <div className="mt-auto space-y-1.5 border-t pt-2">
        {item.sources.map((s, i) => (
          <SourceLine key={i} source={s} />
        ))}
      </div>
    </div>
  );
}

function SourceLine({ source }: { source: AdviceSource }) {
  if (source.kind === "general") {
    return (
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3 shrink-0" />
        {source.label}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 text-[11px] leading-relaxed">
      <div className="flex items-center gap-1.5">
        <LayerTag kind={source.kind === "evidence" ? "evidence" : "guideline"} />
        <span className="text-muted-foreground">{source.label}</span>
      </div>
      {source.kind === "evidence" ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-0.5 text-muted-foreground">
          {source.title ? <span className="line-clamp-2 italic">{source.title}</span> : null}
          <span className="flex items-center gap-2">
            {source.doi ? <span className="tabular-nums">DOI: {source.doi}</span> : null}
            {source.pmid ? <span className="tabular-nums">PMID: {source.pmid}</span> : null}
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-0.5 text-science underline-offset-2 hover:underline">
                原文 <ExternalLink className="size-3" />
              </a>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SleepCard() {
  const { state, addSleep, removeEntry } = useApp();
  const sleep = state.sleep as SleepEntry[];
  const [date, setDate] = React.useState(today());
  const [hours, setHours] = React.useState("7.5");
  const [quality, setQuality] = React.useState(3);
  const [error, setError] = React.useState<string | null>(null);

  const sorted = React.useMemo(() => [...sleep].sort((a, b) => a.date.localeCompare(b.date)), [sleep]);
  const recent = sorted.slice(-7);
  const last = sorted[sorted.length - 1];
  const avgH = recent.length ? recent.reduce((s, x) => s + x.hours, 0) / recent.length : 0;
  const avgQ = recent.length ? recent.reduce((s, x) => s + x.quality, 0) / recent.length : 0;
  const chartData = recent.map((x) => ({ date: x.date, hours: x.hours }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = Number(hours);
    if (!Number.isFinite(h) || h < 0 || h > 24) {
      setError("睡眠时长需在 0–24 小时之间。");
      return;
    }
    setError(null);
    addSleep({ date: date || today(), hours: +h.toFixed(1), quality: quality as SleepEntry["quality"] });
    toast.success(`已记录 ${fmtDate(date)} 睡眠 ${h} 小时`);
  }

  return (
    <Card>
      <CardHeader>
        <SectionHeading icon={Moon} title="睡眠与恢复" desc="睡眠是增肌和减脂都绕不开的一环。记录时长与主观质量。" />
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-2">
            <Label htmlFor="sl-date">日期</Label>
            <Input id="sl-date" type="date" className="w-40" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sl-hours">时长（小时）</Label>
            <Input id="sl-hours" type="number" inputMode="decimal" step={0.5} min={0} max={24} className="w-28" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>质量（1 差 · 5 好）</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuality(n)}
                  className={cn("h-9 w-9 rounded-md border text-sm font-medium transition-colors", quality === n ? "border-chart-3 bg-chart-3/15 text-chart-3" : "bg-background text-muted-foreground hover:bg-accent")}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit"><Plus className="size-4" />记录睡眠</Button>
          {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
        </form>

        {recent.length === 0 ? (
          <EmptyState icon={BedDouble} title="还没有睡眠记录" desc="记录第一晚的睡眠时长和质量，之后就能看到恢复趋势。建议争取每晚 7–9 小时。" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <StatTile icon={Moon} label="昨晚睡眠" value={last ? last.hours : "—"} unit="小时" accent="bg-chart-3" hint={last ? `质量 ${last.quality}/5 · ${fmtDate(last.date)}` : undefined} />
              <StatTile icon={BedDouble} label="近 7 晚平均" value={avgH.toFixed(1)} unit="小时" accent="bg-chart-2" hint={`平均质量 ${avgQ.toFixed(1)}/5`} />
              <div className="col-span-2">
                <InfoNote icon={Info}>
                  {avgH < 7 ? "平均睡眠不足 7 小时，可能拖累恢复与训练表现，尽量规律作息、补足睡眠。" : "平均睡眠充足，继续保持规律作息。"}（通用恢复建议）
                </InfoNote>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">近 7 晚睡眠时长</p>
              <ChartContainer config={sleepConfig} className="h-40 w-full aspect-auto">
                <BarChart data={chartData} margin={{ left: -16, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tickLine={false} axisLine={false} width={32} domain={[0, 12]} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(l) => fmtDate(String(l))} />} />
                  <Bar dataKey="hours" fill="var(--color-hours)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        )}

        {sorted.length > 0 ? (
          <div className={cn("max-h-48 space-y-2 pr-1", SCROLL_Y)}>
            {[...sorted].reverse().slice(0, 10).map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                <Moon className="size-4 text-chart-3" />
                <span className="tabular-nums text-muted-foreground">{fmtDate(s.date)}</span>
                <span className="font-medium tabular-nums">{s.hours} 小时</span>
                <Badge variant="secondary" className="text-[11px]">质量 {s.quality}/5</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto"
                  aria-label={`删除 ${fmtDate(s.date)} 睡眠记录`}
                  onClick={() => {
                    removeEntry("sleep", s.id);
                    toast.success("已删除睡眠记录");
                  }}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
