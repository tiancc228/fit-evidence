import { useMemo } from "react";
import { ArrowDownRight, Info, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MealEntry, Profile } from "@/src/lib/types";
import type { DayBalance, MacroTarget } from "@/src/lib/calc";
import { pickNextMealCombos, type NextMealMode } from "@/src/data/meal-combos";
import {
  DIET_CLAIM, LayerTag, SLOT_META, WhyEvidenceButton, fmtInt, type MealSlot, type OpenEvidence,
} from "@/src/components/diet/shared";

const MODE_META: Record<NextMealMode, { label: string; className: string }> = {
  fill: { label: "补足缺口", className: "border-chart-2/40 bg-chart-2/10 text-chart-2" },
  trim: { label: "今日收口", className: "border-destructive/40 bg-destructive/10 text-destructive" },
  maintain: { label: "保持即可", className: "border-chart-4/40 bg-chart-4/10 text-chart-4" },
};

export function NextMealCard({
  profile,
  balance,
  targets,
  dayMeals,
  slot,
  isToday,
  onOpenEvidence,
}: {
  profile: Profile | null;
  balance: DayBalance | null;
  targets: MacroTarget | null;
  dayMeals: MealEntry[];
  slot: MealSlot;
  isToday: boolean;
  onOpenEvidence?: OpenEvidence;
}) {
  const plan = useMemo(() => {
    if (!balance || !targets || !profile) return null;
    return pickNextMealCombos({
      remainingKcal: targets.kcal - balance.intake,
      proteinGap: Math.max(0, targets.proteinG - balance.protein),
      fatGap: targets.fatG - balance.fat,
      slot,
      goal: profile.goal,
      meals: dayMeals,
    });
  }, [balance, targets, profile, slot, dayMeals]);

  const claimId =
    plan?.mode === "trim"
      ? profile?.goal === "muscle" ? DIET_CLAIM.muscleSurplus : DIET_CLAIM.fatlossDeficit
      : plan?.mode === "maintain"
        ? DIET_CLAIM.proteinPerMeal
        : DIET_CLAIM.staple;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="flex items-center gap-2">
            <UtensilsCrossed className="size-4 text-chart-3" />
            下一餐建议
          </span>
          <Badge variant="secondary">下一餐:{SLOT_META[slot].label}</Badge>
          {plan && (
            <Badge variant="outline" className={cn(MODE_META[plan.mode].className)}>
              {MODE_META[plan.mode].label}
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          按今日剩余热量、蛋白质缺口和脂肪余量挑组合;份量是起点,不是你今天必须吃完的定额。
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!profile || !balance || !targets || !plan ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            先在「档案」页填写身体信息,这里才会按你的剩余热量和蛋白质缺口给出真实组合。
          </p>
        ) : dayMeals.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            今天还没有记录。先记下第一餐,这里会按剩余热量和蛋白质缺口给出组合,
            而不是一上来就让你把一整天的量吃完。
          </p>
        ) : (
          <>
            <p className="text-sm leading-relaxed">{plan.headline}</p>
            {!isToday && (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                查看的是历史日期:组合只用于复盘当时的缺口,不建议照着补吃。
              </p>
            )}

            {plan.moves.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <ArrowDownRight className="size-4 text-destructive" />
                  先把今天收回来
                </p>
                <ul className="flex flex-col gap-1.5">
                  {plan.moves.map((move) => (
                    <li key={move.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{move.title}</span>
                        {move.saveKcal > 0 && (
                          <Badge variant="outline" className="border-chart-2/40 bg-chart-2/10 text-[10px] text-chart-2">
                            约省 {fmtInt(move.saveKcal)} kcal
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{move.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plan.combos.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {plan.combos.map((combo) => (
                  <div key={combo.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{combo.title}</p>
                      <LayerTag layer="advice" className="shrink-0 text-[10px]" />
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{combo.detail}</p>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="rounded-lg bg-muted/60 px-1 py-1.5">
                        <p className="text-[10px] text-muted-foreground">热量</p>
                        <p className="text-xs font-semibold tabular-nums">{fmtInt(combo.kcal)}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">kcal</span></p>
                      </div>
                      <div className="rounded-lg bg-muted/60 px-1 py-1.5">
                        <p className="text-[10px] text-muted-foreground">蛋白质</p>
                        <p className="text-xs font-semibold tabular-nums">{fmtInt(combo.protein)}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">g</span></p>
                      </div>
                      <div className="rounded-lg bg-muted/60 px-1 py-1.5">
                        <p className="text-[10px] text-muted-foreground">脂肪</p>
                        <p className="text-xs font-semibold tabular-nums">{fmtInt(combo.fat)}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">g</span></p>
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{combo.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                今天没有需要额外补的组合;下一餐按平常吃,别再额外加餐即可。
              </p>
            )}

            {plan.notes.length > 0 && (
              <ul className="flex flex-col gap-1">
                {plan.notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-lg border border-chart-1/30 bg-chart-1/5 p-3">
              <LayerTag layer="advice" />
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                组合是按《中国食物成分表》每 100 g 参考值折算的<strong className="text-foreground">产品建议</strong>,
                不是博主原话,也不是文献结论。热量、蛋白质为近似值,按饥饿感和训练量调整即可。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <WhyEvidenceButton
                claimId={claimId}
                onOpenEvidence={onOpenEvidence}
                source="diet-next-meal"
                label="为什么这样组合"
              />
              <span className="text-[11px] text-muted-foreground">
                四层出处链在抽屉里展开,本页不复制文献全文。
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
