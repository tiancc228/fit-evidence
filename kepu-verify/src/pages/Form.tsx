import { useCallback, useMemo, useState } from "react";
import { Camera, Dumbbell, PersonStanding } from "lucide-react";
import type { AppState, Exercise } from "@/src/lib/types";
import { useApp } from "@/src/lib/store";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExerciseLibrary from "@/src/components/form/ExerciseLibrary";
import PhotoTimeline from "@/src/components/form/PhotoTimeline";
import PostureZone from "@/src/components/form/PostureZone";
import { EXERCISES } from "@/src/components/form/data";
import { LayerTag, SafetyAlert } from "@/src/components/form/bits";

export default function FormPage() {
  const { state } = useApp();
  const photoCount = useMemo(
    () => ((state as AppState).photos ?? []).filter((p) => p.kind === "form").length,
    [state],
  );
  const [tab, setTab] = useState("library");
  const [presetExerciseId, setPresetExerciseId] = useState<string | null>(null);
  const [focusQuery, setFocusQuery] = useState<{ value: string; nonce: number } | null>(null);

  const handleAnalyze = useCallback((ex: Exercise) => {
    setPresetExerciseId(ex.id);
    setTab("photos");
  }, []);
  const consumePreset = useCallback(() => setPresetExerciseId(null), []);
  const openInLibrary = useCallback((name: string) => {
    setFocusQuery({ value: name, nonce: Date.now() });
    setTab("library");
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <header className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">动作与体态</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            新手动作库 · 训练照片记录与对比 · 体态自查。术语都会顺带解释，先学动作，再上重量。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-advice/40 bg-advice-soft text-foreground">
            <Dumbbell className="size-3 text-advice" />
            {EXERCISES.length} 个动作
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-science/40 bg-science/10 text-foreground">
            <Camera className="size-3 text-science" />
            {photoCount} 张训练照片
          </Badge>
        </div>
      </header>
      <div className="energy-line h-0.5 rounded-full" aria-hidden />

      <SafetyAlert />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="library" className="gap-1.5">
            <Dumbbell className="size-4" />
            动作库
          </TabsTrigger>
          <TabsTrigger value="photos" className="gap-1.5">
            <Camera className="size-4" />
            训练照片
            {photoCount > 0 && <Badge variant="secondary" className="ml-0.5 px-1.5">{photoCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="posture" className="gap-1.5">
            <PersonStanding className="size-4" />
            体态自查
          </TabsTrigger>
        </TabsList>
        <TabsContent value="library" forceMount className="data-[state=inactive]:hidden">
          <ExerciseLibrary onAnalyze={handleAnalyze} focusQuery={focusQuery} />
        </TabsContent>
        <TabsContent value="photos" forceMount className="data-[state=inactive]:hidden">
          <PhotoTimeline presetExerciseId={presetExerciseId} onPresetConsumed={consumePreset} />
        </TabsContent>
        <TabsContent value="posture" forceMount className="data-[state=inactive]:hidden">
          <PostureZone onOpenExercise={openInLibrary} />
        </TabsContent>
      </Tabs>

      <footer className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium">本页如何标注出处（四层分开，绝不混为一谈）</p>
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1"><LayerTag n={1} className="w-fit" />博主视频里的原话短引用，附原视频链接与时间点。</div>
          <div className="flex flex-col gap-1"><LayerTag n={2} className="w-fit" />AI 从原话拆解出的结论，需人工复核后才算数。</div>
          <div className="flex flex-col gap-1"><LayerTag n={3} className="w-fit" />真实文献 / 指南核对结果，附 DOI / PMID 可查证。</div>
          <div className="flex flex-col gap-1"><LayerTag n={4} className="w-fit" />产品给你的最终建议；动作要领与纠错属「产品教学建议」。</div>
        </div>
        <p className="text-xs text-muted-foreground">
          所有视频与文献均来自已抓取的真实来源清单，按 bvid / DOI 精确取用；拿不到的数据如实标注「素材不足」。视频版权归原作者所有，本页不搬运任何完整视频。
        </p>
      </footer>
    </main>
  );
}