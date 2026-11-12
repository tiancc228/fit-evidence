import { useCallback, useEffect, useState } from "react";
import {
  BookOpen, Bot, Cookie, ExternalLink, Lightbulb, Quote, ShieldCheck, Sun, Sunrise, Sunset,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { EvidenceRef, Goal, MealEntry, ReviewState, Verdict } from "@/src/lib/types";
import { GUIDELINE_2022, fmtClock } from "@/src/lib/calc";
import { useApp } from "@/src/lib/store";
import { aiProbed, aiStatus, probeAi, type AiStatus } from "@/src/lib/ai";
import { requestEvidence, type EvidenceSource, type OpenEvidence } from "@/src/components/diet/evidence";
import realSources from "@/src/data/real-sources.json";

export type { EvidenceSource, OpenEvidence } from "@/src/components/diet/evidence";

export type MealSlot = MealEntry["slot"];

/** 弹窗等内部滚动区的滚动条:用主题色而非浏览器默认样式。 */
export const SCROLL_CLASS =
  "scrollbar-thin [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40";

export const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export const SLOT_META: Record<MealSlot, { label: string; icon: typeof Sun; timeHint: string }> = {
  breakfast: { label: "早餐", icon: Sunrise, timeHint: "起床后 1–2 小时内" },
  lunch: { label: "午餐", icon: Sun, timeHint: "11:30–13:30" },
  dinner: { label: "晚餐", icon: Sunset, timeHint: "17:30–19:30" },
  snack: { label: "加餐", icon: Cookie, timeHint: "两餐之间或训练前后" },
};

export function defaultSlotByHour(h = new Date().getHours()): MealSlot {
  if (h >= 5 && h < 10) return "breakfast";
  if (h >= 10 && h < 14) return "lunch";
  if (h >= 14 && h < 17) return "snack";
  if (h >= 17 && h < 21) return "dinner";
  return "snack";
}

export const VERDICT_META: Record<Verdict, { label: string; className: string }> = {
  supported: { label: "证据支持", className: "border-chart-2/40 bg-chart-2/10 text-chart-2" },
  partial: { label: "部分支持", className: "border-chart-4/40 bg-chart-4/10 text-chart-4" },
  conflict: { label: "证据冲突", className: "border-destructive/40 bg-destructive/10 text-destructive" },
  insufficient: { label: "证据不足", className: "border-border bg-muted text-muted-foreground" },
};

export const REVIEW_META: Record<ReviewState, string> = {
  ai_extracted: "AI 提取",
  pending_review: "待人工复核",
  human_confirmed: "人工已确认",
  published: "已发布",
};

export const CLAIM_TYPE_LABEL: Record<string, string> = {
  efficacy: "功效", dosage: "剂量", mechanism: "机制", safety: "安全", technique: "动作技术", diet: "饮食",
};

export const LAYER_META = {
  blogger: { label: "博主原话", icon: Quote, className: "border-chart-3/40 bg-chart-3/10 text-chart-3" },
  ai: { label: "AI 拆解", icon: Bot, className: "border-chart-4/40 bg-chart-4/10 text-chart-4" },
  science: { label: "科学证据", icon: BookOpen, className: "border-chart-2/40 bg-chart-2/10 text-chart-2" },
  advice: { label: "产品建议", icon: Lightbulb, className: "border-chart-1/40 bg-chart-1/10 text-chart-1" },
} as const;

export function LayerTag({ layer, className }: { layer: keyof typeof LAYER_META; className?: string }) {
  const meta = LAYER_META[layer];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1", meta.className, className)}>
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  );
}

/** 建议与知识库结论的固定映射：只传编号，不在饮食模块里查结论内容。 */
export const DIET_CLAIM = {
  fatlossDeficit: "fatloss-caloric-deficit",
  fatlossRate: "fatloss-weekly-rate",
  muscleSurplus: "muscle-caloric-surplus",
  proteinIntake: "protein-intake-1-6g",
  proteinPerMeal: "protein-per-meal-distribution",
  staple: "staple-grain-grams",
  vegetable: "vegetable-intake-dark-ratio",
  sugar: "sugar-sweetened-beverages",
} as const;

