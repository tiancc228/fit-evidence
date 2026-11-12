import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, CheckCircle2, Dumbbell, Flame, History, NotebookPen, Target, Timer, Layers,
} from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@/src/lib/types";
import { GOAL_LABEL, today } from "@/src/lib/calc";
import { isDemoData, useApp } from "@/src/lib/store";
import { CLAIMS } from "@/src/data/knowledge";
import { EXERCISES } from "@/src/components/form/data";
import { resolveClaim } from "@/src/components/plan/claimMatch";
import type { ClaimOverride } from "@/src/components/form/ClaimLayers";
import { SafetyAlert } from "@/src/components/form/bits";
import { KbToaster } from "@/src/components/kb/KbToaster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SPLIT_LABEL, buildWeek, resolveSplit, weeklyVolume,
} from "@/src/components/plan/trainingEngine";
import { defaultConfig, type PlanConfig, type SplitKind } from "@/src/components/plan/dietEngine";
import { MyPlanView } from "@/src/components/plan/MyPlanView";
import { CustomPlanView } from "@/src/components/plan/CustomPlanView";
import { TemplatesView } from "@/src/components/plan/TemplatesView";
import { buildRecs } from "@/src/components/plan/planRecs";
import { randomConfig } from "@/src/components/plan/planActions";
import { exportPlan } from "@/src/components/plan/exportPlan";
import { Stat } from "@/src/components/plan/ui";
import { usePlanStore } from "@/src/components/plan/planStore";
import { daysAgo, estimateMinutes, weekBounds } from "@/src/components/plan/trainingHelpers";

const CHECKLIST_KEY = "kepu-verify:plan-checklist:v1";

/** 仅在档案为空时用于保持钩子计算稳定，页面此时只渲染引导态。 */
const PLACEHOLDER: Profile = {
  name: "", sex: "male", age: 25, heightCm: 170, weightKg: 65, bodyFatPct: null,
  activity: "light", goal: "recomp", trainingDaysPerWeek: 3, createdAt: today(),
};

