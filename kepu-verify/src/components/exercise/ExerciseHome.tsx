import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, CalendarClock, CalendarDays, Dumbbell, GraduationCap, History, Layers,
  RotateCcw, Search, SearchX, Target, X,
} from "lucide-react";
import type { AppState, Exercise } from "@/src/lib/types";
import { useApp } from "@/src/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EXERCISES, EXERCISE_PARTS, findExercise } from "@/src/components/form/data";
import ExerciseDetail from "./ExerciseDetail";
import ExerciseListCard from "./ExerciseListCard";
import type { SourceStatus } from "./sources";
import { sourceCounts } from "./sources";

const BASIC_PATTERNS = new Set(["推", "拉", "蹲", "铰链", "核心"]);
const QUICK_SEARCHES = ["深蹲", "卧推", "膝内扣", "核心"];

function SectionHeader({
  icon: Icon,
  title,
  description,
  extra,
}: {
  icon: typeof Target;
  title: string;
  description?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
          <Icon className="size-4 text-chart-1" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold leading-tight">{title}</h2>
          {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {extra}
    </div>
  );
}

function QuietEmpty({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Target;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" />
        {title}
      </p>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export default function ExerciseHome({
  onAnalyze,
  focusQuery,
}: {
  onAnalyze: (ex: Exercise) => void;
  focusQuery: { value: string; nonce: number } | null;
}) {
  const { state } = useApp();
  const [query, setQuery] = useState("");
  const [part, setPart] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const restoreScroll = useRef<number | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const statusMap = useMemo(() => {
    const map = new Map<string, { exact: number; near: number; status: SourceStatus }>();
    for (const ex of EXERCISES) map.set(ex.id, sourceCounts(ex));
    return map;
  }, []);

  const statusOf = (exerciseId: string): SourceStatus => statusMap.get(exerciseId)?.status ?? "none";

  const recent = useMemo(() => {
    const training = (state as AppState).training ?? [];
    const seen = new Set<string>();
    const out: Exercise[] = [];
    for (const entry of [...training].sort((a, b) => b.date.localeCompare(a.date))) {
      if (seen.has(entry.exerciseId)) continue;
      const exercise = findExercise(entry.exerciseId);
      if (!exercise) continue;
      seen.add(entry.exerciseId);
      out.push(exercise);
      if (out.length >= 6) break;
    }
    return out;
  }, [state]);

  const recommended = useMemo(() => {
    const eligible = EXERCISES.filter(
      (ex) => ex.level === "novice" && BASIC_PATTERNS.has(ex.pattern) && (statusMap.get(ex.id)?.exact ?? 0) > 0,
    );
    const byPart = new Map<string, Exercise[]>();
    for (const ex of eligible) {
      const list = byPart.get(ex.part) ?? [];
      list.push(ex);
      byPart.set(ex.part, list);
    }
    const out: Exercise[] = [];
    for (let round = 0; round < 3 && out.length < 6; round++) {
      for (const p of EXERCISE_PARTS) {
        const ex = byPart.get(p)?.[round];
        if (ex) out.push(ex);
        if (out.length >= 6) break;
      }
    }
    return out;
  }, [statusMap]);

  const partStats = useMemo(
    () =>
      EXERCISE_PARTS.map((p) => {
        const list = EXERCISES.filter((ex) => ex.part === p);
        return {
          part: p,
          total: list.length,
          withExact: list.filter((ex) => (statusMap.get(ex.id)?.exact ?? 0) > 0).length,
        };
      }),
    [statusMap],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && part === "all") return [];
    return EXERCISES.filter((ex) => {
      if (part !== "all" && ex.part !== part) return false;
      if (!q) return true;
      const hay = [
        ex.name, ex.nameEn, ex.part, ex.pattern, ex.equipment,
        ex.cues.join(" "),
        ex.commonErrors.map((e) => `${e.error} ${e.risk} ${e.fix}`).join(" "),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [query, part]);

  const searchActive = query.trim() !== "" || part !== "all";

  useEffect(() => {
    if (!focusQuery) return;
    setQuery(focusQuery.value);
    setPart("all");
    const target = EXERCISES.find((ex) => ex.name === focusQuery.value.trim());
    if (target) {
      restoreScroll.current = null;
      setSelectedId(target.id);
    } else {
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [focusQuery]);

  useEffect(() => {
    if (selectedId) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      return;
    }
    if (restoreScroll.current != null) {
      const y = restoreScroll.current;
      restoreScroll.current = null;
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }));
    }
  }, [selectedId]);

  const openDetail = (exercise: Exercise) => {
    restoreScroll.current = window.scrollY;
    setSelectedId(exercise.id);
  };

  const browsePart = (nextPart: string) => {
    setPart(nextPart);
    setQuery("");
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const clearSearch = () => {
    setQuery("");
    setPart("all");
  };

  const selected = findExercise(selectedId);

  if (selected) {
    return <ExerciseDetail exercise={selected} onBack={() => setSelectedId(null)} onAnalyze={onAnalyze} />;
  }

  if (EXERCISES.length === 0) {
    return (
      <QuietEmpty icon={Dumbbell} title="动作数据暂未加载">
        动作库数据尚未就绪（素材不足）。请稍后刷新重试，或先前往「体态自查」查看真实视频。
      </QuietEmpty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-border bg-card p-4 md:p-5">
        <SectionHeader
          icon={Target}
          title="当前计划中的动作"
          description="只读取已有计划状态；读不到时保持空状态，不生成虚假计划。"
        />
        <div className="mt-3">
          <QuietEmpty icon={CalendarClock} title="暂未读取到当前计划中的动作">
            训练页的系统周计划目前只在训练页内生成，尚未写入动作页可读取的持久化状态。这里不会虚构计划；
            你可以先从下方「最近练过的动作」「基础学习推荐」或搜索进入。
            <div className="mt-2">
              <Button asChild variant="outline" size="sm">
                <a href="#/plan">打开训练计划</a>
              </Button>
            </div>
          </QuietEmpty>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 md:p-5">
        <SectionHeader
          icon={History}
          title="最近练过的动作"
          description="来自本机训练记录，按最近一次训练日期排序；没有记录时留空。"
          extra={<Badge variant="secondary">{recent.length} 个动作</Badge>}
        />
        <div className="mt-3">
          {recent.length === 0 ? (
            <QuietEmpty icon={CalendarDays} title="还没有训练记录">
              在训练页或「我的」里记录训练后，最近练过的动作会出现在这里。我们不会生成虚假的用户记录。
            </QuietEmpty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((ex) => (
                <ExerciseListCard key={ex.id} exercise={ex} status={statusOf(ex.id)} onOpen={openDetail} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 md:p-5">
        <SectionHeader
          icon={GraduationCap}
          title="基础学习推荐"
          description="稳定规则：新手友好 + 至少 1 条精确匹配教学来源 + 覆盖不同肌群，按动作库顺序选出。不是 AI 个性化推荐，也不根据你的身体情况生成。"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recommended.map((ex) => (
            <ExerciseListCard key={ex.id} exercise={ex} status={statusOf(ex.id)} onOpen={openDetail} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 md:p-5">
        <SectionHeader
          icon={Layers}
          title="按肌群浏览"
          description="选择一个肌群查看该部位的全部动作；不会一次展开全部 37 个动作。"
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {partStats.map((stat) => (
            <button
              key={stat.part}
              type="button"
              onClick={() => browsePart(stat.part)}
              aria-pressed={part === stat.part}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                part === stat.part
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{stat.part}</span>
                <Badge variant="secondary">{stat.total}</Badge>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {stat.withExact} 个有精确教学来源
              </span>
            </button>
          ))}
        </div>
      </section>

      <section ref={resultsRef} className="scroll-mt-20 rounded-xl border border-border bg-card p-4 md:p-5">
        <SectionHeader
          icon={Search}
          title="搜索动作"
          description="按动作名、英文名、部位、器械或错误关键词搜索；结果卡片只显示名称、肌群与教学来源状态。"
          extra={
            part !== "all" ? (
              <Badge variant="outline" className="gap-1">
                肌群：{part}
                <button
                  type="button"
                  onClick={() => setPart("all")}
                  aria-label="清除肌群筛选"
                  className="rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ) : null
          }
        />
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索「深蹲」「膝内扣」「哑铃」等"
            className="pl-9"
            aria-label="搜索动作"
          />
        </div>

        {!searchActive ? (
          <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">输入关键词，或在上方选择一个肌群开始浏览。</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_SEARCHES.map((word) => (
                <Button key={word} variant="outline" size="xs" onClick={() => setQuery(word)}>
                  {word}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>共 {filtered.length} 个动作{query.trim() ? ` · 关键词「${query.trim()}」` : ""}</span>
              <Button variant="ghost" size="sm" className="h-auto gap-1 p-0 text-xs" onClick={clearSearch}>
                <RotateCcw className="size-3" />
                清除搜索与肌群
              </Button>
            </div>
            {filtered.length === 0 ? (
              <div className="mt-3">
                <QuietEmpty icon={SearchX} title="没有匹配的动作">
                  换个关键词试试，或清除肌群筛选。动作不会因为没有教学视频而被隐藏。
                  <div className="mt-2">
                    <Button variant="outline" size="sm" onClick={clearSearch}>
                      <RotateCcw className="size-3.5" />
                      清除全部筛选
                    </Button>
                  </div>
                </QuietEmpty>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((ex) => (
                  <ExerciseListCard key={ex.id} exercise={ex} status={statusOf(ex.id)} onOpen={openDetail} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <ArrowLeft className="size-3 rotate-180" />
        点开任意动作卡查看动作详情、教学来源与逐条证据；返回后会保留当前搜索词与肌群筛选。
      </p>
    </div>
  );
}
