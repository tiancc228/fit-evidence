import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Exercise } from "@/src/lib/types";
import { EXERCISES, EXERCISE_PARTS } from "@/src/data/exercises";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { VideoLink } from "@/src/components/form/bits";

const LEVEL_LABEL: Record<Exercise["level"], string> = {
  novice: "新手",
  intermediate: "进阶",
  advanced: "高阶",
};

export function ExercisePicker({ title, defaultPart, onPick, onClose }: {
  title: string;
  defaultPart?: string | null;
  onPick: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [part, setPart] = useState<string>(defaultPart ?? "全部");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter((ex) => {
      if (part !== "全部" && ex.part !== part) return false;
      if (!q) return true;
      return `${ex.name} ${ex.nameEn} ${ex.equipment} ${ex.part}`.toLowerCase().includes(q);
    });
  }, [query, part]);

  return (
    <div className="rounded-lg border border-advice/40 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{title}</p>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={onClose}>
          <X className="size-3.5" />
          关闭
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索动作 / 器械"
            className="h-8 pl-7"
            aria-label="搜索动作"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {["全部", ...EXERCISE_PARTS].map((p) => (
            <button
              key={p}
              onClick={() => setPart(p)}
              aria-pressed={part === p}
              className={cn(
                "rounded-full border px-2 py-1 text-[11px] transition-colors",
                part === p ? "border-advice/60 bg-advice-soft text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted/50",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 max-h-64 overflow-y-auto pr-1">
        {list.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            没有匹配的动作；换个关键词或部位试试。
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {list.map((ex) => (
              <li key={ex.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background p-2 transition-colors hover:bg-muted/50">
                <button onClick={() => onPick(ex)} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-medium">{ex.name}</span>
                    <span className="text-[10px] text-muted-foreground">{ex.nameEn}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">{ex.part}</Badge>
                    <span>{ex.equipment}</span>
                    <span>· {LEVEL_LABEL[ex.level]}</span>
                  </span>
                </button>
                <div className="shrink-0">
                  {ex.videoBvid ? (
                    <VideoLink bvid={ex.videoBvid} mini />
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">无视频（仍可用）</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        动作库共 {EXERCISES.length} 个动作；没有视频来源的动作不会被隐藏，只是不显示视频链接。
      </p>
    </div>
  );
}
