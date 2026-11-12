import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeftRight, CalendarDays, ClipboardList, Dumbbell, Eye, ImagePlus, Images, Save, Sparkles, Trash2, X,
} from "lucide-react";
import type { AppState, PhotoRecord } from "@/src/lib/types";
import { today } from "@/src/lib/calc";
import { useApp } from "@/src/lib/store";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import FormAnalysis, { type AnalysisResult } from "./FormAnalysis";
import { EXERCISES, EXERCISE_PARTS, daysBetween, findExercise } from "./data";
import { MissingNote } from "./bits";

const CUSTOM = "__custom__";

const uploadSchema = z
  .object({
    exerciseId: z.string().min(1, "请选择动作"),
    customLabel: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效日期"),
  })
  .superRefine((v, ctx) => {
    if (v.exerciseId === CUSTOM && !v.customLabel.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customLabel"], message: "请填写动作名称" });
    }
  });
type UploadForm = z.infer<typeof uploadSchema>;

function readAndCompress(file: File): Promise<{ dataUrl: string; kb: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("当前浏览器不支持图像处理"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      resolve({ dataUrl, kb: Math.round((dataUrl.length * 0.75) / 1024) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败，请换一张试试"));
    };
    img.src = url;
  });
}

function SourceBadge({ source }: { source: PhotoRecord["analysisSource"] }) {
  if (source === "ai") {
    return (
      <Badge variant="outline" className="gap-1 border-ai/30 bg-ai-soft text-foreground">
        <Sparkles className="size-3 text-ai" />
        AI 分析
      </Badge>
    );
  }
  if (source === "human") {
    return (
      <Badge variant="outline" className="gap-1 border-science/30 bg-science/10 text-foreground">
        <ClipboardList className="size-3 text-science" />
        手动自查
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-muted-foreground">无分析</Badge>;
}

const SCROLLBAR_Y =
  "overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40";

export default function PhotoTimeline({
  presetExerciseId,
  onPresetConsumed,
}: {
  presetExerciseId: string | null;
  onPresetConsumed: () => void;
}) {
  const { state, addPhoto, removeEntry } = useApp();
  const photos = useMemo(
    () => ((state as AppState).photos ?? []).filter((p) => p.kind === "form"),
    [state],
  );

  const form = useForm<UploadForm>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { exerciseId: presetExerciseId ?? "", customLabel: "", date: today() },
  });
  const exerciseId = form.watch("exerciseId");
  const selectedExercise = findExercise(exerciseId === CUSTOM ? null : exerciseId);

  const [image, setImage] = useState<{ dataUrl: string; kb: number; name: string } | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult>({ text: null, source: null });
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);

  const [labelFilter, setLabelFilter] = useState("all");
  const [view, setView] = useState<"timeline" | "compare">("timeline");
  const [compareLabel, setCompareLabel] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [detail, setDetail] = useState<PhotoRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (presetExerciseId) {
      form.setValue("exerciseId", presetExerciseId);
      onPresetConsumed();
      uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [presetExerciseId, form, onPresetConsumed]);

  const handleAnalysisResult = useCallback((r: AnalysisResult) => setAnalysis(r), []);

  const groups = useMemo(() => {
    const m = new Map<string, PhotoRecord[]>();
    for (const p of photos) {
      const arr = m.get(p.label) ?? [];
      arr.push(p);
      m.set(p.label, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
    return [...m.entries()].sort((a, b) => b[1][b[1].length - 1].date.localeCompare(a[1][a[1].length - 1].date));
  }, [photos]);

  const visibleGroups = labelFilter === "all" ? groups : groups.filter(([label]) => label === labelFilter);
  const compareOptions = groups.filter(([, arr]) => arr.length >= 2);
  const comparePhotos = groups.find(([label]) => label === compareLabel)?.[1] ?? [];
  const photoA = comparePhotos.find((p) => p.id === compareA) ?? null;
  const photoB = comparePhotos.find((p) => p.id === compareB) ?? null;

  const openCompare = (label: string) => {
    const arr = groups.find(([l]) => l === label)?.[1] ?? [];
    if (arr.length < 2) return;
    setCompareLabel(label);
    setCompareA(arr[0].id);
    setCompareB(arr[arr.length - 1].id);
    setView("compare");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件（jpg / png 等）");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("图片超过 20MB，请换一张较小的照片");
      return;
    }
    setCompressing(true);
    try {
      const { dataUrl, kb } = await readAndCompress(file);
      setImage({ dataUrl, kb, name: file.name });
      setAnalysis({ text: null, source: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "图片处理失败");
    } finally {
      setCompressing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSubmit = (values: UploadForm) => {
    if (!image) {
      toast.error("请先选择一张训练照片");
      return;
    }
    const label = values.exerciseId === CUSTOM ? values.customLabel.trim() : (findExercise(values.exerciseId)?.name ?? values.customLabel.trim());
    try {
      addPhoto({
        date: values.date,
        kind: "form",
        dataUrl: image.dataUrl,
        label,
        analysis: analysis.text,
        analysisSource: analysis.source,
      });
      toast.success(analysis.source === "ai" ? "已保存照片与 AI 分析（仅供参考）" : analysis.source === "human" ? "已保存照片与手动自查记录" : "已保存到训练照片时间轴");
      form.reset({ exerciseId: "", customLabel: "", date: values.date });
      setImage(null);
      setAnalysis({ text: null, source: null });
    } catch {
      toast.error("保存失败：本地存储空间可能已满，请删除部分旧照片后重试");
    }
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    try {
      removeEntry("photos", deleteId);
      toast.success("已删除照片");
    } catch {
      toast.error("删除失败，请重试");
    }
    setDeleteId(null);
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[380px_1fr]">
      {/* 上传区 */}
      <Card ref={uploadRef} className="rounded-xl lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="size-4 text-chart-1" />
            上传训练照片
          </CardTitle>
          <CardDescription>照片保存在本地应用数据中，不会上传到服务器。AI 分析需配置识别服务；未配置时可用手动自查。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>动作</Label>
              <Controller
                control={form.control}
                name="exerciseId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-label="选择动作">
                      <SelectValue placeholder="选择要记录的动作" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CUSTOM}>自定义动作…</SelectItem>
                      {EXERCISE_PARTS.map((part) => (
                        <SelectGroup key={part}>
                          <SelectLabel>{part}</SelectLabel>
                          {EXERCISES.filter((e) => e.part === part).map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.exerciseId && (
                <p className="text-xs text-destructive">{form.formState.errors.exerciseId.message}</p>
              )}
            </div>

            {exerciseId === CUSTOM && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="custom-label">动作名称</Label>
                <Input id="custom-label" placeholder="例如：靠墙静蹲" {...form.register("customLabel")} />
                {form.formState.errors.customLabel && (
                  <p className="text-xs text-destructive">{form.formState.errors.customLabel.message}</p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="photo-date">拍摄日期</Label>
              <Input id="photo-date" type="date" max={today()} {...form.register("date")} />
              {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>照片</Label>
              <input
                ref={fileRef}
                id="form-photo-file"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {image ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
                  <img src={image.dataUrl} alt="训练照片预览" className="max-h-52 w-full rounded-lg object-contain bg-muted/40" />
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{image.name} · 约 {image.kb} KB（已压缩）</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => { setImage(null); setAnalysis({ text: null, source: null }); }}>
                      <X className="size-3" />
                      移除
                    </Button>
                  </div>
                </div>
              ) : (
                <Label
                  htmlFor="form-photo-file"
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-5 text-center transition-colors hover:bg-muted/50"
                >
                  {compressing ? <Spinner className="size-6 text-chart-1" /> : <ImagePlus className="size-6 text-muted-foreground" />}
                  <span className="text-sm font-medium">{compressing ? "正在压缩图片…" : "点击选择照片"}</span>
                  <span className="text-xs font-normal text-muted-foreground">jpg / png，≤20MB，自动压缩到 1280px。建议全身入镜、固定机位与光线。</span>
                </Label>
              )}
            </div>

            <FormAnalysis exercise={selectedExercise} dataUrl={image?.dataUrl ?? null} onResult={handleAnalysisResult} />

            <div className="flex flex-col gap-1">
              <Button type="submit" className="w-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" disabled={compressing}>
                <Save className="size-4" />
                保存到时间轴
              </Button>
              <p className="text-center text-xs text-muted-foreground">可以不做分析直接保存，之后随时对比。</p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 时间轴 / 对比区 */}
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Images className="size-4 text-chart-2" />
              训练照片时间轴
              <Badge variant="secondary">{photos.length} 张</Badge>
            </CardTitle>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as "timeline" | "compare")}
              size="sm"
              className="rounded-lg border border-border"
            >
              <ToggleGroupItem value="timeline" className="gap-1.5 px-3 text-xs">
                <Images className="size-3.5" />
                时间轴
              </ToggleGroupItem>
              <ToggleGroupItem value="compare" className="gap-1.5 px-3 text-xs">
                <ArrowLeftRight className="size-3.5" />
                对比
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {photos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Label className="text-xs text-muted-foreground">按动作筛选</Label>
              <Select value={labelFilter} onValueChange={setLabelFilter}>
                <SelectTrigger size="sm" className="w-[180px]" aria-label="按动作筛选照片">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部动作</SelectItem>
                  {groups.map(([label, arr]) => (
                    <SelectItem key={label} value={label}>{label}（{arr.length}）</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <Empty className="border border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ImagePlus /></EmptyMedia>
                <EmptyTitle>还没有训练照片</EmptyTitle>
                <EmptyDescription>
                  定期拍下同一动作，就能看到自己的进步。拍摄建议：同一机位与光线、全身入镜、侧面和正面各一张、穿贴身衣物便于观察姿态。
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => uploadRef.current?.scrollIntoView({ behavior: "smooth" })}>
                  <ImagePlus className="size-4" />
                  上传第一张
                </Button>
              </EmptyContent>
            </Empty>
          ) : view === "timeline" ? (
            <div className="flex flex-col gap-4">
              {visibleGroups.length === 0 && <MissingNote>该动作暂无照片。</MissingNote>}
              {visibleGroups.map(([label, arr]) => (
                <section key={label} className="rounded-xl border border-border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
                        <Dumbbell className="size-3.5 text-chart-1" />
                      </span>
                      <span className="truncate font-medium">{label}</span>
                      <Badge variant="secondary">{arr.length} 张</Badge>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {arr[0].date} ~ {arr[arr.length - 1].date}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" disabled={arr.length < 2} onClick={() => openCompare(label)}>
                      <ArrowLeftRight className="size-3.5" />
                      对比
                    </Button>
                  </div>
                  <ol className="ml-1.5 flex flex-col gap-3 border-l-2 border-border pl-4">
                    {[...arr].reverse().map((p) => (
                      <li key={p.id} className="relative">
                        <span className="absolute -left-[22px] top-2 size-2.5 rounded-full bg-chart-1 ring-2 ring-background" />
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setDetail(p)}
                            className="shrink-0 overflow-hidden rounded-lg border border-border transition-shadow hover:ring-2 hover:ring-chart-1/40"
                            aria-label={`查看 ${label} ${p.date} 的照片`}
                          >
                            <img src={p.dataUrl} alt={`${label} ${p.date}`} className="size-24 object-cover" loading="lazy" />
                          </button>
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className="gap-1">
                                <CalendarDays className="size-3 text-muted-foreground" />
                                {p.date}
                              </Badge>
                              <SourceBadge source={p.analysisSource} />
                            </div>
                            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {p.analysis ?? "未填写分析，可在对比视图中观察动作变化。"}
                            </p>
                            <div className="mt-auto flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => setDetail(p)}>
                                <Eye className="size-3" />
                                查看
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(p.id)}
                              >
                                <Trash2 className="size-3" />
                                删除
                              </Button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          ) : compareOptions.length === 0 ? (
            <Empty className="border border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ArrowLeftRight /></EmptyMedia>
                <EmptyTitle>还不够对比</EmptyTitle>
                <EmptyDescription>同一动作至少需要两张不同时间的照片。坚持记录，几周后回来看看变化。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs text-muted-foreground">选择动作</Label>
                <Select
                  value={compareLabel ?? undefined}
                  onValueChange={(v) => {
                    const arr = groups.find(([l]) => l === v)?.[1] ?? [];
                    setCompareLabel(v);
                    setCompareA(arr[0]?.id ?? null);
                    setCompareB(arr[arr.length - 1]?.id ?? null);
                  }}
                >
                  <SelectTrigger className="w-[200px]" aria-label="选择对比动作">
                    <SelectValue placeholder="选择一个动作" />
                  </SelectTrigger>
                  <SelectContent>
                    {compareOptions.map(([label, arr]) => (
                      <SelectItem key={label} value={label}>{label}（{arr.length} 张）</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {photoA && photoB && (
                  <Badge variant="outline" className="border-science/40 bg-science/10 text-foreground">
                    相隔 {daysBetween(photoA.date, photoB.date)} 天
                  </Badge>
                )}
              </div>
              {!compareLabel ? (
                <MissingNote>选择一个动作开始对比。</MissingNote>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {([["早期", compareA, setCompareA, photoA], ["近期", compareB, setCompareB, photoB]] as const).map(
                    ([tag, id, setter, photo]) => (
                      <div key={tag} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{tag}</Badge>
                          <Select value={id ?? undefined} onValueChange={(v) => setter(v)}>
                            <SelectTrigger size="sm" className="flex-1" aria-label={`${tag}照片`}>
                              <SelectValue placeholder="选择照片" />
                            </SelectTrigger>
                            <SelectContent>
                              {comparePhotos.map((p, i) => (
                                <SelectItem key={p.id} value={p.id}>{p.date} · 第 {i + 1} 张</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {photo ? (
                          <>
                            <img src={photo.dataUrl} alt={`${compareLabel} ${photo.date}`} className="max-h-[340px] w-full rounded-lg border border-border bg-muted/40 object-contain" />
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="gap-1">
                                <CalendarDays className="size-3 text-muted-foreground" />
                                {photo.date}
                              </Badge>
                              <SourceBadge source={photo.analysisSource} />
                            </div>
                            {photo.analysis ? (
                              <p className={cn("whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground max-h-40", SCROLLBAR_Y)}>
                                {photo.analysis}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">无分析记录。</p>
                            )}
                          </>
                        ) : (
                          <MissingNote>请选择一张照片。</MissingNote>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">对比提示：尽量保持同一机位、光线与站姿，观察肩、髋、膝的位置变化；照片对比是自我观察工具，不是医学评估。</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 照片详情 */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {detail?.label}
              <Badge variant="outline" className="gap-1">
                <CalendarDays className="size-3 text-muted-foreground" />
                {detail?.date}
              </Badge>
              {detail && <SourceBadge source={detail.analysisSource} />}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-3">
              <img src={detail.dataUrl} alt={`${detail.label} ${detail.date}`} className="max-h-[60vh] w-full rounded-lg border border-border bg-muted/40 object-contain" />
              {detail.analysis ? (
                <div className={cn("rounded-lg border border-border bg-muted/30 p-3 max-h-48", SCROLLBAR_Y)}>
                  {detail.analysisSource === "ai" && (
                    <Badge variant="outline" className="mb-2 gap-1 border-ai/30 bg-ai-soft text-foreground">
                      <Sparkles className="size-3 text-ai" />
                      AI 分析，仅供参考，非专业教练意见
                    </Badge>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{detail.analysis}</p>
                </div>
              ) : (
                <MissingNote>这张照片没有分析记录。</MissingNote>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => {
                if (detail) setDeleteId(detail.id);
                setDetail(null);
              }}
            >
              <Trash2 className="size-4" />
              删除照片
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">关闭</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这张照片？</AlertDialogTitle>
            <AlertDialogDescription>删除后不可恢复，时间轴与对比中将不再显示这张照片及其分析记录。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}