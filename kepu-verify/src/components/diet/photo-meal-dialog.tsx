import { useRef, useState } from "react";
import {
  Camera, CircleAlert, ImagePlus, Info, Loader2, Plus, RefreshCw, ScanLine, Trash2, TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { FoodItem } from "@/src/lib/types";
import { FOOD_BY_ID, scaleFood } from "@/src/data/foods";
import { GOAL_LABEL, uid } from "@/src/lib/calc";
import { useApp } from "@/src/lib/store";
import { AI_FALLBACK_HINT, analyzeImage, type AiImageResult } from "@/src/lib/ai";
import { FoodPickerDialog } from "@/src/components/diet/food-library";
import { ManualMealForm, SlotToggle } from "@/src/components/diet/meal-entry-dialog";
import {
  LayerTag, MAX_PHOTO_MB, SLOT_META, SCROLL_CLASS, approxKcal, downscaleImage, fileToDataUrl, fmtInt,
  useAiStatus, type MealSlot,
} from "@/src/components/diet/shared";

type Stage = "pick" | "analyzing" | "review" | "manual";

interface AiRow {
  key: string;
  aiLabel: string;
  grams: number;
  foodId: string | null;
}

function AiRowsEditor({
  rows,
  onChange,
}: {
  rows: AiRow[];
  onChange: (rows: AiRow[]) => void;
}) {
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  function patch(key: string, p: Partial<AiRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const food = row.foodId ? FOOD_BY_ID.get(row.foodId) ?? null : null;
        const n = food && row.grams > 0 ? scaleFood(food, row.grams) : null;
        return (
          <div key={row.key} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {row.aiLabel}
                  {!food && (
                    <Badge variant="outline" className="ml-2 border-chart-4/40 bg-chart-4/10 text-chart-4">
                      未匹配食物库
                    </Badge>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">AI 识别名称,可更换为食物库中的对应食物</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="删除这一行"
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={food ? "secondary" : "outline"}
                size="sm"
                onClick={() => setPickerFor(row.key)}
              >
                {food ? food.name : "选择对应食物…"}
              </Button>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={10}
                  value={Number.isFinite(row.grams) ? row.grams : ""}
                  onChange={(e) => patch(row.key, { grams: Number.parseFloat(e.target.value) || 0 })}
                  className="h-8 w-24 tabular-nums"
                  aria-label={`${row.aiLabel} 的克数`}
                />
                <span className="text-xs text-muted-foreground">g</span>
              </div>
              {n && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {approxKcal(n.kcal)} · 蛋白约 {fmtInt(n.protein)} g / 碳水约 {fmtInt(n.carb)} g / 脂肪约 {fmtInt(n.fat)} g
                </span>
              )}
            </div>
            {!food && (
              <p className="mt-1.5 text-xs text-chart-4">
                这一项还没匹配到食物库,无法计算热量;请选择对应食物或删除该行。
              </p>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { key: uid(), aiLabel: "手动添加", grams: 100, foodId: null }])}
      >
        <Plus className="size-4" />
        添加一行
      </Button>
      <FoodPickerDialog
        open={pickerFor != null}
        onOpenChange={(o) => {
          if (!o) setPickerFor(null);
        }}
        onPick={(f: FoodItem) => {
          if (pickerFor) patch(pickerFor, { foodId: f.id });
          setPickerFor(null);
        }}
      />
    </div>
  );
}

export function PhotoMealDialog({
  open,
  onOpenChange,
  date,
  slot: initialSlot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  slot: MealSlot;
}) {
  const { state, addMeal, addPhoto } = useApp();
  const aiStatusNow = useAiStatus();
  const [stage, setStage] = useState<Stage>("pick");
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [photo, setPhoto] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<AiImageResult | null>(null);
  const [rows, setRows] = useState<AiRow[]>([]);
  const [notice, setNotice] = useState<"not_configured" | "error" | "empty" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef(0);

  function reset() {
    sessionRef.current += 1;
    setStage("pick");
    setPhoto(null);
    setFileError(null);
    setReading(false);
    setResult(null);
    setRows([]);
    setNotice(null);
    setSlot(initialSlot);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function runAnalysis(dataUrl: string, s: MealSlot) {
    const session = sessionRef.current;
    setStage("analyzing");
    const ctx = `日期 ${date},餐次 ${SLOT_META[s].label}。` +
      (state.profile
        ? `用户目标:${GOAL_LABEL[state.profile.goal]},体重 ${state.profile.weightKg} kg。`
        : "") +
      "请估算照片中每种食物的名称和克数。";
    const r = await analyzeImage("food", dataUrl, ctx);
    if (session !== sessionRef.current) return;
    setResult(r);
    if (r.status === "ready" && r.items.length > 0) {
      setRows(
        r.items.map((it) => ({
          key: uid(),
          aiLabel: it.label,
          grams: Number.isFinite(it.grams) && it.grams > 0 ? Math.round(it.grams) : 100,
          foodId: it.foodId && FOOD_BY_ID.has(it.foodId) ? it.foodId : null,
        })),
      );
      setNotice(null);
      setStage("review");
    } else if (r.status === "ready") {
      setNotice("empty");
      setStage("manual");
    } else {
      setNotice(r.status === "error" ? "error" : "not_configured");
      setStage("manual");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileError(null);
    if (!file.type.startsWith("image/")) {
      setFileError("请选择图片文件( JPG / PNG 等)。");
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setFileError(`图片超过 ${MAX_PHOTO_MB} MB,请压缩后再上传。`);
      return;
    }
    setReading(true);
    try {
      const raw = await fileToDataUrl(file);
      const small = await downscaleImage(raw);
      setPhoto(small);
      setReading(false);
      if (aiStatusNow === "ready") {
        await runAnalysis(small, slot);
      } else {
        setNotice(aiStatusNow === "error" ? "error" : "not_configured");
        setStage("manual");
      }
    } catch {
      setReading(false);
      setFileError("读取图片失败,请换一张试试。");
    }
  }

  function saveAiRows() {
    if (!photo) return;
    const valid = rows.filter((r) => r.foodId && FOOD_BY_ID.has(r.foodId) && r.grams > 0);
    if (valid.length === 0) return;
    const photoId = addPhoto({
      date,
      kind: "food",
      dataUrl: photo,
      label: `${SLOT_META[slot].label}照片`,
      analysis: result?.text ?? null,
      analysisSource: "ai",
    });
    let total = 0;
    for (const r of valid) {
      const food = FOOD_BY_ID.get(r.foodId!)!;
      const n = scaleFood(food, r.grams);
      total += n.kcal;
      addMeal({
        date,
        slot,
        foodId: food.id,
        label: food.name,
        grams: r.grams,
        kcal: n.kcal,
        protein: n.protein,
        carb: n.carb,
        fat: n.fat,
        photoId,
        source: "ai",
        note: r.aiLabel !== food.name ? `AI 识别名称:${r.aiLabel}` : "",
      });
    }
    toast.success(`已保存 ${valid.length} 条记录 · 估算合计 ${approxKcal(total)}`, {
      description: "AI 估算份量已经你核对；保存后总量仍按近似值展示。",
    });
    onOpenChange(false);
  }

  const unmatched = rows.filter((r) => !r.foodId || !FOOD_BY_ID.has(r.foodId)).length;
  const invalidGrams = rows.filter((r) => r.grams <= 0).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className={`max-h-[88vh] max-w-lg overflow-y-auto ${SCROLL_CLASS}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-4 text-muted-foreground" />
            拍照记一餐
          </DialogTitle>
          <DialogDescription>
            照片仅保存在本机浏览器;使用 AI 识别时会发送到本站识别接口,不会公开或转载。
          </DialogDescription>
        </DialogHeader>

        {stage === "pick" && (
          <div className="flex flex-col gap-4">
            <SlotToggle value={slot} onChange={setSlot} />
            {aiStatusNow !== "ready" && (
              <Alert>
                <Info />
                <AlertTitle>{aiStatusNow === "error" ? "AI 服务暂不可用" : "AI 图像识别未配置"}</AlertTitle>
                <AlertDescription>
                  {aiStatusNow === "error"
                    ? "识别服务探测失败,你可以先手动录入;照片仍会随记录保存。"
                    : AI_FALLBACK_HINT.food}
                </AlertDescription>
              </Alert>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:bg-muted/60"
            >
              {reading ? (
                <Spinner className="size-8 text-muted-foreground" />
              ) : (
                <ImagePlus className="size-8 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">{reading ? "正在读取照片…" : "选择照片或拍照"}</span>
              <span className="text-xs text-muted-foreground">
                支持 JPG / PNG,不超过 {MAX_PHOTO_MB} MB;上传后自动压缩
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="上传餐食照片"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
            <Button variant="outline" onClick={() => setStage("manual")}>
              不拍照,直接手动录入
            </Button>
          </div>
        )}

        {stage === "analyzing" && (
          <div className="flex flex-col items-center gap-4 py-6">
            {photo && <img src={photo} alt="待识别的餐食照片" className="max-h-48 rounded-lg object-contain" />}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              AI 正在识别照片中的食物和份量…
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                sessionRef.current += 1;
                setStage("manual");
              }}
            >
              跳过 AI,手动录入
            </Button>
          </div>
        )}

        {stage === "review" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              {photo && <img src={photo} alt="餐食照片" className="size-20 shrink-0 rounded-lg object-cover" />}
              <div className="min-w-0 flex-1">
                <SlotToggle value={slot} onChange={setSlot} />
              </div>
            </div>
            <Alert>
              <TriangleAlert />
              <AlertTitle>AI 估算,请核对份量</AlertTitle>
              <AlertDescription>
                以下食物名称和克数由 AI 估算,可能有误。请逐项核对、修改克数或更换食物后再保存。
                保存后的热量只按区间理解,不当作精确值。
              </AlertDescription>
            </Alert>
            {result?.text && (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <LayerTag layer="ai" className="mb-1.5" />
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{result.text}</p>
              </div>
            )}
            <AiRowsEditor rows={rows} onChange={setRows} />
            {(unmatched > 0 || invalidGrams > 0) && (
              <p className="text-xs text-chart-4">
                {unmatched > 0 ? `还有 ${unmatched} 项未匹配食物库;` : ""}
                {invalidGrams > 0 ? `有 ${invalidGrams} 项克数无效;` : ""}
                处理后才能保存。
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStage("manual")}>
                改为手动录入
              </Button>
              <Button
                className="flex-1"
                disabled={rows.length === 0 || unmatched > 0 || invalidGrams > 0}
                onClick={saveAiRows}
              >
                <ScanLine className="size-4" />
                核对无误,保存 {rows.length} 项
              </Button>
            </div>
          </div>
        )}

        {stage === "manual" && (
          <div className="flex flex-col gap-4">
            {notice === "not_configured" && (
              <Alert>
                <Info />
                <AlertTitle>AI 图像识别未配置</AlertTitle>
                <AlertDescription>{AI_FALLBACK_HINT.food}</AlertDescription>
              </Alert>
            )}
            {notice === "error" && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>AI 服务调用失败</AlertTitle>
                <AlertDescription>
                  网络或服务暂时不可用,你可以重试,或直接手动录入,结果同样准确。
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => photo && void runAnalysis(photo, slot)}
                  >
                    <RefreshCw className="size-4" />
                    重试 AI 识别
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {notice === "empty" && (
              <Alert>
                <Info />
                <AlertTitle>AI 没有识别出食物</AlertTitle>
                <AlertDescription>
                  照片里可能没有清晰的食物。请手动选择食物并输入克数。
                </AlertDescription>
              </Alert>
            )}
            <ManualMealForm
              date={date}
              initialSlot={slot}
              photoDataUrl={photo}
              onSaved={() => onOpenChange(false)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}