export function adviceClaimForGoal(goal: Goal): string {
  if (goal === "fatloss") return DIET_CLAIM.fatlossDeficit;
  if (goal === "muscle") return DIET_CLAIM.muscleSurplus;
  return DIET_CLAIM.proteinPerMeal;
}

export function slotClaimId(slot: MealSlot): string {
  if (slot === "breakfast") return DIET_CLAIM.proteinPerMeal;
  if (slot === "lunch") return DIET_CLAIM.staple;
  if (slot === "dinner") return DIET_CLAIM.vegetable;
  return DIET_CLAIM.sugar;
}

export function useEvidenceOpener(onOpenEvidence?: OpenEvidence) {
  return useCallback(
    (claimId: string, source: EvidenceSource = "diet-claim") => {
      const result = requestEvidence(onOpenEvidence, claimId, source);
      if (result === "missing") {
        toast.error("依据暂时无法打开", {
          description: "页面还没接入证据抽屉，请稍后再试。",
        });
      }
    },
    [onOpenEvidence],
  );
}

/** 文献与指南不在这里展开，只留这一个入口；具体渲染交给全局证据抽屉。 */
export function WhyEvidenceButton({
  claimId,
  onOpenEvidence,
  source = "diet-claim",
  label = "为什么这样建议",
  className,
}: {
  claimId: string | null;
  onOpenEvidence?: OpenEvidence;
  source?: EvidenceSource;
  label?: string;
  className?: string;
}) {
  const open = useEvidenceOpener(onOpenEvidence);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5", className)}
      disabled={!claimId}
      title={claimId ? "在证据抽屉里查看四层出处" : "这条建议还没有关联可核验的结论"}
      onClick={() => {
        if (claimId) open(claimId, source);
      }}
    >
      <ShieldCheck className="size-4" />
      {label}
    </Button>
  );
}

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const meta = VERDICT_META[verdict];
  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      {meta.label}
    </Badge>
  );
}

export function ReviewBadge({ state }: { state: ReviewState }) {
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      {REVIEW_META[state]}
    </Badge>
  );
}

const REAL_EVIDENCE = (realSources.evidence ?? []) as unknown as EvidenceRef[];

/** 论文只从已抓取的真实数据 real-sources.json 中按 DOI 精确取用。 */
export function getEvidence(doi: string): EvidenceRef | null {
  return REAL_EVIDENCE.find((e) => e.doi === doi) ?? null;
}

export const DOI = {
  garthe2011: "10.1123/ijsnem.21.2.97",
  helms2014: "10.1186/1550-2783-11-20",
  issnProtein2017: "10.1186/s12970-017-0177-8",
  issnDiets2017: "10.1186/s12970-017-0174-y",
  morton2018: "10.1136/bjsports-2017-097608",
  jamaBeverage2022: "10.1001/jamanetworkopen.2022.2092",
} as const;

function paperUrl(ref: EvidenceRef): string | null {
  if (ref.url) return ref.url;
  if (ref.doi) return `https://doi.org/${ref.doi}`;
  return null;
}