export default function Plan() {
  const { state, setProfile } = useApp();
  const profile = state.profile;
  const base = profile ?? PLACEHOLDER;
  const overrides = (state.claimOverrides ?? {}) as Record<string, ClaimOverride>;
  const { actions: planActions } = usePlanStore();

  const [config, setConfig] = useState<PlanConfig>(() => defaultConfig(base));
  const [dayIdx, setDayIdx] = useState(0);
  const [tab, setTab] = useState("mine");
  const [onlyConfirmed, setOnlyConfirmed] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKLIST_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { date?: string; items?: Record<string, boolean> };
      if (parsed.date === today()) setChecks(parsed.items ?? {});
    } catch {
      /* 本地记录损坏时按空白清单开始 */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify({ date: today(), items: checks }));
    } catch {
      /* 隐私模式下不可写，忽略 */
    }
  }, [checks]);

  const planProfile = useMemo<Profile>(
    () => ({ ...base, goal: config.goal, trainingDaysPerWeek: config.trainingDays }),
    [base, config.goal, config.trainingDays],
  );
  const week = useMemo(() => buildWeek(config, EXERCISES, planProfile), [config, planProfile]);
  const vol = useMemo(() => weeklyVolume(week), [week]);
  const split = resolveSplit(config);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const demo = isDemoData();

  const reviewCounts = useMemo(() => {
    const c = { ai_extracted: 0, pending_review: 0, human_confirmed: 0, published: 0 };
    for (const cl of CLAIMS) c[resolveClaim(cl, overrides).review.state] += 1;
    return c;
  }, [overrides]);

  const recs = useMemo(() => buildRecs({ vol, split, week }), [vol, split, week]);

  const training = state.training;
  const todayDay = week[todayIdx];
  const todayMinutes = todayDay && todayDay.exercises.length > 0 ? estimateMinutes(todayDay.exercises) : null;
  const bounds = weekBounds(today());
  const weekEntries = training.filter((t) => t.date >= bounds.start && t.date <= bounds.end);
  const weekDoneDays = new Set(weekEntries.map((t) => t.date)).size;
  const weekDoneSets = weekEntries.reduce((s, t) => s + t.sets.length, 0);
  const lastTraining = [...training].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))[0] ?? null;

  function set<K extends keyof PlanConfig>(key: K, value: PlanConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  const profileDirty = profile != null && (profile.goal !== config.goal || profile.trainingDaysPerWeek !== config.trainingDays);

  function saveToProfile() {
    if (!profile) return;
    setProfile({ ...profile, goal: config.goal, trainingDaysPerWeek: config.trainingDays });
    toast.success("已把目标与每周训练天数写入身体档案", { description: "系统训练计划与建议会同步使用新目标。" });
  }

  function applySystemSplit(nextSplit: Exclude<SplitKind, "auto">, days: number) {
    setConfig((c) => ({ ...c, split: nextSplit, trainingDays: days }));
    setTab("mine");
  }

  if (!profile) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
        <header className="rise">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Target className="size-6 text-advice" />
            训练计划
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">先有身体档案，才能算出每周训练天数、分化与负重建议。</p>
        </header>
        <div className="energy-line h-0.5 rounded-full" aria-hidden />
        <Empty className="border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Target /></EmptyMedia>
            <EmptyTitle>还没有身体档案</EmptyTitle>
            <EmptyDescription>
              训练页需要性别、年龄、身高、体重、活动量与目标来计算训练天数、分化与动作选择。缺数据时我们不猜测。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <a href="#/body">
                <Target className="size-4" />
                去填写身体评估
              </a>
            </Button>
          </EmptyContent>
        </Empty>
        <KbToaster />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <header className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">TRAINING ENGINE</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Target className="size-6 text-advice" />
            训练计划
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            本周几练、今天练什么、每组做多少——由你的档案与真实训练记录算出；训练建议挂真实出处，四层分开标注。饮食规划在饮食页。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            {profile.name || "未命名"} · {profile.weightKg} kg
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-advice/40 bg-advice-soft px-3 py-1 text-foreground">
            <Flame className="size-3.5 text-advice" />
            {GOAL_LABEL[config.goal]} · 每周 {config.trainingDays} 练 · {SPLIT_LABEL[split]}
          </Badge>
          {demo && (
            <Badge variant="outline" className="border-warn/40 bg-warn/10 px-3 py-1 text-warn">示例数据</Badge>
          )}
        </div>
      </header>
      <div className="energy-line h-0.5 rounded-full" aria-hidden />

      <SafetyAlert />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <Stat icon={Dumbbell} tone="warn" label="每周训练" value={`${vol.trainDays} 练`} unit={`/ ${vol.totalSets} 组`}
          sub={`${SPLIT_LABEL[split]} · 平均组间 ${vol.avgRestSec}s`} />
        <Stat icon={CalendarDays} tone="advice" label="今天练什么" value={todayDay?.kind === "train" ? todayDay.focus : "休息"}
          sub={todayDay?.kind === "train" ? `${todayDay.exercises.length} 个动作 · ${todayDay.weekday}` : `下一个训练日请查看周安排`} />
        <Stat icon={Timer} tone="science" label="今日预计时长" value={todayMinutes != null ? String(todayMinutes) : "—"} unit={todayMinutes != null ? "分钟" : undefined}
          sub={todayMinutes != null ? "含 10 分钟热身" : "休息日不做力竭训练"} />
        <Stat icon={CheckCircle2} tone="ai" label="本周已完成" value={`${weekDoneDays} 练`} unit={`/ ${weekDoneSets} 组`}
          sub="只统计本机真实训练记录" />
        <Stat icon={History} tone="voice" label="上次训练" value={lastTraining ? lastTraining.date.slice(5) : "无记录"}
          sub={lastTraining ? `${daysAgo(lastTraining.date) === 0 ? "今天" : `${daysAgo(lastTraining.date)} 天前`} · ${lastTraining.name}` : "练一次后这里才开始计数"} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full flex-wrap sm:w-fit">
          <TabsTrigger value="mine" className="gap-1.5">
            <Dumbbell className="size-4" />
            我的计划
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-1.5">
            <NotebookPen className="size-4" />
            自定义计划
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Layers className="size-4" />
            计划模板
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-4">
          <MyPlanView
            profile={profile}
            config={config}
            set={set}
            week={week}
            vol={vol}
            split={split}
            todayIdx={todayIdx}
            dayIdx={dayIdx}
            onSelectDay={setDayIdx}
            recs={recs}
            overrides={overrides}
            reviewCounts={reviewCounts}
            onlyConfirmed={onlyConfirmed}
            onOnlyConfirmedChange={setOnlyConfirmed}
            checks={checks}
            onCheck={(id, value) => setChecks((s) => ({ ...s, [id]: value }))}
            profileDirty={profileDirty}
            onReset={() => { setConfig(defaultConfig(profile)); toast.success("已按身体档案重置计划"); }}
            onRandom={() => { setConfig(randomConfig(profile)); toast.success("已随机试算一套方案", { description: "只是试算，喜欢就写入档案。" }); }}
            onExport={() => exportPlan({ base, config, split, week, vol, recs, overrides })}
            onSaveProfile={saveToProfile}
            onOpenCustomTab={() => setTab("custom")}
          />
        </TabsContent>

        <TabsContent value="custom" className="mt-4">
          <CustomPlanView onOpenMyPlan={() => { planActions.setSource("custom"); setTab("mine"); }} />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplatesView
            level={config.level}
            onApplySystem={applySystemSplit}
            onOpenMyPlan={() => setTab("mine")}
          />
        </TabsContent>
      </Tabs>

      <KbToaster />
    </div>
  );
}
