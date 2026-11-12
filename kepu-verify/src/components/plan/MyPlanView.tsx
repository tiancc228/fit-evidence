import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronRight, Dumbbell, Info, ListChecks, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@/src/lib/types";
import { today as todayISO, uid } from "@/src/lib/calc";
import { isDemoData, useApp } from "@/src/lib/store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { PlanConfig, SplitKind } from "@/src/components/plan/dietEngine";
import { SPLIT_LABEL, type TrainingDay } from "@/src/components/plan/trainingEngine";
import type { ClaimOverride } from "@/src/components/form/ClaimLayers";
import { WeekView } from "@/src/components/plan/WeekView";
import { DayDetail } from "@/src/components/plan/DayDetail";
import { TrainingVersions } from "@/src/components/plan/TrainingVersions";
import { SessionPanel, type CommittedExercise } from "@/src/components/plan/SessionPanel";
import { LastSummary } from "@/src/components/plan/LastSummary";
import { PlanConsole, type SetPlanConfig } from "@/src/components/plan/PlanConsole";
import { EvidenceCard, type Rec } from "@/src/components/plan/ConclusionCard";
import { GuideView } from "@/src/components/plan/GuideView";
import { usePlanStore, type SessionDraft } from "@/src/components/plan/planStore";
import {
  buildVersions, customDaysToTrainingDays, lastRecordFor, repsMid, topSetWeight,
  type VersionId,
} from "@/src/components/plan/trainingHelpers";
import { loadConflict } from "@/src/components/plan/load";

export interface MyPlanProps {
  profile: Profile;
  config: PlanConfig;
  set: SetPlanConfig;
  week: TrainingDay[];
  vol: { trainDays: number; totalSets: number; avgRestSec: number };
  split: Exclude<SplitKind, "auto">;
  todayIdx: number;
  dayIdx: number;
  onSelectDay: (dayIndex: number) => void;
  recs: Rec[];
  overrides: Record<string, ClaimOverride>;
  reviewCounts: { ai_extracted: number; pending_review: number; human_confirmed: number; published: number };
  onlyConfirmed: boolean;
  onOnlyConfirmedChange: (v: boolean) => void;
  checks: Record<string, boolean>;
  onCheck: (id: string, value: boolean) => void;
  profileDirty: boolean;
  onReset: () => void;
  onRandom: () => void;
  onExport: () => void;
  onSaveProfile: () => void;
  onOpenCustomTab: () => void;
}

