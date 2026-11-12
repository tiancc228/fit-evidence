import { Beef, Droplets, Dumbbell, Flame, Wheat } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/src/lib/types";
import type { DayBalance, MacroTarget } from "@/src/lib/calc";
import { fmtInt } from "@/src/components/diet/shared";

export interface DayTotals {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
}

function MacroBar({
  icon: Icon,
  label,
  current,
  target,
  unit,
  barClass,
  textClass,
}: {
  icon: typeof Flame;
  label: string;
  current: number;
  target: number;
  unit: string;
  barClass: string;
  textClass: string;
}) {
  const pct = target > 0 ? Math.round((current / target) * 100) : 0;
  const over = current > target * 1.05;
  const near = !over && pct >= 90;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm">
          <Icon className={cn("size-4", textClass)} />
          {label}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          <span className={cn("font-semibold", over ? "text-destructive" : "text-foreground")}>
            {fmtInt(current)}
          </span>
          {" / "}
          {fmtInt(target)} {unit}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.min(100, pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}达标进度`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", over ? "bg-destructive" : barClass)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex justify-end">
        {over ? (
          <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-[10px] text-destructive">
            超标 {fmtInt(current - target)} {unit}({pct}%)
          </Badge>
        ) : near ? (
          <Badge variant="outline" className="border-chart-2/40 bg-chart-2/10 text-[10px] text-chart-2">
            接近达标 {pct}%
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
        )}
      </div>
    </div>
  );
}

export function DaySummary({
  profile,
  totals,
  balance,
  targets,
  aiEstimateCount = 0,
}: {
  profile: Profile | null;
  totals: DayTotals;
  balance: DayBalance | null;
  targets: MacroTarget | null;
  aiEstimateCount?: number;
}) {
  const donutData = [
    { name: "蛋白质", value: Math.round(totals.protein * 4), fill: "var(--chart-2)" },
    { name: "碳水", value: Math.round(totals.carb * 4), fill: "var(--chart-4)" },
    { name: "脂肪", value: Math.round(totals.fat * 9), fill: "var(--chart-1)" },
  ];
  const macroKcal = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="size-4 text-chart-1" />
          今日摄入与三大营养素
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div className="relative size-32 shrink-0">
            {macroKcal > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="64%"
                    outerRadius="95%"
                    paddingAngle={3}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {donutData.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-2 rounded-full border-8 border-muted" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold tabular-nums">{totals.kcal}</span>
              <span className="text-[10px] text-muted-foreground">kcal 已摄入</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {donutData.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.fill }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="ml-auto font-medium tabular-nums">
                  {macroKcal > 0 ? `${Math.round((d.value / macroKcal) * 100)}%` : "—"}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs">
              <span className="size-2.5 shrink-0 rounded-full bg-chart-5" />
              <span className="text-muted-foreground">膳食纤维</span>
              <span className="ml-auto font-medium tabular-nums">{fmtInt(totals.fiber)} g</span>
            </div>
            {balance && balance.burnExercise > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Dumbbell className="size-3.5" />
                运动消耗 ≈ {balance.burnExercise} kcal(MET 估算,已含在活动系数内,仅参考)
              </div>
            )}
          </div>
        </div>

        {totals.kcal === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs leading-relaxed text-muted-foreground">
            今天还没有饮食记录，上面的数字都是 0。从下方「记录这一餐」开始记一餐，这里会实时汇总。
          </p>
        ) : aiEstimateCount > 0 ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            其中 {aiEstimateCount} 条来自 AI 拍照估算，份量和总量都是近似值，核对后仍建议按区间理解。
          </p>
        ) : null}

        {profile && targets && balance ? (
          <div className="flex flex-col gap-4">
            <MacroBar
              icon={Flame}
              label="热量"
              current={balance.intake}
              target={targets.kcal}
              unit="kcal"
              barClass="bg-chart-3"
              textClass="text-chart-3"
            />
            <MacroBar
              icon={Beef}
              label="蛋白质"
              current={balance.protein}
              target={targets.proteinG}
              unit="g"
              barClass="bg-chart-2"
              textClass="text-chart-2"
            />
            <MacroBar
              icon={Wheat}
              label="碳水"
              current={balance.carb}
              target={targets.carbG}
              unit="g"
              barClass="bg-chart-4"
              textClass="text-chart-4"
            />
            <MacroBar
              icon={Droplets}
              label="脂肪"
              current={balance.fat}
              target={targets.fatG}
              unit="g"
              barClass="bg-chart-1"
              textClass="text-chart-1"
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              目标由身体档案算出:{targets.rationale}
            </p>
          </div>
        ) : (
          <Alert>
            <Info />
            <AlertTitle>还没有身体档案</AlertTitle>
            <AlertDescription>
              先在「档案」页填写性别、年龄、身高、体重和目标,这里才会显示热量与营养素目标对比。
              你仍然可以先记录饮食。
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}