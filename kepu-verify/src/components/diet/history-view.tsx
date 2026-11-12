import { useMemo, useState } from "react";
import { Bot, CalendarDays, ChevronDown, Eye, History, Trash2 } from "lucide-react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { MealEntry } from "@/src/lib/types";
import { addDays, macroTargets, today } from "@/src/lib/calc";
import { useApp } from "@/src/lib/store";
import {
  PhotoPreviewDialog, SLOT_META, SLOT_ORDER, fmtInt, useDeleteMeal,
} from "@/src/components/diet/shared";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function weekday(date: string): string {
  return WEEKDAYS[new Date(date + "T00:00:00").getDay()];
}

function relLabel(date: string): string | null {
  if (date === today()) return "今天";
  if (date === addDays(today(), -1)) return "昨天";
  return null;
}

export function MealRow({ entry, onPreview }: { entry: MealEntry; onPreview: (photoId: string) => void }) {
  const deleteMeal = useDeleteMeal();
  const { state } = useApp();
  const photo = entry.photoId ? state.photos.find((p) => p.id === entry.photoId) : null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      {photo && (
        <button
          type="button"
          onClick={() => onPreview(photo.id)}
          className="size-9 shrink-0 overflow-hidden rounded-lg"
          aria-label="查看餐食照片"
        >
          <img src={photo.dataUrl} alt={photo.label} className="size-full object-cover" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-medium">{entry.label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{fmtInt(entry.grams)} g</span>
          {entry.source === "ai" && (
            <Badge variant="outline" className="border-chart-4/40 bg-chart-4/10 text-[10px] text-chart-4">
              <Bot className="size-3" />
              AI 估算
            </Badge>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          蛋白 {fmtInt(entry.protein)} · 碳水 {fmtInt(entry.carb)} · 脂肪 {fmtInt(entry.fat)} g
          {entry.note ? ` · ${entry.note}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {entry.source === "ai" ? "≈ " : ""}{fmtInt(entry.kcal)} kcal
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`删除 ${entry.label}`}
        onClick={() => deleteMeal(entry)}
      >
        <Trash2 className="size-4 text-muted-foreground" />
      </Button>
    </div>
  );
}

export function HistoryView({ onJump }: { onJump: (date: string) => void }) {
  const { state } = useApp();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(null);

  const target = state.profile ? macroTargets(state.profile).kcal : null;

  const trend = useMemo(() => {
    const end = today();
    const days: { date: string; label: string; kcal: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(end, -i);
      const kcal = Math.round(state.meals.filter((m) => m.date === d).reduce((s, m) => s + m.kcal, 0));
      days.push({ date: d, label: d.slice(5).replace("-", "/"), kcal });
    }
    return days;
  }, [state.meals]);

  const byDate = useMemo(() => {
    const map = new Map<string, MealEntry[]>();
    for (const m of state.meals) {
      const arr = map.get(m.date) ?? [];
      arr.push(m);
      map.set(m.date, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [state.meals]);

  if (state.meals.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>还没有饮食历史</EmptyTitle>
          <EmptyDescription>
            在「当日记录」里记一餐后,这里会按日期汇总,并画出最近 14 天的热量趋势。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-chart-3" />
            最近 14 天热量趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  interval={1}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  formatter={(value) => [`${value} kcal`, "摄入"]}
                />
                {target != null && (
                  <ReferenceLine
                    y={target}
                    stroke="var(--chart-1)"
                    strokeDasharray="4 4"
                    label={{ value: `目标 ${target}`, position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }}
                  />
                )}
                <Bar dataKey="kcal" fill="var(--chart-3)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            没有记录的日子显示为 0,不代表当天真的没吃。{target == null ? "建立档案后显示目标线。" : ""}
            带「AI 估算」的条目为近似值。
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {byDate.map(([date, meals]) => {
          const kcal = Math.round(meals.reduce((s, m) => s + m.kcal, 0));
          const protein = meals.reduce((s, m) => s + m.protein, 0);
          const hasAi = meals.some((m) => m.source === "ai");
          const open = openDate === date;
          return (
            <Card key={date} className="gap-3 py-4">
              <Collapsible open={open} onOpenChange={(o) => setOpenDate(o ? date : null)}>
                <CardHeader className="px-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                      <span className="text-sm font-semibold tabular-nums">{date}</span>
                      <span className="text-xs text-muted-foreground">{weekday(date)}</span>
                      {relLabel(date) && <Badge variant="secondary">{relLabel(date)}</Badge>}
                    </CollapsibleTrigger>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {meals.length} 条 · {hasAi ? "≈ " : ""}{kcal} kcal · 蛋白 {fmtInt(protein)} g
                    </span>
                    <Button variant="outline" size="sm" onClick={() => onJump(date)}>
                      <Eye className="size-4" />
                      查看当日
                    </Button>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="flex flex-col gap-3 px-4">
                    {SLOT_ORDER.map((slot) => {
                      const slotMeals = meals.filter((m) => m.slot === slot);
                      if (slotMeals.length === 0) return null;
                      const Meta = SLOT_META[slot];
                      const Icon = Meta.icon;
                      const sub = Math.round(slotMeals.reduce((s, m) => s + m.kcal, 0));
                      const slotAi = slotMeals.some((m) => m.source === "ai");
                      return (
                        <div key={slot} className="flex flex-col gap-1.5">
                          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Icon className="size-3.5" />
                            {Meta.label}
                            <span className="ml-auto tabular-nums">{slotAi ? "≈ " : ""}{sub} kcal</span>
                          </p>
                          {slotMeals.map((m) => (
                            <MealRow key={m.id} entry={m} onPreview={setPreviewId} />
                          ))}
                        </div>
                      );
                    })}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      <PhotoPreviewDialog photoId={previewId} onOpenChange={(o) => !o && setPreviewId(null)} />
    </div>
  );
}