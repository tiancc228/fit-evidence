import { AlertTriangle, CheckCircle2, Dumbbell, FolderPlus, Home, Layers, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Level } from "@/src/components/plan/dietEngine";
import { usePlanStore } from "@/src/components/plan/planStore";
import { PLAN_TEMPLATES, buildTemplatePlan, type PlanTemplateDef } from "@/src/components/plan/planTemplates";

const TEMPLATE_ICON: Record<string, typeof Dumbbell> = {
  full: Dumbbell,
  upperlower: Layers,
  ppl: Layers,
  three: Layers,
  five: Layers,
  home: Home,
};

export function TemplatesView({ level, onApplySystem, onOpenMyPlan }: {
  level: Level;
  onApplySystem: (split: "full" | "upperlower" | "ppl" | "three", days: number) => void;
  onOpenMyPlan: () => void;
}) {
  const { state, actions } = usePlanStore();
  const hasCustom = state.plan.days.length > 0;

  function generateCustom(def: PlanTemplateDef) {
    if (def.noviceWarning && level === "novice") {
      const ok = window.confirm(
        "五分化不推荐新手：每个肌群每周只练一次，需要每周稳定 5 天并能按日补练。\n仍要生成可编辑草稿吗？",
      );
      if (!ok) return;
    }
    if (hasCustom && !window.confirm(`会覆盖当前自定义计划（${state.plan.days.length} 个训练日）及其动作，继续？`)) return;
    const plan = buildTemplatePlan(def, level);
    actions.replacePlan(plan, "custom");
    actions.setSource("custom");
    toast.success(`已生成「${def.name}」自定义计划草稿`, {
      description: "可以在「自定义计划」里改动作、组数与重量，再到「我的计划」开始训练。",
    });
    onOpenMyPlan();
  }

  function applySystem(def: PlanTemplateDef) {
    if (!def.systemSplit) return;
    if (def.noviceWarning && level === "novice" && !window.confirm("这套方案不推荐新手，仍要设为系统计划吗？")) return;
    onApplySystem(def.systemSplit, def.systemDays ?? 3);
    actions.setSource("system");
    toast.success(`已把「${def.name}」设为系统计划`, { description: "可在「我的计划」里继续调整或开始训练。" });
    onOpenMyPlan();
  }

  function appendTemplate(templateUid: string) {
    const tpl = state.templates.find((t) => t.uid === templateUid);
    if (!tpl) return;
    actions.appendTemplateDay(tpl);
    actions.setSource("custom");
    toast.success(`已把「${tpl.name}」加入自定义计划`);
    onOpenMyPlan();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-0 rounded-xl py-0">
        <CardHeader className="gap-1 border-b border-border p-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="size-4 text-advice" />
            计划模板
          </CardTitle>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            模板只使用动作库里真实存在的动作。标有「系统分化」的模板可以一键设为我的计划；五分化与居家训练会生成为可编辑的自定义计划草稿，暂时不参与系统自动推荐。
          </p>
        </CardHeader>
      </Card>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        {PLAN_TEMPLATES.map((def) => {
          const Icon = TEMPLATE_ICON[def.id] ?? Dumbbell;
          const noviceConflict = def.noviceWarning === true && level === "novice";
          return (
            <Card key={def.id} className="gap-0 rounded-xl py-0">
              <CardHeader className="gap-2 border-b border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className="size-4 text-advice" />
                    {def.name}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">{def.frequency}</Badge>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">{def.level}</Badge>
                    {def.systemSplit && (
                      <Badge variant="outline" className="border-advice/40 bg-advice-soft text-[10px] text-foreground">系统分化</Badge>
                    )}
                    {def.noviceWarning && (
                      <Badge variant="outline" className="border-warn/40 bg-warn/10 text-[10px] text-warn">进阶 · 不推荐新手</Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{def.summary}</p>
                <div className="flex flex-wrap gap-1">
                  {def.daySpecs.map((d) => (
                    <Badge key={d.name} variant="outline" className="text-[10px] text-muted-foreground">{d.name}</Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 p-4">
                <div>
                  <p className="text-[11px] font-medium">适用条件</p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {def.appliesTo.map((t) => (
                      <li key={t} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-advice" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                {def.notFor && def.notFor.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-destructive">不适用</p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {def.notFor.map((t) => (
                        <li key={t} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-destructive">
                          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {def.caution && (
                  <p className="rounded-md border border-border bg-muted/30 p-2 text-[11px] leading-relaxed text-muted-foreground">
                    {def.caution}
                  </p>
                )}
                {noviceConflict && (
                  <Alert className="border-warn/40 bg-warn/10">
                    <AlertTriangle className="size-4 text-warn" />
                    <AlertTitle>你当前的控制台水平是「新手」</AlertTitle>
                    <AlertDescription>
                      这套方案不默认推荐给新手；如果仍要使用，请先确保每周 5 天出勤与恢复，并优先把动作做标准。
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {def.systemSplit && (
                    <Button size="sm" onClick={() => applySystem(def)}>
                      设为我的计划
                    </Button>
                  )}
                  <Button variant={def.systemSplit ? "outline" : "default"} size="sm" className="gap-1.5" onClick={() => generateCustom(def)}>
                    <FolderPlus className="size-3.5" />
                    生成自定义计划
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="gap-0 rounded-xl py-0">
        <CardHeader className="gap-1 border-b border-border p-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FolderPlus className="size-4 text-advice" />
            我的模板
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            在「自定义计划」里点「保存为模板」，这一天就会出现在这里；加入后可在自定义计划里继续改。
          </p>
        </CardHeader>
        <CardContent className="p-4">
          {state.templates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              还没有保存的模板。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {state.templates.map((tpl) => (
                <li key={tpl.uid} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tpl.name}</p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {tpl.day.name} · {tpl.day.exercises.length} 个动作 · 保存于 {tpl.createdAt}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => appendTemplate(tpl.uid)}>
                      <FolderPlus className="size-3.5" />
                      加入自定义计划
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="删除模板"
                      onClick={() => actions.removeTemplate(tpl.uid)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