export function PaperRef({ ref_, compact = false }: { ref_: EvidenceRef; compact?: boolean }) {
  const url = paperUrl(ref_);
  const authors = Array.isArray(ref_.authors) ? ref_.authors : [];
  const authorText = authors.length > 3 ? `${authors.slice(0, 3).join(", ")} 等` : authors.join(", ");
  return (
    <div className={cn("rounded-lg border border-border bg-muted/40", compact ? "p-2.5" : "p-3")}>
      <div className="flex items-start gap-2">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-chart-2" />
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium leading-snug", compact ? "text-xs" : "text-sm")}>{ref_.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {authorText}
            {ref_.journal ? ` · ${ref_.journal}` : ""}
            {ref_.year ? ` · ${ref_.year}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {ref_.doi && (
              <a
                href={url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                DOI {ref_.doi}
                <ExternalLink className="size-3" />
              </a>
            )}
            {ref_.pmid && (
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${ref_.pmid}/`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                PMID {ref_.pmid}
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuidelineRef({ clause }: { clause?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-2.5">
      <div className="flex items-start gap-2">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-chart-2" />
        <div className="min-w-0">
          <p className="text-xs font-medium">
            {GUIDELINE_2022.title} · {GUIDELINE_2022.issuer} · {GUIDELINE_2022.publishedAt}
          </p>
          {clause && <p className="mt-0.5 text-xs text-muted-foreground">{clause}</p>}
          <p className="mt-0.5 text-[11px] text-muted-foreground">{GUIDELINE_2022.urlNote}</p>
        </div>
      </div>
    </div>
  );
}

export function useAiStatus(): AiStatus {
  const [status, setStatus] = useState<AiStatus>(aiStatus());
  useEffect(() => {
    let live = true;
    if (aiProbed()) {
      setStatus(aiStatus());
    } else {
      probeAi().then((s) => {
        if (live) setStatus(s);
      });
    }
    return () => {
      live = false;
    };
  }, []);
  return status;
}

/** App 壳可能已挂载 Toaster;这里避免重复挂载导致提示翻倍。 */
export function DietToaster() {
  const [render, setRender] = useState(false);
  useEffect(() => {
    if (!document.querySelector("[data-sonner-toaster]")) setRender(true);
  }, []);
  return render ? <Toaster position="top-center" richColors /> : null;
}

export function useDeleteMeal() {
  const { removeEntry, addMeal } = useApp();
  return (entry: MealEntry) => {
    removeEntry("meals", entry.id);
    const { id: _id, ...rest } = entry;
    toast.success(`已删除「${entry.label}」`, {
      action: { label: "撤销", onClick: () => addMeal(rest) },
    });
  };
}

export function PhotoPreviewDialog({
  photoId,
  onOpenChange,
}: {
  photoId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { state } = useApp();
  const photo = state.photos.find((p) => p.id === photoId) ?? null;
  return (
    <Dialog open={photoId != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{photo?.label ?? "餐食照片"}</DialogTitle>
        </DialogHeader>
        {photo ? (
          <div className="flex flex-col gap-3">
            <img src={photo.dataUrl} alt={photo.label} className="max-h-[60vh] w-full rounded-lg object-contain" />
            <p className="text-xs text-muted-foreground">{photo.date} · 照片仅保存在本机浏览器</p>
            {photo.analysis && (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <LayerTag layer="ai" className="mb-1.5" />
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{photo.analysis}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">照片不存在或已被删除。</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const MAX_PHOTO_MB = 15;

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

/** 压缩到最长边 1024px 的 JPEG,避免 localStorage 超限,也加快 AI 上传。 */
export function downscaleImage(dataUrl: string, maxEdge = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      if (scale >= 1 && dataUrl.startsWith("data:image/jpeg")) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function fmtG(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** 摄入量展示统一取整：热量、克数都不给虚假小数。 */
export function fmtInt(n: number): string {
  return String(Math.round(n));
}

/** AI 估算只给区间，不把估算值显示成精确值。 */
export function approxKcal(kcal: number): string {
  const lo = Math.max(0, Math.round((kcal * 0.8) / 10) * 10);
  const hi = Math.round((kcal * 1.2) / 10) * 10;
  return `约 ${lo}–${hi} kcal`;
}

export function fmtTimeRange(start: number | null, end: number | null): string | null {
  if (start == null) return null;
  return end != null ? `${fmtClock(start)}–${fmtClock(end)}` : fmtClock(start);
}