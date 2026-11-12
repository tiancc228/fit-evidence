import {
  Download, Minus, Plus, RotateCcw, Save, Shuffle, SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { GOAL_LABEL } from "@/src/lib/calc";
import type { PlanConfig, SplitKind } from "@/src/components/plan/dietEngine";
import { SPLIT_LABEL } from "@/src/components/plan/trainingEngine";
import { ConsoleRow } from "@/src/components/plan/ui";

export type SetPlanConfig = <K extends keyof PlanConfig>(key: K, value: PlanConfig[K]) => void;

export function PlanConsole({ config, set, split, onlyConfirmed, onOnlyConfirmedChange, reviewCounts, profileDirty, onReset, onRandom, onExport, onSave }: {
  config: PlanConfig;
  set: SetPlanConfig;
  split: Exclude<SplitKind, "auto">;
  onlyConfirmed: boolean;
  onOnlyConfirmedChange: (v: boolean) => void;
  reviewCounts: { ai_extracted: number; pending_review: number; human_confirmed: number; published: number };
  profileDirty: boolean;
  onReset: () => void;
  onRandom: () => void;
  onExport: () => void;
  onSave: () => void;
}) {
  return (
    <Card className="gap-0 rounded-xl py-0 lg:sticky lg:top-20">
      <CardHeader className="gap-1 border-b border-border p-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <SlidersHorizontal className="size-4 text-advice" />
          训练控制台
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">拖动或选择即刻重算，不需要点「生成」。</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">训练</p>
          <ConsoleRow label="目标" hint={GOAL_LABEL[config.goal]}>
            <NativeSelect value={config.goal} onChange={(e) => set("goal", e.target.value as PlanConfig["goal"])} className="w-full" aria-label="计划目标">
              <NativeSelectOption value="muscle">增肌</NativeSelectOption>
              <NativeSelectOption value="fatloss">减脂</NativeSelectOption>
              <NativeSelectOption value="recomp">塑形 / 重塑</NativeSelectOption>
            </NativeSelect>
          </ConsoleRow>
          <ConsoleRow label="每周训练天数" hint={`${config.trainingDays} 天`}>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" aria-label="减少一天" onClick={() => set("trainingDays", Math.max(1, config.trainingDays - 1))}>
                <Minus className="size-3.5" />
              </Button>
              <Slider value={[config.trainingDays]} min={1} max={6} step={1} aria-label="每周训练天数" className="flex-1"
                onValueChange={(v) => set("trainingDays", v[0] ?? config.trainingDays)} />
              <Button variant="outline" size="icon-sm" aria-label="增加一天" onClick={() => set("trainingDays", Math.min(6, config.trainingDays + 1))}>
                <Plus className="size-3.5" />
              </Button>
            </div>
          </ConsoleRow>
          <ConsoleRow label="训练水平">
            <NativeSelect value={config.level} onChange={(e) => set("level", e.target.value as PlanConfig["level"])} className="w-full" aria-label="训练水平">
              <NativeSelectOption value="novice">新手（先学动作）</NativeSelectOption>
              <NativeSelectOption value="intermediate">进阶（已有基础）</NativeSelectOption>
            </NativeSelect>
          </ConsoleRow>
          <ConsoleRow label="分化方式" hint={SPLIT_LABEL[split]}>
            <NativeSelect value={config.split} onChange={(e) => set("split", e.target.value as SplitKind)} className="w-full" aria-label="分化方式">
              <NativeSelectOption value="auto">自动（按天数推荐）</NativeSelectOption>
              <NativeSelectOption value="full">全身训练</NativeSelectOption>
              <NativeSelectOption value="upperlower">上下肢分化</NativeSelectOption>
              <NativeSelectOption value="ppl">推 / 拉 / 腿</NativeSelectOption>
              <NativeSelectOption value="three">三分化（胸 / 背 / 腿）</NativeSelectOption>
            </NativeSelect>
          </ConsoleRow>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">依据</p>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="only-confirmed" className="text-xs leading-snug">
              只看已人工确认 / 已发布的依据
            </Label>
            <Switch id="only-confirmed" checked={onlyConfirmed} onCheckedChange={onOnlyConfirmedChange} />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            当前 {reviewCounts.published} 条已发布、{reviewCounts.human_confirmed} 条已确认、
            {reviewCounts.pending_review + reviewCounts.ai_extracted} 条仍在审核中。未发布内容只作参考。
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onReset}>
              <RotateCcw className="size-3.5" />
              重置
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRandom}>
              <Shuffle className="size-3.5" />
              随机试算
            </Button>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onExport}>
            <Download className="size-3.5" />
            导出 Markdown 训练计划
          </Button>
          <Button size="sm" className="gap-1.5" disabled={!profileDirty} onClick={onSave}>
            <Save className="size-3.5" />
            {profileDirty ? "把目标 / 天数写入档案" : "已与档案一致"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
