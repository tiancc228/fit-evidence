import * as React from "react";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  Images,
  Sparkles,
  Trash2,
  Loader2,
  CalendarDays,
  Info,
  TriangleAlert,
  ArrowLeftRight,
  ImageOff,
} from "lucide-react";

import { useApp } from "@/src/lib/store";
import { aiStatus, analyzeImage } from "@/src/lib/ai";
import type { PhotoRecord, Profile } from "@/src/lib/types";
import { today, fmtDate, GOAL_LABEL } from "@/src/lib/calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EmptyState, InfoNote, LayerTag, SectionHeading, SCROLL_X, resizeImageFile } from "@/src/components/body/shared";

const POSES = ["正面", "侧面", "背面"] as const;
type Pose = (typeof POSES)[number];

type AiResult = { status: "ready" | "service_not_configured" | "error"; text: string | null };

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
}

export function PhotoTimeline() {
  const { state, addPhoto, removeEntry } = useApp();
  const profile = state.profile as Profile | null;
  const photos = React.useMemo(
    () => [...(state.photos as PhotoRecord[]).filter((p) => p.kind === "body")].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    [state.photos],
  );

  const [pose, setPose] = React.useState<Pose>("正面");
  const [date, setDate] = React.useState<string>(today());
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [baseId, setBaseId] = React.useState<string | null>(null);
  const [compareId, setCompareId] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Record<string, AiResult>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const status = aiStatus();

  React.useEffect(() => {
    if (photos.length === 0) {
      setBaseId(null);
      setCompareId(null);
      return;
    }
    setBaseId((cur) => (cur && photos.some((p) => p.id === cur) ? cur : photos[0].id));
    setCompareId((cur) => (cur && photos.some((p) => p.id === cur) ? cur : photos[photos.length - 1].id));
  }, [photos]);

  const base = photos.find((p) => p.id === baseId) ?? null;
  const compare = photos.find((p) => p.id === compareId) ?? null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("请选择图片文件（jpg / png 等）。");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const dataUrl = await resizeImageFile(file);
      const id = addPhoto({ date: date || today(), kind: "body", dataUrl, label: pose, analysis: null, analysisSource: null });
      setCompareId(id);
      toast.success(`已添加 ${fmtDate(date)} 的${pose}照片`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "处理图片失败，请重试。");
    } finally {
      setUploading(false);
    }
  }

  async function runAi(photo: PhotoRecord) {
    if (status !== "ready") return;
    setBusyId(photo.id);
    const ctx = profile
      ? `性别${profile.sex === "male" ? "男" : "女"}，年龄${profile.age}，身高${profile.heightCm}cm，体重${profile.weightKg}kg，目标${GOAL_LABEL[profile.goal]}。照片为${photo.label}（${fmtDate(photo.date)}）。请客观描述体态与可见变化，提示训练重点，不要给出医学诊断或精确体脂数值。`
      : `身体${photo.label}照片（${fmtDate(photo.date)}）。请客观描述体态，不要给出医学诊断。`;
    try {
      const r = await analyzeImage("body", photo.dataUrl, ctx);
      setResults((m) => ({ ...m, [photo.id]: { status: r.status, text: r.text } }));
      if (r.status === "service_not_configured") toast.warning("AI 图像识别未配置，请手动填写体脂率等数据");
      else if (r.status === "error") toast.error("AI 分析失败，请稍后重试或手动记录");
    } catch {
      setResults((m) => ({ ...m, [photo.id]: { status: "error", text: null } }));
      toast.error("AI 分析调用出错");
    } finally {
      setBusyId(null);
    }
  }

  function renderPhotoSlot(which: "base" | "compare", photo: PhotoRecord | null, id: string | null, setId: (v: string) => void) {
    const result = photo ? results[photo.id] : undefined;
    return (
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{which === "base" ? "基准" : "对比"}</span>
          <Select value={id ?? undefined} onValueChange={setId} disabled={photos.length === 0}>
            <SelectTrigger className="h-8 flex-1" size="sm">
              <SelectValue placeholder="选择照片" />
            </SelectTrigger>
            <SelectContent>
              {photos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {fmtDate(p.date)} · {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted">
          {photo ? (
            <img src={photo.dataUrl} alt={`${fmtDate(photo.date)} ${photo.label}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff className="size-6" />
              <span className="text-xs">暂无照片</span>
            </div>
          )}
          {photo ? (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-background/85 px-2 py-0.5 text-xs font-medium backdrop-blur">
              <CalendarDays className="size-3" />
              {fmtDate(photo.date)} · {photo.label}
            </span>
          ) : null}
        </div>
        {photo ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" className="flex-1" disabled={status !== "ready" || busyId === photo.id} onClick={() => runAi(photo)}>
                {busyId === photo.id ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {busyId === photo.id ? "分析中…" : "AI 体态分析"}
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="删除这张照片"
                onClick={() => {
                  removeEntry("photos", photo.id);
                  toast.success("已删除照片");
                }}
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </div>
            {result ? (
              result.status === "ready" && result.text ? (
                <div className="space-y-1.5 rounded-lg border border-ai/40 bg-ai-soft p-3">
                  <LayerTag kind="ai" />
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{result.text}</p>
                  <p className="text-[11px] text-muted-foreground">AI 拆解结论，仅供参考，非医学诊断；体脂等数值请以测量为准。</p>
                </div>
              ) : result.status === "service_not_configured" ? (
                <InfoNote icon={TriangleAlert}>AI 图像识别未配置，请手动填写体脂率等数据。</InfoNote>
              ) : (
                <InfoNote icon={TriangleAlert}>AI 分析失败，请稍后重试，或直接用围度/体重记录进度。</InfoNote>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <SectionHeading
          icon={Camera}
          title="照片记录与对比"
          desc="同一角度、同一光线、同一姿势，每隔 2–4 周拍一次，比天天照镜子更能看出变化。"
        />
      </CardHeader>
      <CardContent className="space-y-5">
        {status !== "ready" ? (
          <Alert>
            <TriangleAlert className="size-4" />
            <AlertTitle>
              {status === "service_not_configured" ? "AI 图像识别未配置" : "AI 服务调用失败"}
            </AlertTitle>
            <AlertDescription>
              {status === "service_not_configured"
                ? "照片仍可正常上传、按日期对比。体态分析暂不可用，请手动填写体脂率、围度等数据来跟踪进度。"
                : "AI 服务当前不可用，照片上传与对比不受影响，请稍后再试体态分析。"}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-2">
            <Label htmlFor="photo-pose">角度</Label>
            <Select value={pose} onValueChange={(v) => setPose(v as Pose)}>
              <SelectTrigger id="photo-pose" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="photo-date">日期</Label>
            <Input id="photo-date" type="date" className="w-40" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>上传照片</Label>
            <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "处理中…" : "选择图片"}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </div>
          <p className="flex-1 text-xs text-muted-foreground">
            照片仅保存在本机浏览器，会自动压缩。请勿上传他人照片。
          </p>
        </div>
        {uploadError ? (
          <Alert variant="destructive">
            <TriangleAlert className="size-4" />
            <AlertTitle>上传失败</AlertTitle>
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        ) : null}

        {photos.length === 0 ? (
          <EmptyState
            icon={Images}
            title="还没有身体照片"
            desc="上传第一张正面照作为起点。之后定期同角度拍摄，就能左右对比不同日期的变化。"
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {renderPhotoSlot("base", base, baseId, setBaseId)}
              {renderPhotoSlot("compare", compare, compareId, setCompareId)}
            </div>
            {base && compare ? (
              <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                <ArrowLeftRight className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">两张照片相隔</span>
                <span className="font-semibold tabular-nums">{Math.abs(daysBetween(base.date, compare.date))} 天</span>
                {base.id === compare.id ? <span className="text-xs text-chart-5">（当前选的是同一张，换一张才能对比）</span> : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm font-medium">时间轴（按日期）</p>
              <div className={cn("flex gap-3 pb-2", SCROLL_X)}>
                {[...photos].reverse().map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCompareId(p.id)}
                    className={cn(
                      "group relative w-28 shrink-0 overflow-hidden rounded-lg border text-left transition-all hover:ring-2 hover:ring-chart-1/40",
                      p.id === compareId ? "ring-2 ring-chart-1" : "",
                    )}
                  >
                    <div className="aspect-[3/4] overflow-hidden bg-muted">
                      <img src={p.dataUrl} alt={`${fmtDate(p.date)} ${p.label}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                    <div className="space-y-0.5 p-2">
                      <p className="text-xs font-medium tabular-nums">{fmtDate(p.date)}</p>
                      <p className="text-[11px] text-muted-foreground">{p.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <InfoNote icon={Info}>
              照片对比看的是体型轮廓、肌肉线条与体态变化，不能精确读出体脂率。想量化进度，请结合上方的体重与围度数据。
            </InfoNote>
          </>
        )}
      </CardContent>
    </Card>
  );
}
