import { useRef, useState } from "react";
import { CheckCircle2, ChevronUp, AlertTriangle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { SessionDraft, SessionExercise, SessionSet } from "@/src/components/plan/planStore";

export interface CommittedExercise {
  exercise: SessionExercise;
  sets: { reps: number; weightKg: number; rpe: number | null }[];
}

export function SessionPanel({ draft, saving, onChange, onSave, onClose, onDiscard }: {
  draft: SessionDraft;
  saving: boolean;
  onChange: (next: SessionDraft) => void;
  onSave: (committed: CommittedExercise[]) => void;
  onClose: () => void;
  onDiscard: () => void;
}) {
  const [errors, setErrors] = useState<string[]>([]);
  const submittedRef = useRef(false);
  const total = draft.exercises.reduce((s, e) => s + e.sets.length, 0);
  const done = draft.exercises.reduce((s, e) => s + e.sets.filter((x) => x.done).length, 0);

  function patchSet(exUid: string, setIndex: number, patch: Partial<SessionSet>) {
    onChange({
      ...draft,
      exercises: draft.exercises.map((ex) => (ex.uid === exUid
        ? { ...ex, sets: ex.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)) }
        : ex)),
      updatedAt: new Date().toISOString(),
    });
  }

  function submit() {
    if (submittedRef.current || saving) return;
    const errs: string[] = [];
    const committed: CommittedExercise[] = [];

    for (const ex of draft.exercises) {
      const rows: CommittedExercise["sets"] = [];
      ex.sets.forEach((s, i) => {
        if (!s.done) return;
        const reps = Number(s.reps);
        if (!Number.isInteger(reps) || reps < 1 || reps > 50) {
          errs.push(`${ex.name} 第 ${i + 1} 组：次数需为 1–50 的整数`);
          return;
        }
        const rawWeight = s.weightKg.trim();
        const weight = rawWeight === "" ? NaN : Number(rawWeight);
        if (!ex.isBodyweight) {
          if (rawWeight === "") {
            errs.push(`${ex.name} 第 ${i + 1} 组：负重动作的重量未填写，请补充（或取消勾选该组，留在草稿）`);
            return;
          }
          if (!Number.isFinite(weight) || weight < 0 || weight > 500) {
            errs.push(`${ex.name} 第 ${i + 1} 组：重量需在 0–500 kg 之间`);
            return;
          }
        }
        let rpe: number | null = null;
        if (s.rpe.trim() !== "") {
          const r = Number(s.rpe);
          if (!Number.isFinite(r) || r < 1 || r > 10) {
            errs.push(`${ex.name} 第 ${i + 1} 组：RPE 需在 1–10 之间；不知道就留空`);
            return;
          }
          rpe = r;
        }
        rows.push({ reps, weightKg: ex.isBodyweight ? 0 : weight, rpe });
      });
      if (rows.length > 0) committed.push({ exercise: ex, sets: rows });
    }

    if (committed.length === 0 && errs.length === 0) {
      errs.push("还没有勾选任何已完成的组。勾选「完成」后才会写入训练记录。");
    }
    setErrors([...new Set(errs)]);
    if (errs.length > 0) return;

    submittedRef.current = true;
    try {
      onSave(committed);
    } finally {
      submittedRef.current = false;
    }
  }

  return (
    <Card id="session-panel" className="gap-0 rounded-xl border-advice/40 py-0">
      <CardHeader className="gap-2 border-b border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-advice" />
              训练执行 · {draft.title}
            </CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {draft.date} · 已勾选 {done} / {total} 组。只有勾选「完成」的组会写入今日训练记录，未勾选的组留在草稿里。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1" onClick={onClose}>
              <ChevronUp className="size-3.5" />
              收起
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={onDiscard}>
              <Trash2 className="size-3.5" />
              放弃草稿
            </Button>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          RPE 可不填；RIR 与 RPE 的换算只是参考：RIR 2 约等于 RPE 8（10 − RIR）。重量为空的负重组不会被悄悄跳过，保存前会提示你补充。
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4">
        {errors.length > 0 && (
          <Alert className="border-warn/40 bg-warn/10">
            <AlertTriangle className="size-4 text-warn" />
            <AlertTitle>还不能保存</AlertTitle>
            <AlertDescription>
              <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs">
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {draft.exercises.map((ex) => (
          <div key={ex.uid} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
                {ex.name}
                <Badge variant="secondary" className="text-[10px]">{ex.part}</Badge>
                {ex.isBodyweight && <Badge variant="outline" className="text-[10px] text-muted-foreground">自重</Badge>}
              </p>
              <span className="text-[11px] text-muted-foreground">
                {ex.prefilledFrom ? `预填：${ex.prefilledFrom}` : "无历史记录：重量留空，按 RIR 自选"}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-[2rem_1fr_1fr_4.5rem_3.5rem] items-center gap-2 text-[11px] text-muted-foreground">
              <span>组</span>
              <span>重量 kg</span>
              <span>次数</span>
              <span>RPE</span>
              <span className="text-center">完成</span>
            </div>
            <div className="mt-1 flex flex-col gap-1.5">
              {ex.sets.map((s, i) => (
                <div key={i} className="grid grid-cols-[2rem_1fr_1fr_4.5rem_3.5rem] items-center gap-2">
                  <span className={cn("text-xs tabular-nums", s.done ? "text-advice" : "text-muted-foreground")}>{i + 1}</span>
                  <Input
                    inputMode="decimal"
                    className="h-8 tabular-nums"
                    value={s.weightKg}
                    placeholder={ex.isBodyweight ? "0（自重）" : "必填"}
                    aria-label={`${ex.name} 第 ${i + 1} 组重量`}
                    onChange={(e) => patchSet(ex.uid, i, { weightKg: e.target.value })}
                  />
                  <Input
                    inputMode="numeric"
                    className="h-8 tabular-nums"
                    value={s.reps}
                    aria-label={`${ex.name} 第 ${i + 1} 组次数`}
                    onChange={(e) => patchSet(ex.uid, i, { reps: e.target.value })}
                  />
                  <Input
                    inputMode="decimal"
                    className="h-8 tabular-nums"
                    value={s.rpe}
                    placeholder="可留空"
                    aria-label={`${ex.name} 第 ${i + 1} 组 RPE`}
                    onChange={(e) => patchSet(ex.uid, i, { rpe: e.target.value })}
                  />
                  <div className="flex justify-center">
                    <Checkbox
                      checked={s.done}
                      onCheckedChange={(v) => patchSet(ex.uid, i, { done: v === true })}
                      aria-label={`${ex.name} 第 ${i + 1} 组完成`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          <Button className="gap-1.5" disabled={saving} onClick={submit}>
            <CheckCircle2 className="size-4" />
            {saving ? "正在保存…" : "完成训练并保存"}
          </Button>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            将写入 {done} 组；未勾选的组保留在草稿中。
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
