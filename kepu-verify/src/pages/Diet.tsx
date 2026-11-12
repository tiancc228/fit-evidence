import { useMemo, useState } from "react";
import {
  BookOpen, Camera, CalendarDays, ChevronLeft, ChevronRight, History, Plus, Salad, ShieldCheck, Target,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GOAL_LABEL, addDays, dayBalance, macroTargets, today } from "@/src/lib/calc";
import { useApp } from "@/src/lib/store";
import { FOOD_BY_ID, scaleFood } from "@/src/data/foods";
import { EXERCISE_BY_ID } from "@/src/data/exercises";
import type { OpenEvidence } from "@/src/components/diet/evidence";
import { FoodLibrary } from "@/src/components/diet/food-library";
import { MealEntryDialog } from "@/src/components/diet/meal-entry-dialog";
import { PhotoMealDialog } from "@/src/components/diet/photo-meal-dialog";
import { DaySummary, type DayTotals } from "@/src/components/diet/day-summary";
import { BalanceCard } from "@/src/components/diet/balance-card";
import { AdviceEvidenceCard, DietClaims, GuidelinePanel, SlotTip } from "@/src/components/diet/claim-cards";
import { NextMealCard } from "@/src/components/diet/next-meal-card";
import { HistoryView, MealRow } from "@/src/components/diet/history-view";
import {
  DietToaster, PhotoPreviewDialog, SLOT_META, SLOT_ORDER, defaultSlotByHour, fmtInt, useAiStatus,
  type MealSlot,
} from "@/src/components/diet/shared";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export default function Diet({ onOpenEvidence }: { onOpenEvidence?: OpenEvidence } = {}) {
  const { state } = useApp();
  const [date, setDate] = useState(today());
  const [tab, setTab] = useState("log");
  const [entry, setEntry] = useState<{ slot: MealSlot; foodId?: string | null } | null>(null);
  const [photoSlot, setPhotoSlot] = useState<MealSlot | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const ai = useAiStatus();

  const profile = state.profile;
  const dayMeals = useMemo(() => state.meals.filter((m) => m.date === date), [state.meals, date]);

  const totals = useMemo<DayTotals>(() => {
    let fiber = 0;
    for (const m of dayMeals) {
      const f = m.foodId ? FOOD_BY_ID.get(m.foodId) : null;
      if (f) fiber += scaleFood(f, m.grams).fiber;
    }
    return {
      kcal: Math.round(dayMeals.reduce((s, m) => s + m.kcal, 0)),
      protein: +dayMeals.reduce((s, m) => s + m.protein, 0).toFixed(1),
      carb: +dayMeals.reduce((s, m) => s + m.carb, 0).toFixed(1),
      fat: +dayMeals.reduce((s, m) => s + m.fat, 0).toFixed(1),
      fiber: +fiber.toFixed(1),
    };
  }, [dayMeals]);

  const { balance, targets, unknownMetCount } = useMemo(() => {
    if (!profile) return { balance: null, targets: null, unknownMetCount: 0 };
    let unknown = 0;
    const ts = state.training
      .filter((t) => t.date === date)
      .map((t) => {
        const ex = EXERCISE_BY_ID.get(t.exerciseId);
        if (!ex) unknown += 1;
        return { durationMin: t.durationMin, met: ex?.met ?? 0, weightKg: profile.weightKg };
      });
    return {
      balance: dayBalance(profile, dayMeals, ts),
      targets: macroTargets(profile),
      unknownMetCount: unknown,
    };
  }, [profile, state.training, date, dayMeals]);

  const isToday = date === today();
  const rel = isToday ? "今天" : date === addDays(today(), -1) ? "昨天" : null;
  const weekday = WEEKDAYS[new Date(date + "T00:00:00").getDay()];

  const nextSlot = useMemo<MealSlot>(() => {
    const empty = SLOT_ORDER.find((s) => !dayMeals.some((m) => m.slot === s));
    // 四个餐次都记过时，按当前时间也不该再报「午餐」：加餐是唯一可灵活安排的一餐。
    return empty ?? (isToday ? "snack" : defaultSlotByHour());
  }, [dayMeals, isToday]);

  const aiEstimateCount = dayMeals.filter((m) => m.source === "ai").length;
  const intake = balance?.intake ?? totals.kcal;
  const pct = targets && targets.kcal > 0 ? Math.round((intake / targets.kcal) * 100) : null;

  function openManual(slot?: MealSlot, foodId?: string | null) {
    setEntry({ slot: slot ?? nextSlot, foodId: foodId ?? null });
  }

  function jumpTo(d: string) {
    setDate(d);
    setTab("log");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      {/* 页头:目标、日期、摄入进度 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Salad className="size-6 text-chart-2" />
            饮食规划
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            记三餐、看缺口:食物数据来自《中国食物成分表》每 100 g 参考值,
            目标按你的身体档案计算;建议的出处链收进证据抽屉,不在本页堆文献。
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {profile && targets && (
            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
              <Target className="size-3.5" />
              {GOAL_LABEL[profile.goal]} · 目标 {targets.kcal} kcal/天
            </Badge>
          )}
          <Badge variant="outline" className="gap-1.5 px-3 py-1 tabular-nums">
            <CalendarDays className="size-3.5" />
            {date} {weekday}
            {rel && <span className="text-muted-foreground">· {rel}</span>}
          </Badge>
          {targets ? (
            <div className="min-w-44 rounded-xl border border-border bg-card px-3 py-2">
              <div className="flex items-baseline justify-between gap-3 text-xs tabular-nums">
                <span className="text-muted-foreground">已摄入</span>
                <span className="font-semibold">
                  {fmtInt(intake)} <span className="font-normal text-muted-foreground">/ {targets.kcal} kcal</span>
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={Math.min(100, pct ?? 0)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="今日摄入进度"
                className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-chart-3 transition-all duration-500"
                  style={{ width: `${Math.min(100, pct ?? 0)}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[10px] text-muted-foreground tabular-nums">
                {pct != null ? `${pct}%` : ""}
                {pct != null && pct > 100 ? " · 已超出目标" : ""}
              </p>
            </div>
          ) : (
            <Badge variant="outline" className="px-3 py-1 tabular-nums">
              已摄入 {fmtInt(intake)} kcal
            </Badge>
          )}
        </div>
      </div>

      {/* 日期导航 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="前一天"
          onClick={() => setDate(addDays(date, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-40 tabular-nums"
          aria-label="选择日期"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="后一天"
          disabled={isToday}
          onClick={() => setDate(addDays(date, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        {!isToday && (
          <Button variant="ghost" size="sm" onClick={() => setDate(today())}>
            回到今天
          </Button>
        )}
        <span className="w-full text-right text-xs text-muted-foreground tabular-nums sm:ml-auto sm:w-auto">
          当日 {dayMeals.length} 条 · {fmtInt(intake)} kcal
        </span>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList className="w-full max-w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="log" className="shrink-0 gap-1.5">
            <UtensilsCrossed className="size-4" />
            当日记录
          </TabsTrigger>
          <TabsTrigger value="library" className="shrink-0 gap-1.5">
            <BookOpen className="size-4" />
            食物库
          </TabsTrigger>
          <TabsTrigger value="evidence" className="shrink-0 gap-1.5">
            <ShieldCheck className="size-4" />
            依据与出处
          </TabsTrigger>
          <TabsTrigger value="history" className="shrink-0 gap-1.5">
            <History className="size-4" />
            历史
          </TabsTrigger>
        </TabsList>

        {/* 当日记录 */}
        <TabsContent value="log" className="flex flex-col gap-4">
          {/* ① 今日热量与三大营养素摘要 */}
          <div className="grid items-start gap-4 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <DaySummary
                profile={profile}
                totals={totals}
                balance={balance}
                targets={targets}
                aiEstimateCount={aiEstimateCount}
              />
            </div>
            <div className="lg:col-span-7">
              {profile && balance && targets && dayMeals.length > 0 ? (
                <BalanceCard
                  profile={profile}
                  balance={balance}
                  targets={targets}
                  unknownMetCount={unknownMetCount}
                  onOpenEvidence={onOpenEvidence}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                    <Target className="size-8 text-muted-foreground" />
                    <p className="text-sm font-medium">今日能量判断</p>
                    <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                      {!profile
                        ? "建立身体档案后，这里会回答：今天是缺口还是盈余、差多少 kcal、蛋白质和脂肪的余量各是多少。"
                        : "先记录今天吃过的食物，这里会给出缺口/盈余判断和三个缺口数字；具体吃什么看下面的「下一餐建议」。在下方「记录这一餐」里记一餐即可。"}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* ② 早餐 / 午餐 / 晚餐 / 加餐 */}
          <div className="grid items-start gap-3 sm:grid-cols-2">
            {SLOT_ORDER.map((slot) => {
              const Meta = SLOT_META[slot];
              const Icon = Meta.icon;
              const slotMeals = dayMeals.filter((m) => m.slot === slot);
              const sub = Math.round(slotMeals.reduce((s, m) => s + m.kcal, 0));
              const hasAi = slotMeals.some((m) => m.source === "ai");
              return (
                <Card key={slot} className="gap-3">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Icon className="size-4 text-chart-3" />
                      {Meta.label}
                      <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                        {slotMeals.length === 0 ? Meta.timeHint : `${hasAi ? "≈ " : ""}${fmtInt(sub)} kcal`}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {slotMeals.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-center text-xs text-muted-foreground">
                        还没记录 · {Meta.timeHint}
                      </p>
                    ) : (
                      slotMeals.map((m) => <MealRow key={m.id} entry={m} onPreview={setPreviewId} />)
                    )}
                    <SlotTip slot={slot} weightKg={profile?.weightKg ?? null} onOpenEvidence={onOpenEvidence} />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ③ 手动记录 与 拍照记录(全页唯一记录入口) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="size-4 text-chart-3" />
                记录这一餐
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                两种方式记的记录都会进入上面四个餐次，后续可以删除或撤销。
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => openManual()}
                className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/60"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3">
                    <Plus className="size-4" />
                  </span>
                  手动记一餐
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  适合精确记录：从食物库选食物、输入克数，按每 100 g 参考值换算。
                  下一餐默认为「{SLOT_META[nextSlot].label}」，可在弹窗里改。
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPhotoSlot(nextSlot)}
                className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/60"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-chart-4/10 text-chart-4">
                    <Camera className="size-4" />
                  </span>
                  拍照记一餐
                  {ai !== "ready" && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      AI {ai === "error" ? "暂不可用" : "未配置"}
                    </Badge>
                  )}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  AI 估算食物和份量，结果需要你逐项核对确认；未配置 AI 时自动转为手动录入，照片仍会随记录保存。
                </span>
              </button>
            </CardContent>
          </Card>

          {/* ④ 下一餐建议 */}
          <NextMealCard
            profile={profile}
            balance={balance}
            targets={targets}
            dayMeals={dayMeals}
            slot={nextSlot}
            isToday={isToday}
            onOpenEvidence={onOpenEvidence}
          />

          {/* ⑤ 为什么这样建议 */}
          <AdviceEvidenceCard goal={profile?.goal ?? null} onOpenEvidence={onOpenEvidence} />
        </TabsContent>

        {/* 食物库 */}
        <TabsContent value="library">
          <FoodLibrary onPick={(foodId) => openManual(undefined, foodId)} />
        </TabsContent>

        {/* 依据与出处:正文在抽屉里,这里只留结论与入口 */}
        <TabsContent value="evidence" className="flex flex-col gap-4">
          <GuidelinePanel />
          <DietClaims onOpenEvidence={onOpenEvidence} />
        </TabsContent>

        {/* 历史 */}
        <TabsContent value="history">
          <HistoryView onJump={jumpTo} />
        </TabsContent>
      </Tabs>

      <MealEntryDialog
        open={entry != null}
        onOpenChange={(o) => !o && setEntry(null)}
        date={date}
        slot={entry?.slot ?? nextSlot}
        initialFoodId={entry?.foodId}
      />
      {photoSlot != null && (
        <PhotoMealDialog
          open
          onOpenChange={(o) => !o && setPhotoSlot(null)}
          date={date}
          slot={photoSlot}
        />
      )}
      <PhotoPreviewDialog photoId={previewId} onOpenChange={(o) => !o && setPreviewId(null)} />
      <DietToaster />
    </div>
  );
}