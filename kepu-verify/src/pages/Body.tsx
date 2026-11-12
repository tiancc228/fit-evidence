import * as React from "react";
import {
  PersonStanding,
  Pencil,
  Gauge,
  Percent,
  Flame,
  Activity,
  Dumbbell,
  Ruler,
  Target,
  Info,
  ChevronDown,
  Sparkles,
  ClipboardList,
} from "lucide-react";

import { useApp } from "@/src/lib/store";
import type { Profile } from "@/src/lib/types";
import {
  assessStage,
  bmiBand,
  bodyFatBand,
  bmr,
  tdee,
  macroTargets,
  GOAL_LABEL,
  ACTIVITY_FACTOR,
} from "@/src/lib/calc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ProfileForm } from "@/src/components/body/ProfileForm";
import { BodyDataPanel } from "@/src/components/body/BodyDataPanel";
import { PhotoTimeline } from "@/src/components/body/PhotoTimeline";
import {
  EmptyState,
  InfoNote,
  LayerTag,
  SectionHeading,
  StatTile,
  ToneBadge,
} from "@/src/components/body/shared";

export default function Body() {
  const { state } = useApp();
  const profile = state.profile as Profile | null;
  const [editing, setEditing] = React.useState(false);

  const stage = profile ? assessStage(profile) : null;
  const band = stage ? bmiBand(stage.bmiValue) : null;
  const fatBand = profile && profile.bodyFatPct != null ? bodyFatBand(profile.bodyFatPct, profile.sex) : null;
  const resting = profile ? bmr(profile.sex, profile.weightKg, profile.heightCm, profile.age) : 0;
  const total = profile ? tdee(profile) : 0;
  const target = profile ? macroTargets(profile) : null;

  const showForm = !profile || editing;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <header className="rise space-y-3">
        <div className="energy-line h-1 w-28 rounded-full" aria-hidden />
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-chart-1 to-chart-5 text-primary-foreground shadow-sm">
            <PersonStanding className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">身体状态评估</h1>
            <p className="text-sm text-muted-foreground">先搞清楚自己在哪一站，再决定往哪走。</p>
          </div>
        </div>
      </header>

      {/* 资料录入 */}
      <Card className="rise" style={{ animationDelay: "60ms" }}>
        <CardHeader>
          <SectionHeading
            icon={ClipboardList}
            title={profile ? "你的资料" : "第一步：填写资料"}
            desc={profile ? "资料变了，评估和目标会自动重算。" : "填写下面 9 项，就能得到 BMI、代谢、阶段判断和营养目标。"}
            right={
              profile ? (
                <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
                  <Pencil className="size-4" />
                  {editing ? "收起" : "编辑资料"}
                  <ChevronDown className={cn("size-4 transition-transform", editing && "rotate-180")} />
                </Button>
              ) : null
            }
          />
        </CardHeader>
        {showForm ? (
          <CardContent>
            <ProfileForm onSaved={() => setEditing(false)} />
          </CardContent>
        ) : profile ? (
          <CardContent>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <SummaryItem label="姓名" value={profile.name} />
              <SummaryItem label="性别" value={profile.sex === "male" ? "男" : "女"} />
              <SummaryItem label="年龄" value={`${profile.age} 岁`} />
              <SummaryItem label="身高" value={`${profile.heightCm} cm`} />
              <SummaryItem label="体重" value={`${profile.weightKg} kg`} />
              <SummaryItem label="体脂" value={profile.bodyFatPct != null ? `${profile.bodyFatPct}%` : "未测"} />
              <SummaryItem label="活动量" value={ACTIVITY_FACTOR[profile.activity].label} />
              <SummaryItem label="目标" value={GOAL_LABEL[profile.goal]} />
              <SummaryItem label="每周训练" value={`${profile.trainingDaysPerWeek} 天`} />
            </div>
          </CardContent>
        ) : null}
      </Card>

      {/* 自动评估 */}
      {!profile || !stage || !band ? (
        <EmptyState
          icon={Gauge}
          title="评估将在填写资料后生成"
          desc="我们会用中国成人 BMI 标准、Mifflin-St Jeor 代谢公式和体脂参考区间，给你一份能看懂的身体报告。"
        />
      ) : (
        <>
          <Card className="rise overflow-hidden border-chart-1/30 bg-gradient-to-br from-chart-1/15 via-chart-4/10 to-chart-2/15" style={{ animationDelay: "100ms" }}>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <LayerTag kind="calc" />
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="size-3" />
                  阶段判断
                </Badge>
                <Badge variant="outline">{GOAL_LABEL[profile.goal]}目标</Badge>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-3xl font-semibold tracking-tight">{stage.stage}</h2>
                <p className="text-base font-medium text-foreground/90">{stage.headline}</p>
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{stage.detail}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {stage.priority.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-chart-2/40 bg-chart-2/10 px-3 py-1 text-xs font-medium text-chart-2">
                    <Target className="size-3" />
                    {p}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="rise grid gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ animationDelay: "140ms" }}>
            <StatTile
              icon={Gauge}
              label="BMI 身体质量指数"
              value={stage.bmiValue}
              tone={band.tone}
              hint={
                <span>
                  体重÷身高²。中国成人标准：&lt;18.5 偏瘦、18.5–24 正常、24–28 超重、≥28 肥胖。你属于
                  <ToneBadge tone={band.tone} className="ml-1 align-middle">{band.label}</ToneBadge>
                </span>
              }
            />
            <StatTile
              icon={Percent}
              label="体脂率"
              value={profile.bodyFatPct != null ? profile.bodyFatPct : "未测"}
              unit={profile.bodyFatPct != null ? "%" : undefined}
              tone={fatBand?.tone}
              accent="bg-muted-foreground/40"
              hint={
                profile.bodyFatPct != null && fatBand ? (
                  <span>
                    脂肪占体重的百分比。男性必需脂肪约 5%、女性约 13%，低于会伤身。你属于
                    <ToneBadge tone={fatBand.tone} className="ml-1 align-middle">{fatBand.label}</ToneBadge>
                  </span>
                ) : (
                  "素材不足：未填写体脂率。可在「编辑资料」或下方每日数据补充；没有体脂秤，用体重+围度也能跟踪。"
                )
              }
            />
            <StatTile
              icon={Flame}
              label="基础代谢 BMR"
              value={resting}
              unit="kcal/天"
              accent="bg-chart-1"
              hint="全天静卧不动也会消耗的热量（Mifflin-St Jeor 公式）。它是制定摄入目标的地基。"
            />
            <StatTile
              icon={Activity}
              label="每日总消耗 TDEE"
              value={total}
              unit="kcal/天"
              accent="bg-chart-5"
              hint={`基础代谢 × 活动系数 ${ACTIVITY_FACTOR[profile.activity].factor}（${ACTIVITY_FACTOR[profile.activity].label}）。约等于你每天实际总消耗，是吃多吃少的参照线。`}
            />
            <StatTile
              icon={Dumbbell}
              label="瘦体重"
              value={stage.leanMassKg != null ? stage.leanMassKg : "—"}
              unit={stage.leanMassKg != null ? "kg" : undefined}
              accent="bg-chart-2"
              hint={stage.leanMassKg != null ? "体重减去脂肪的重量（肌肉、骨骼、水分等）。增肌期重点看它有没有涨。" : "素材不足：需要体脂率才能算出瘦体重。"}
            />
            <StatTile
              icon={Ruler}
              label="去脂体重指数 FFMI"
              value={stage.ffmi != null ? stage.ffmi : "—"}
              accent="bg-chart-3"
              hint={stage.ffmi != null ? "瘦体重÷身高²，衡量相对肌肉量。追踪它的变化，比单看体重更能反映增肌效果。" : "素材不足：需要体脂率才能计算 FFMI。"}
            />
          </div>

          {target ? (
            <Card className="rise" style={{ animationDelay: "180ms" }}>
              <CardHeader>
                <SectionHeading
                  icon={Target}
                  title="你的每日营养目标"
                  desc="由 TDEE 按目标调整而来，在「今日总览」页可以看到每天的实际达标情况。"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile icon={Flame} label="目标摄入" value={target.kcal} unit="kcal" accent="bg-chart-1" hint={`相对维持热量 ${target.delta >= 0 ? "+" : ""}${target.delta} kcal（${target.deltaPct >= 0 ? "+" : ""}${target.deltaPct}%）`} />
                  <StatTile icon={Dumbbell} label="蛋白质" value={target.proteinG} unit="g" accent="bg-chart-2" hint={`约 ${target.proteinPerKg} g/kg 体重`}/>
                  <StatTile icon={Activity} label="碳水" value={target.carbG} unit="g" accent="bg-chart-4" hint={`约 ${target.carbPerKg} g/kg 体重`}/>
                  <StatTile icon={Percent} label="脂肪" value={target.fatG} unit="g" accent="bg-chart-5" hint="不低于总热量的约 20%，保护激素水平"/>
                </div>
                <InfoNote icon={Info}>
                  <span className="font-medium text-foreground">为什么是这个数？</span> {target.rationale} 建议速率：{target.weeklyRateKg}。
                </InfoNote>
              </CardContent>
            </Card>
          ) : null}

          <InfoNote icon={Info}>
            以上为基于通用公式与人群参考标准的估算，不能替代医生或注册营养师的个体化诊断。若有慢性病、孕产、未成年或进食障碍史，请先咨询专业人士再调整饮食与训练。
          </InfoNote>
        </>
      )}

      <BodyDataPanel />
      <PhotoTimeline />
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}
