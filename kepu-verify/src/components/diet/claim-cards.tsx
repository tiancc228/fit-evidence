import { useMemo } from "react";
import { BookOpen, ExternalLink, Lightbulb, Quote, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { Claim, Goal } from "@/src/lib/types";
import { GUIDELINE_2022 } from "@/src/lib/calc";
import { applyOverride, useApp } from "@/src/lib/store";
import { CLAIMS } from "@/src/data/knowledge";
import {
  CLAIM_TYPE_LABEL, DIET_CLAIM, LayerTag, ReviewBadge, VerdictBadge, WhyEvidenceButton,
  adviceClaimForGoal, fmtTimeRange, slotClaimId, type MealSlot, type OpenEvidence,
} from "@/src/components/diet/shared";

const DIET_TOPIC_RE = /饮食|营养|蛋白|热量|碳水|脂肪|减脂|增肌|膳食|卡路里|缺口|盈余|代糖|饮料|糖/;

function isDietClaim(c: Claim): boolean {
  return c.layer2.claimType === "diet" || DIET_TOPIC_RE.test(`${c.topic} ${c.topicLabel} ${c.layer2.statement}`);
}

/** 博主原话只展示 ≤60 字短引用,并始终跳转原平台。 */
function shortQuote(q: string): string {
  return q.length > 60 ? `${q.slice(0, 60)}…` : q;
}

function ClaimCard({ claim, onOpenEvidence }: { claim: Claim; onOpenEvidence?: OpenEvidence }) {
  const l1 = claim.layer1;
  const timeRange = fmtTimeRange(l1.startSec, l1.endSec);
  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{claim.topicLabel}</Badge>
          <Badge variant="outline">{CLAIM_TYPE_LABEL[claim.layer2.claimType] ?? claim.layer2.claimType}</Badge>
          <VerdictBadge verdict={claim.layer3.verdict} />
          <ReviewBadge state={claim.review.state} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* 第一层:博主原话 */}
        <section className="flex flex-col gap-2">
          <LayerTag layer="blogger" />
          {l1.quote ? (
            <blockquote className="rounded-lg border-l-2 border-chart-3 bg-muted/40 px-3 py-2">
              <p className="flex items-start gap-1.5 text-sm leading-relaxed">
                <Quote className="mt-0.5 size-3.5 shrink-0 text-chart-3" />
                {shortQuote(l1.quote)}
              </p>
              {l1.source && (
                <footer className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium">{l1.source.author}</span>
                  <span>·</span>
                  <span>{l1.source.platform === "bilibili" ? "B 站" : "抖音"}</span>
                  {timeRange && (
                    <>
                      <span>·</span>
                      <span className="tabular-nums">{timeRange}</span>
                    </>
                  )}
                  <a
                    href={l1.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-chart-3 underline-offset-2 hover:underline"
                  >
                    观看原视频
                    <ExternalLink className="size-3" />
                  </a>
                </footer>
              )}
              {l1.source && (
                <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                  《{l1.source.title}》 · 未经作者授权,禁止转载;此处仅引用短句并跳转原平台
                </p>
              )}
            </blockquote>
          ) : (
            <p className="flex items-start gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              素材不足:{l1.missingReason ?? "未能获取该视频的原话文本,不做猜测。"}
            </p>
          )}
        </section>

        {/* 第二层:AI 拆解结论 */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <LayerTag layer="ai" />
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {claim.layer2.generatedBy === "ai" ? "AI 生成" : "人工整理"}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed">{claim.layer2.statement}</p>
          {claim.layer2.rationale && (
            <p className="text-xs leading-relaxed text-muted-foreground">{claim.layer2.rationale}</p>
          )}
        </section>

        {/* 第三层:科学证据(只给判定与入口,全文在抽屉里) */}
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <LayerTag layer="science" />
            <VerdictBadge verdict={claim.layer3.verdict} />
            <span className="text-[11px] text-muted-foreground">
              文献 {claim.layer3.evidence.length} 篇 · 指南条款 {claim.layer3.guideline.length} 条
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{claim.layer3.verdictReason}</p>
          <div>
            <WhyEvidenceButton
              claimId={claim.id}
              onOpenEvidence={onOpenEvidence}
              source="diet-claim"
              label="看出处与判定"
            />
          </div>
        </section>

        {/* 第四层:产品最终建议 */}
        <section className="flex flex-col gap-2 rounded-lg border border-chart-1/30 bg-chart-1/5 p-3">
          <LayerTag layer="advice" />
          {claim.layer4.advice ? (
            <p className="text-sm leading-relaxed">{claim.layer4.advice}</p>
          ) : (
            <p className="text-xs text-muted-foreground">素材不足:尚未形成最终建议。</p>
          )}
          {(claim.layer4.appliesTo.length > 0 || claim.layer4.notFor.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {claim.layer4.appliesTo.map((a) => (
                <Badge key={a} variant="outline" className="border-chart-2/40 text-[10px] text-chart-2">
                  适用:{a}
                </Badge>
              ))}
              {claim.layer4.notFor.map((a) => (
                <Badge key={a} variant="outline" className="border-destructive/40 text-[10px] text-destructive">
                  不适用:{a}
                </Badge>
              ))}
            </div>
          )}
          {claim.layer4.reviewedBy && (
            <p className="text-[11px] text-muted-foreground">复核:{claim.layer4.reviewedBy}</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

export function DietClaims({ onOpenEvidence }: { onOpenEvidence?: OpenEvidence }) {
  const { state } = useApp();
  const dietClaims = useMemo(
    () =>
      CLAIMS.map((c) => applyOverride(c, state.claimOverrides))
        .filter(isDietClaim),
    [state.claimOverrides],
  );

  if (dietClaims.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen />
          </EmptyMedia>
          <EmptyTitle>饮食类结论素材不足</EmptyTitle>
          <EmptyDescription>
            当前知识库还没有饮食类的博主拆解结论(可能字幕获取失败或尚未复核)。
            下方膳食指南要点仍然可用;我们不会用猜测填补。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        共 {dietClaims.length} 条饮食类结论 · 每条按「博主原话 → AI 拆解 → 科学证据 → 产品建议」四层分开,互不混淆。
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {dietClaims.map((c) => (
          <ClaimCard key={c.id} claim={c} onOpenEvidence={onOpenEvidence} />
        ))}
      </div>
    </div>
  );
}

/** 每餐小贴士:产品建议层;文献与指南正文收进证据抽屉。 */
export function SlotTip({
  slot,
  weightKg,
  onOpenEvidence,
}: {
  slot: MealSlot;
  weightKg: number | null;
  onOpenEvidence?: OpenEvidence;
}) {
  const grain = GUIDELINE_2022.clauses.find((c) => c.key === "grain");
  const veg = GUIDELINE_2022.clauses.find((c) => c.key === "veg");
  const oil = GUIDELINE_2022.clauses.find((c) => c.key === "oil");
  const sugar = GUIDELINE_2022.clauses.find((c) => c.key === "sugar");

  const tips: Record<MealSlot, string> = {
    breakfast:
      `早餐别只吃主食,加一份蛋/奶/瘦肉。蛋白质均匀分到各餐、每餐约 0.4–0.5 g/kg` +
      (weightKg != null ? `(你约 ${Math.round(weightKg * 0.4)}–${Math.round(weightKg * 0.5)} g)` : "") +
      "。",
    lunch: `主食粗细搭配:全天谷类 ${grain?.range ?? "200–300 g"},其中全谷物和杂豆 50–150 g;把部分白米饭换成燕麦、红薯或玉米。`,
    dinner: `全天蔬菜 ${veg?.range ?? "≥300 g"},深色蔬菜占一半以上;晚餐补上白天没吃够的菜,烹调油全天 ${oil?.range ?? "25–30 g"}。`,
    snack: `添加糖每天 ${sugar?.range ?? "<50 g,最好<25 g"};一杯含糖奶茶就可能超标。想喝甜的,优先换无糖饮料。`,
  };

  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-chart-1" />
        <span className="min-w-0 flex-1">{tips[slot]}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <LayerTag layer="advice" />
        <WhyEvidenceButton
          claimId={slotClaimId(slot)}
          onOpenEvidence={onOpenEvidence}
          source="diet-slot"
          label="出处与依据"
        />
      </div>
    </div>
  );
}

/** 页面最后一块:建议的出处入口,统一指向全局证据抽屉。 */
export function AdviceEvidenceCard({
  goal,
  onOpenEvidence,
}: {
  goal: Goal | null;
  onOpenEvidence?: OpenEvidence;
}) {
  const rows = [
    {
      title: "今天的缺口/盈余怎么判断",
      hint: "净热量 = 摄入 − 目标摄入;训练消耗只展示,不参与计算。",
      claimId: goal ? adviceClaimForGoal(goal) : DIET_CLAIM.fatlossDeficit,
    },
    {
      title: "蛋白质目标为什么按体重算",
      hint: "目标由 macroTargets() 按你的身体档案和目标算出,不是固定克数。",
      claimId: DIET_CLAIM.proteinIntake,
    },
    {
      title: "下一餐的主食与蔬菜份量",
      hint: "份量参考《中国居民膳食指南(2022)》的量化条款。",
      claimId: DIET_CLAIM.staple,
    },
    {
      title: "加餐为什么先控添加糖",
      hint: "含糖饮料是很容易被忽略的热量来源。",
      claimId: DIET_CLAIM.sugar,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4 text-chart-2" />
          为什么这样建议
        </CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">
          每条建议都能回到「博主原话 → AI 拆解 → 科学证据 → 产品建议」四层出处;
          点击按钮在右侧抽屉里展开,本页不复制文献全文。
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.claimId} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
            <div>
              <p className="text-sm font-medium">{row.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{row.hint}</p>
            </div>
            <WhyEvidenceButton
              claimId={row.claimId}
              onOpenEvidence={onOpenEvidence}
              source="diet-advice"
            />
          </div>
        ))}
      </CardContent>
      <p className="px-6 text-[11px] leading-relaxed text-muted-foreground">
        未通过人工复核的结论不会作为正式建议依据;没有可核验出处的建议会如实标注「证据不足」,不会用猜测补齐。
      </p>
    </Card>
  );
}

export function GuidelinePanel() {
  const keys = ["grain", "veg", "fruit", "animal", "dairy", "soynut", "oil", "salt", "sugar", "water"];
  const clauses = keys
    .map((k) => GUIDELINE_2022.clauses.find((c) => c.key === k))
    .filter((c): c is NonNullable<typeof c> => c != null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4 text-chart-2" />
          {GUIDELINE_2022.title} · 每日量化要点
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {GUIDELINE_2022.issuer} · {GUIDELINE_2022.publishedAt} · {GUIDELINE_2022.urlNote}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {clauses.map((c) => (
            <div key={c.key} className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{c.range}</p>
              {c.note && <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{c.note}</p>}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {GUIDELINE_2022.eight.map((e) => (
            <Badge key={e} variant="secondary" className="text-[10px] text-muted-foreground">
              {e}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}