export function MyPlanView(props: MyPlanProps) {
  const { state: appState, addTraining } = useApp();
  const training = appState.training;
  const { state: planState, actions } = usePlanStore();
  const [subTab, setSubTab] = useState("plan");
  const [versionId, setVersionId] = useState<VersionId>("full");
  const [sessionOpen, setSessionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customDayIndex, setCustomDayIndex] = useState(0);
  const saveLock = useRef(false);
  const demo = isDemoData();

  const customDays = useMemo(() => customDaysToTrainingDays(planState.plan), [planState.plan]);
  const hasCustom = customDays.length > 0;
  const source: "system" | "custom" = planState.source === "custom" && hasCustom ? "custom" : "system";

  const systemDay = props.week.find((d) => d.dayIndex === props.dayIdx) ?? props.week[0];
  const activeDay = source === "custom" ? (customDays[customDayIndex] ?? customDays[0]) : systemDay;
  const versions = buildVersions(activeDay);
  const currentVersion = versions.find((v) => v.id === versionId) ?? versions[0] ?? null;
  const customDayUid = planState.plan.days[customDayIndex]?.uid ?? planState.plan.days[0]?.uid ?? "day";
  const dayKey = source === "custom" ? `custom:${customDayUid}` : `sys:${activeDay.dayIndex}`;
  const draft = planState.draft;
  const draftMatches = draft != null && draft.dayKey === dayKey && draft.versionId === (currentVersion?.id ?? "full");
  const draftOpen = draftMatches && sessionOpen;
  const draftDone = draft?.exercises.reduce((s, e) => s + e.sets.filter((x) => x.done).length, 0) ?? 0;
  const draftTotal = draft?.exercises.reduce((s, e) => s + e.sets.length, 0) ?? 0;

  function buildDraft(): SessionDraft | null {
    if (!currentVersion) return null;
    const exercises = currentVersion.exercises.map((pe) => {
      const last = lastRecordFor(training, pe.exercise.id);
      const top = topSetWeight(last);
      const isBodyweight = pe.load.isBodyweight && !loadConflict(pe);
      const prefilledFrom = isBodyweight
        ? (last ? `上次 ${last.date}（自重）` : "自重")
        : top != null && last
          ? `上次 ${last.date} · ${top} kg`
          : null;
      const reps = String(repsMid(pe));
      return {
        uid: uid(),
        exerciseId: pe.exercise.id,
        name: pe.exercise.name,
        part: pe.exercise.part,
        isBodyweight,
        restSec: pe.restSec,
        prefilledFrom,
        sets: Array.from({ length: pe.sets }, () => ({
          reps,
          weightKg: isBodyweight ? "0" : top != null ? String(top) : "",
          rpe: "",
          done: false,
        })),
      };
    });
    return {
      date: todayISO(),
      dayKey,
      versionId: currentVersion.id,
      title: `${activeDay.weekday} · ${activeDay.focus} · ${currentVersion.label}`,
      exercises,
      updatedAt: new Date().toISOString(),
    };
  }

  function startSession() {
    if (!currentVersion) return;
    if (draft && !draftMatches) {
      if (!window.confirm("已有其他未完成的训练草稿，开始新训练会覆盖它（未保存的组会丢失）。继续？")) return;
    }
    if (!draftMatches) {
      const next = buildDraft();
      if (!next) return;
      actions.setDraft(next);
    }
    setSessionOpen(true);
    setTimeout(() => document.getElementById("session-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function saveSession(committed: CommittedExercise[]) {
    if (saving || !draft || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      let savedSets = 0;
      for (const c of committed) {
        const seconds = c.sets.reduce((s, x) => s + x.reps * 3 + c.exercise.restSec, 0);
        addTraining({
          date: todayISO(),
          exerciseId: c.exercise.exerciseId,
          name: c.exercise.name,
          part: c.exercise.part,
          sets: c.sets,
          durationMin: Math.max(5, Math.round(seconds / 60)),
          feel: 3, pump: 3, soreness: 3, photoId: null,
          note: `来自训练执行（${draft.title}）；感受评分未填写，默认 3，可在训练记录里修改。`,
        });
        savedSets += c.sets.length;
      }

      const remaining = draft.exercises
        .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => !s.done).map((s) => ({ ...s, done: false })) }))
        .filter((ex) => ex.sets.length > 0);
      const remainingSets = remaining.reduce((s, ex) => s + ex.sets.length, 0);

      if (remainingSets === 0) {
        actions.clearDraft();
        setSessionOpen(false);
        toast.success(`已保存 ${savedSets} 组到今日训练记录`, {
          description: "全部组已完成，草稿已清空。可在「上次完成情况」或训练记录里查看。",
          action: { label: "去看记录", onClick: () => { location.hash = "#/overview"; } },
        });
      } else {
        actions.setDraft({ ...draft, exercises: remaining, updatedAt: new Date().toISOString() });
        toast.success(`已保存 ${savedSets} 组到今日训练记录`, {
          description: `${remainingSets} 组未勾选完成，已留在草稿里，不会丢失。`,
        });
      }
    } finally {
      setSaving(false);
      // 同一帧内的第二次点击会复用旧闭包，用短暂锁挡住重复写入。
      setTimeout(() => { saveLock.current = false; }, 1200);
    }
  }

  function discardDraft() {
    if (!window.confirm("放弃这次训练草稿？未保存的组会丢失。")) return;
    actions.clearDraft();
    setSessionOpen(false);
  }

  function switchSource(next: "system" | "custom") {
    actions.setSource(next);
    if (next === "custom") setCustomDayIndex(0);
  }

  return (
    <Tabs value={subTab} onValueChange={setSubTab}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList className="w-full flex-wrap sm:w-fit">
          <TabsTrigger value="plan" className="gap-1.5">
            <Dumbbell className="size-4" />
            训练安排
          </TabsTrigger>
          <TabsTrigger value="evidence" className="gap-1.5">
            <ListChecks className="size-4" />
            依据出处
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-1.5">
            <CalendarDays className="size-4" />
            指南与执行
          </TabsTrigger>
        </TabsList>
        <a href="#/diet" className="text-[11px] text-primary underline-offset-2 hover:underline">
          查看饮食规划与依据 →
        </a>
      </div>

      <TabsContent value="plan" className="mt-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant={source === "system" ? "default" : "outline"} onClick={() => switchSource("system")}>
                系统计划
              </Button>
              <Button
                size="sm"
                variant={source === "custom" ? "default" : "outline"}
                disabled={!hasCustom}
                onClick={() => switchSource("custom")}
              >
                我的自定义计划{hasCustom ? `（${customDays.length} 天）` : ""}
              </Button>
              {!hasCustom && (
                <span className="text-[11px] text-muted-foreground">先在「自定义计划」或「计划模板」创建</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="gap-1" onClick={props.onOpenCustomTab}>
                <Pencil className="size-3.5" />
                编辑自定义计划
              </Button>
            </div>
          </div>

          {source === "custom" && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              当前使用你的自定义计划：只按训练日顺序显示，不绑定星期；重量为计划设定值，未设定时按 RIR 自选。
            </p>
          )}

          <div className={cn("grid items-start gap-4", source === "system" && "lg:grid-cols-[minmax(280px,320px)_1fr]")}>
            {source === "system" && (
              <PlanConsole
                config={props.config}
                set={props.set}
                split={props.split}
                onlyConfirmed={props.onlyConfirmed}
                onOnlyConfirmedChange={props.onOnlyConfirmedChange}
                reviewCounts={props.reviewCounts}
                profileDirty={props.profileDirty}
                onReset={props.onReset}
                onRandom={props.onRandom}
                onExport={props.onExport}
                onSave={props.onSaveProfile}
              />
            )}

            <div className="flex min-w-0 flex-col gap-4">
              {source === "system" ? (
                <>
                  <WeekView
                    week={props.week}
                    activeDayIndex={activeDay.dayIndex}
                    todayIdx={props.todayIdx}
                    splitLabel={SPLIT_LABEL[props.split]}
                    onSelectDay={props.onSelectDay}
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <Play className="size-4 text-advice" />
                      {activeDay.dayIndex === props.todayIdx ? "今天练什么" : `${activeDay.weekday}练什么`}
                    </h2>
                    {activeDay.dayIndex !== props.todayIdx && (
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => props.onSelectDay(props.todayIdx)}>
                        回到今天
                        <ChevronRight className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <Card className="gap-0 rounded-xl py-0">
                  <CardHeader className="gap-1 border-b border-border p-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Dumbbell className="size-4 text-advice" />
                      本次练什么 · 自定义训练日
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground">自定义计划不绑定星期，按顺序训练或自行选择。</p>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-1.5 p-4">
                    {customDays.map((d, i) => {
                      const on = d.dayIndex === customDayIndex;
                      return (
                        <button
                          key={d.focus + i}
                          onClick={() => setCustomDayIndex(i)}
                          aria-pressed={on}
                          className={cn(
                            "flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                            on ? "border-advice/60 bg-advice-soft" : "border-border bg-card hover:bg-muted/50",
                          )}
                        >
                          <span className="text-xs font-medium">{d.focus}</span>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {d.weekday} · {d.exercises.length} 动作
                          </span>
                        </button>
                      );
                    })}
                    <Button variant="ghost" size="sm" className="self-center gap-1" onClick={props.onOpenCustomTab}>
                      <Pencil className="size-3.5" />
                      编辑
                    </Button>
                  </CardContent>
                </Card>
              )}

              <DayDetail day={activeDay} training={training} demo={demo} onGoEvidence={() => setSubTab("evidence")} />

              <TrainingVersions day={activeDay} value={versionId} onChange={setVersionId} onStart={startSession} />

              {draft && !draftOpen && (
                <Card className="gap-0 rounded-xl border-warn/40 py-0">
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <AlertTriangle className="size-4 text-warn" />
                        有一份未完成的训练草稿
                      </p>
                      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                        {draft.title} · 已勾选 {draftDone} / {draftTotal} 组 · {draft.date}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" onClick={() => setSessionOpen(true)}>继续训练</Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={discardDraft}>放弃草稿</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {draft && draftOpen && (
                <SessionPanel
                  draft={draft}
                  saving={saving}
                  onChange={actions.setDraft}
                  onSave={saveSession}
                  onClose={() => setSessionOpen(false)}
                  onDiscard={discardDraft}
                />
              )}

              <LastSummary training={training} demo={demo} />
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="evidence" className="mt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
          <Label htmlFor="only-confirmed-evidence" className="text-xs leading-snug">
            只看已人工确认 / 已发布的依据
          </Label>
          <Switch
            id="only-confirmed-evidence"
            checked={props.onlyConfirmed}
            onCheckedChange={props.onOnlyConfirmedChange}
          />
        </div>

        <Alert className="border-warn/40 bg-warn/10">
          <Info className="size-4 text-warn" />
          <AlertTitle>发布门禁：未发布内容只作参考</AlertTitle>
          <AlertDescription>
            <span className="text-foreground">
              {props.reviewCounts.published} 条已发布 · {props.reviewCounts.human_confirmed} 条人工已确认 · {props.reviewCounts.pending_review} 条待审核 · {props.reviewCounts.ai_extracted} 条 AI 已提取。
            </span>
            <span className="mt-1 block">
              只有「已发布」的结论会进入公开知识库；其余条目在本页明确标注「未发布」。
              {props.onlyConfirmed ? "当前已开启「只看已确认」，未确认条目被隐藏。" : "可开启上方「只看已确认」隐藏未确认条目。"}
              <a href="#/review" className="ml-1 text-primary underline-offset-2 hover:underline">去审核台</a>
              <a href="#/knowledge" className="ml-2 text-primary underline-offset-2 hover:underline">去知识库</a>
            </span>
          </AlertDescription>
        </Alert>

        <div className="grid items-start gap-3 xl:grid-cols-2">
          {props.recs.map((r) => (
            <EvidenceCard key={r.id} rec={r} overrides={props.overrides} onlyConfirmed={props.onlyConfirmed} />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="guide" className="mt-4 flex flex-col gap-4">
        <GuideView checks={props.checks} onCheck={props.onCheck} />
      </TabsContent>
    </Tabs>
  );
}
