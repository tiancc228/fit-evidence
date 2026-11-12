import {
  Beef, Droplets, Flame, Minus, Scale, TrendingDown, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Profile } from "@/src/lib/types";
import { GOAL_LABEL, tdee, type DayBalance, type MacroTarget } from "@/src/lib/calc";
import {
  LayerTag, WhyEvidenceButton, adviceClaimForGoal, fmtInt, type OpenEvidence,
} from "@/src/components/diet/shared";

/** 常用估算常数:约 7700 kcal 对应 1 kg 脂肪组织能量。仅用于趋势估算。 */
const KCAL_PER_KG = 7700;

export function BalanceCard({
  profile,
  balance,
  targets,
  unknownMetCount,
  onOpenEvidence,
}: {
  profile: Profile;
  balance: DayBalance;
  targets: MacroTarget;
  unknownMetCount: number;
  onOpenEvidence?: OpenEvidence;
}) {
  const tdeeVal = tdee(profile);
  const maintenance = balance.maintenance ?? tdeeVal;
  // 活动系数已含训练，摄入不再扣运动消耗；运动消耗只作展示。
  const vsMaint = balance.intake - maintenance;
  const diff = -balance.net; // >0 需要多吃,<0 需要少吃

  const weeklyKg = Math.abs(vsMaint) * 7 / KCAL_PER_KG;
  const rateLo = profile.weightKg * 0.005;
  const rateHi = profile.weightKg * 0.01;
  const gainLo = profile.weightKg * 0.0025;
  const gainHi = profile.weightKg * 0.005;

  const tone =
    profile.goal === "fatloss"
      ? balance.verdict === "deficit" ? "good" : balance.verdict === "surplus" ? "bad" : "mid"
      : profile.goal === "muscle"
        ? balance.verdict === "surplus" ? "good" : balance.verdict === "deficit" ? "bad" : "mid"
        : balance.verdict === "balanced" ? "good" : "mid";

  const toneClass = tone === "good" ? "text-chart-2" : tone === "bad" ? "text-destructive" : "text-chart-4";
  const VerdictIcon = balance.verdict === "deficit" ? TrendingDown : balance.verdict === "surplus" ? TrendingUp : Minus;

  const fatGap = targets.fatG - balance.fat;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Scale className="size-4 text-chart-3" />
            今日能量判断
          </span>
          <Badge variant="secondary">{GOAL_LABEL[profile.goal]}目标</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* 计算结果 */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <VerdictIcon className={cn("size-8 shrink-0", toneClass)} />
            <div className="min-w-0">
              <p className={cn("text-2xl font-bold tabular-nums", toneClass)}>
                {balance.net > 0 ? "+" : ""}{balance.net} kcal
              </p>
              <p className="text-sm text-muted-foreground">
                {balance.verdictLabel} · 相对今日目标 {targets.kcal} kcal
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground tabular-nums">
            摄入 {balance.intake} − 目标 {targets.kcal} = {balance.net} kcal。
            对比维持热量(TDEE {maintenance} kcal):{vsMaint >= 0 ? "盈余" : "缺口"} {Math.abs(vsMaint)} kcal。
            训练消耗 {balance.burnExercise} kcal 已包含在活动系数里，仅作展示，不重复扣减。
          </p>
          {unknownMetCount > 0 && (
            <p className="mt-1 text-[11px] text-chart-4">
              有 {unknownMetCount} 条训练缺少代谢当量(MET)数据,未计入运动消耗。
            </p>
          )}
        </div>

        <p className="text-sm leading-relaxed">{balance.advice}</p>

        <Separator />

        {/* 目标专属评估 */}
        <div className="flex flex-col gap-2">
          <LayerTag layer="advice" />
          {profile.goal === "fatloss" && (
            vsMaint < 0 ? (
              <p className="text-sm leading-relaxed">
                按今天的吃法估算，每周约减 <span className="font-semibold tabular-nums">{weeklyKg.toFixed(2)} kg</span>
                (你的推荐区间:每周 {rateLo.toFixed(2)}–{rateHi.toFixed(2)} kg,即体重的 0.5%–1%)。
                {weeklyKg > rateHi
                  ? " 速度偏快:减重越快,流失肌肉的风险越高,建议把每日缺口收小一点。"
                  : weeklyKg < rateLo
                    ? " 速度偏慢,减脂周期会拉长;可小幅加大缺口或增加日常活动。"
                    : " 速度在推荐区间内,能较好地在减脂的同时保住肌肉。"}
              </p>
            ) : (
              <p className="text-sm leading-relaxed">
                今天相对维持热量仍是盈余 {vsMaint} kcal,没有形成缺口——按这样的吃法体重不会下降。
                推荐节奏:每周减 {rateLo.toFixed(2)}–{rateHi.toFixed(2)} kg(体重的 0.5%–1%),
                对应每天约 {Math.round((rateLo * KCAL_PER_KG) / 7)}–{Math.round((rateHi * KCAL_PER_KG) / 7)} kcal 缺口。
              </p>
            )
          )}
          {profile.goal === "muscle" && (
            vsMaint > 0 ? (
              <p className="text-sm leading-relaxed">
                按今天的吃法估算，每周约增 <span className="font-semibold tabular-nums">{weeklyKg.toFixed(2)} kg</span>
                (新手增肌建议区间:每周 {gainLo.toFixed(2)}–{gainHi.toFixed(2)} kg,即体重的 0.25%–0.5%)。
                {weeklyKg > gainHi
                  ? " 盈余偏大:增肌需要适度盈余,但长期过大的盈余会让脂肪增长占比明显上升,建议把每日热量降回目标附近。"
                  : weeklyKg < gainLo
                    ? " 盈余偏小,增重速度慢,可以再加一点主食。"
                    : " 盈余幅度合理,配合渐进超负荷训练即可。"}
              </p>
            ) : (
              <p className="text-sm leading-relaxed">
                今天相对维持热量仍是缺口 {Math.abs(vsMaint)} kcal,没有形成盈余——增肌需要适度盈余,
                建议每天吃到目标热量 {targets.kcal} kcal 以上(约 +{Math.round((gainLo * KCAL_PER_KG) / 7)}–{Math.round((gainHi * KCAL_PER_KG) / 7)} kcal)。
              </p>
            )
          )}
          {profile.goal === "recomp" && (
            <p className="text-sm leading-relaxed">
              重塑期建议维持在 TDEE 附近(今天 {vsMaint >= 0 ? "盈余" : "缺口"} {Math.abs(vsMaint)} kcal),
              体重变化可能不明显,重点看力量与围度。蛋白质分到每餐(每餐约 0.4–0.5 g/kg,
              你约 {Math.round(profile.weightKg * 0.4)}–{Math.round(profile.weightKg * 0.5)} g/餐)。
            </p>
          )}
        </div>

        {/* 缺口一览:只给数字,不在这里折算单一食物 */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">今天还差多少</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Flame className="size-3.5 text-chart-3" />
                热量
              </p>
              <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", diff < 0 && "text-destructive")}>
                {diff > 0 ? `还差 ${fmtInt(diff)}` : diff < 0 ? `已超 ${fmtInt(-diff)}` : "正好达标"}
                {diff !== 0 && <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">kcal</span>}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Beef className="size-3.5 text-chart-2" />
                蛋白质
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {balance.proteinGap > 0
                  ? `还差 ${fmtInt(balance.proteinGap)}`
                  : balance.proteinGap < 0
                    ? `已超 ${fmtInt(-balance.proteinGap)}`
                    : "已达标"}
                {balance.proteinGap !== 0 && <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">g</span>}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Droplets className="size-3.5 text-chart-1" />
                脂肪
              </p>
              <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", fatGap < 0 && "text-destructive")}>
                {fatGap > 0 ? `余量 ${fmtInt(fatGap)}` : fatGap < 0 ? `已超 ${fmtInt(-fatGap)}` : "正好达标"}
                {fatGap !== 0 && <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">g</span>}
              </p>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            具体吃什么写在下面的「下一餐建议」里：按剩余热量、蛋白质缺口和脂肪余量挑真实组合，
            不再把缺口折算成「几碗米饭」这种单一食物。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <WhyEvidenceButton
            claimId={adviceClaimForGoal(profile.goal)}
            onOpenEvidence={onOpenEvidence}
            source="diet-balance"
          />
          <span className="text-[11px] text-muted-foreground">
            出处链(博主原话 → AI 拆解 → 科学证据 → 产品建议)在抽屉里展开，本页不复制文献全文。
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          注:每周体重变化按约 {KCAL_PER_KG} kcal ≈ 1 kg 脂肪估算,单日数据波动大,请以周平均趋势为准。
          以上建议不构成医疗意见;有基础疾病请先咨询医生或注册营养师。
        </p>
      </CardContent>
    </Card>
  );
}