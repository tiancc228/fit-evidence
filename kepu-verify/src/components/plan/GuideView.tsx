import { Activity, Dumbbell, ListChecks, Target, Timer, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { GUIDELINE_2022 } from "@/src/lib/calc";
import { LayerTag } from "@/src/components/form/bits";

export const CHECK_ITEMS = [
  { id: "warmup", label: "训练前 5–10 分钟热身，目标动作先用轻重量做 2 组" },
  { id: "rir", label: "每组留 2–3 次余力（RIR 2–3），动作变形就停" },
  { id: "log", label: "记录重量 / 次数 / 感受，下周据此渐进" },
  { id: "sleep", label: "睡够 7–9 小时，作息尽量固定" },
  { id: "pain", label: "出现疼痛 / 麻木立即停止，必要时就医" },
] as const;

export function GuideView({ checks, onCheck }: {
  checks: Record<string, boolean>;
  onCheck: (id: string, value: boolean) => void;
}) {
  return (
    <>
      <Card className="gap-0 rounded-xl py-0">
        <CardHeader className="gap-1 border-b border-border p-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="size-4 text-advice" />
            身体活动量（指南原文）
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            {GUIDELINE_2022.issuer} · {GUIDELINE_2022.publishedAt} · {GUIDELINE_2022.urlNote}
          </p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { icon: TrendingUp, label: "有氧", text: GUIDELINE_2022.activity.aerobic },
              { icon: Dumbbell, label: "抗阻", text: GUIDELINE_2022.activity.resistance },
              { icon: Target, label: "步数", text: GUIDELINE_2022.activity.steps },
              { icon: Timer, label: "久坐", text: GUIDELINE_2022.activity.sedentary },
            ].map((x) => (
              <div key={x.label} className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-advice-soft text-advice">
                  <x.icon className="size-3.5" />
                </span>
                <div>
                  <p className="text-xs font-medium">{x.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{x.text}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 rounded-xl py-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border p-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListChecks className="size-4 text-science" />
            今日执行清单
          </CardTitle>
          <span className="text-xs tabular-nums text-muted-foreground">
            {CHECK_ITEMS.filter((c) => checks[c.id]).length} / {CHECK_ITEMS.length}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 p-4">
          {CHECK_ITEMS.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card p-2.5 text-xs leading-relaxed hover:bg-muted/40">
              <Checkbox
                checked={checks[c.id] ?? false}
                onCheckedChange={(v) => onCheck(c.id, v === true)}
                className="mt-0.5"
                aria-label={c.label}
              />
              <span className={cn(checks[c.id] && "text-muted-foreground line-through")}>{c.label}</span>
            </label>
          ))}
          <p className="mt-1 text-[11px] text-muted-foreground">清单按日期保存在本机，第二天自动清空。</p>
        </CardContent>
      </Card>

      <Card className="gap-0 rounded-xl py-0">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-sm">本页如何标注出处（四层分开，绝不混为一谈）</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1"><LayerTag n={1} className="w-fit" />博主视频里的原话短引用，附作者、原视频链接与时间点。</div>
            <div className="flex flex-col gap-1"><LayerTag n={2} className="w-fit" />AI 从原话拆解出的结论，需人工复核后才算数。</div>
            <div className="flex flex-col gap-1"><LayerTag n={3} className="w-fit" />真实文献 / 指南核对结果，附 DOI / PMID 可查证。</div>
            <div className="flex flex-col gap-1"><LayerTag n={4} className="w-fit" />产品给你的最终建议；训练组数、次数与负重均属此层。</div>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            所有视频与文献均来自已抓取的真实来源清单，按 bvid / DOI 精确取用；拿不到的数据如实标注「素材不足」。视频版权归原作者所有，本页仅保存来源信息并提供跳转，不存储或转载视频内容。
          </p>
        </CardContent>
      </Card>
    </>
  );
}
