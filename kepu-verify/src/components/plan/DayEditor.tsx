import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Replace, Save, Trash2 } from "lucide-react";
import { EXERCISE_BY_ID } from "@/src/data/exercises";
import { loadCategory } from "@/src/components/plan/trainingEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CustomDay, CustomItem, usePlanStore } from "@/src/components/plan/planStore";
import { ExercisePicker } from "@/src/components/plan/ExercisePicker";

type PlanActions = ReturnType<typeof usePlanStore>["actions"];
type PickerState = null | { kind: "add" } | { kind: "replace"; itemUid: string; part: string };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

/** 数字输入：空字符串在允许为空的字段里表示「未设定」，绝不自动补公斤数。 */
function NumField({ label, value, onChange, min, max, nullable = false, placeholder, hint, className }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min: number;
  max: number;
  nullable?: boolean;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-16 flex-col gap-1", className)}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        inputMode="decimal"
        className="h-8 tabular-nums"
        value={value == null ? "" : String(value)}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            if (nullable) onChange(null);
            return;
          }
          const n = Number(raw);
          if (!Number.isFinite(n)) return;
          onChange(clamp(n, min, max));
        }}
      />
      {hint && <span className="text-[10px] leading-none text-muted-foreground">{hint}</span>}
    </div>
  );
}

function defaultItem(exerciseId: string): Omit<CustomItem, "uid"> {
  const ex = EXERCISE_BY_ID.get(exerciseId);
  const cat = ex ? loadCategory(ex) : "isolation";
  const isIsolation = cat === "isolation";
  const isCore = cat === "core";
  return {
    exerciseId,
    sets: 3,
    repsLow: isCore ? 15 : isIsolation ? 10 : 8,
    repsHigh: isCore ? 20 : isIsolation ? 15 : 12,
    weightKg: null,
    rpe: null,
    rir: null,
    restSec: isCore ? 60 : isIsolation ? 60 : 120,
  };
}

export function DayEditor({ day, actions }: { day: CustomDay; actions: PlanActions }) {
  const [picker, setPicker] = useState<PickerState>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function addExercise(exerciseId: string) {
    actions.addExercise(day.uid, defaultItem(exerciseId));
    setPicker(null);
  }

  function replace(itemUid: string, exerciseId: string) {
    actions.replaceExercise(day.uid, itemUid, exerciseId);
    setPicker(null);
  }

  function saveTemplate() {
    const name = window.prompt("模板名称", `${day.name} 模板`);
    if (name == null) return;
    actions.saveDayAsTemplate(day.uid, name);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">训练日名称</Label>
          <Input
            value={day.name}
            onChange={(e) => actions.renameDay(day.uid, e.target.value)}
            className="h-8"
            aria-label="训练日名称"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPicker({ kind: "add" })}>
            <Plus className="size-3.5" />
            添加动作
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={saveTemplate}>
            <Save className="size-3.5" />
            保存为模板
          </Button>
        </div>
      </div>

      {picker?.kind === "add" && (
        <ExercisePicker title="从动作库添加" onPick={(ex) => addExercise(ex.id)} onClose={() => setPicker(null)} />
      )}
      {picker?.kind === "replace" && (
        <ExercisePicker
          title="替换动作（默认同部位）"
          defaultPart={picker.part}
          onPick={(ex) => replace(picker.itemUid, ex.id)}
          onClose={() => setPicker(null)}
        />
      )}

      {day.exercises.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          这个训练日还没有动作。点「添加动作」从动作库选择；动作库里的动作都会出现，没有视频来源的也不会被隐藏。
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {day.exercises.map((item, index) => {
            const ex = EXERCISE_BY_ID.get(item.exerciseId);
            const cat = ex ? loadCategory(ex) : "isolation";
            const isBodyweight = cat === "bodyweight" || cat === "core";
            return (
              <li
                key={item.uid}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex != null && dragIndex !== index) actions.moveExercise(day.uid, dragIndex, index);
                  setDragIndex(null);
                }}
                className={cn("rounded-lg border border-border bg-card p-3", dragIndex === index && "border-advice/60")}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <button
                      type="button"
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragEnd={() => setDragIndex(null)}
                      className="mt-0.5 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted"
                      aria-label={`拖动排序 ${ex?.name ?? "动作"}`}
                      title="拖动排序"
                    >
                      <GripVertical className="size-4" />
                    </button>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                        <span className="tabular-nums text-muted-foreground">{index + 1}.</span>
                        {ex?.name ?? item.exerciseId}
                        {ex && <span className="text-[10px] font-normal text-muted-foreground">{ex.nameEn}</span>}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {ex && <Badge variant="secondary" className="text-[10px]">{ex.part}</Badge>}
                        {ex && <Badge variant="outline" className="text-[10px] text-muted-foreground">{ex.equipment}</Badge>}
                        {isBodyweight && <Badge variant="outline" className="text-[10px] text-muted-foreground">自重</Badge>}
                        {item.weightKg == null && !isBodyweight && (
                          <Badge variant="outline" className="border-science/40 bg-science/10 text-[10px] text-foreground">按 RIR 自选</Badge>
                        )}
                        {item.weightKg != null && (
                          <Badge variant="outline" className="text-[10px] tabular-nums text-muted-foreground">设定 {item.weightKg} kg</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="上移" disabled={index === 0}
                      onClick={() => actions.moveExercise(day.uid, index, index - 1)}>
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="下移" disabled={index === day.exercises.length - 1}
                      onClick={() => actions.moveExercise(day.uid, index, index + 1)}>
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 px-2"
                      onClick={() => setPicker({ kind: "replace", itemUid: item.uid, part: ex?.part ?? "全部" })}>
                      <Replace className="size-3.5" />
                      替换
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="删除动作"
                      onClick={() => actions.removeExercise(day.uid, item.uid)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <NumField label="组数" value={item.sets} min={1} max={20}
                    onChange={(v) => v != null && actions.updateExercise(day.uid, item.uid, { sets: v })} />
                  <NumField label="次数下限" value={item.repsLow} min={1} max={50}
                    onChange={(v) => v != null && actions.updateExercise(day.uid, item.uid, {
                      repsLow: v, repsHigh: Math.max(v, item.repsHigh),
                    })} />
                  <NumField label="次数上限" value={item.repsHigh} min={1} max={50}
                    onChange={(v) => v != null && actions.updateExercise(day.uid, item.uid, {
                      repsHigh: v, repsLow: Math.min(v, item.repsLow),
                    })} />
                  <NumField label="重量 kg" value={item.weightKg} min={0} max={500} nullable
                    placeholder={isBodyweight ? "0=自重" : "未设定"}
                    onChange={(v) => actions.updateExercise(day.uid, item.uid, { weightKg: v })} />
                  <NumField label="RPE" value={item.rpe} min={1} max={10} nullable placeholder="—"
                    onChange={(v) => actions.updateExercise(day.uid, item.uid, { rpe: v })} />
                  <NumField label="RIR" value={item.rir} min={0} max={5} nullable placeholder="—"
                    onChange={(v) => actions.updateExercise(day.uid, item.uid, { rir: v })} />
                  <NumField label="组间 秒" value={item.restSec} min={0} max={600}
                    onChange={(v) => v != null && actions.updateExercise(day.uid, item.uid, { restSec: v })} />
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                  重量留空 = 按 RIR 自选，不自动填数字；RPE 与 RIR 二选一填写即可，10 − RIR 只是粗略换算。
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
