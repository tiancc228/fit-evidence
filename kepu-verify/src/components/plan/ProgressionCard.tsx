import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductAdviceTag } from "@/src/components/form/bits";

export function ProgressionCard() {
  return (
    <Card className="gap-0 rounded-xl py-0">
      <CardHeader className="gap-1 border-b border-border p-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="size-4 text-advice" />
          渐进超负荷怎么加
          <ProductAdviceTag />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ol className="grid gap-2 text-xs leading-relaxed sm:grid-cols-2">
          {[
            "第 1–2 周：用估算区间下限，把动作做标准，每组留 2–3 次余力。",
            "能完成目标次数上限：下次加 2.5 kg（上肢）或 5 kg（下肢），次数回到区间下限。",
            "每 4–6 周安排一个减载周：组数减半、重量降 10%–20%，让关节与神经恢复。",
            "疼痛、麻木或动作变形：立即停止该动作，回到更轻重量或换动作，必要时就医。",
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-advice-soft text-[10px] font-semibold tabular-nums text-advice">
                {i + 1}
              </span>
              {t}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          以上为产品训练建议，依据见「依据出处」中的新手适应、训练容量与力竭训练条目；博主原话与文献结论分层标注，不与本建议混写。
        </p>
      </CardContent>
    </Card>
  );
}
