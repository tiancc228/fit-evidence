import { useMemo, useState } from "react";
import { Beef, Droplets, Flame, ImagePlus, Plus, Wheat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FoodItem } from "@/src/lib/types";
import { FOOD_BY_ID, scaleFood } from "@/src/data/foods";
import { useApp } from "@/src/lib/store";
import { FoodPickerDialog } from "@/src/components/diet/food-library";
import { SLOT_META, SLOT_ORDER, SCROLL_CLASS, fmtInt, type MealSlot } from "@/src/components/diet/shared";

export function SlotToggle({ value, onChange }: { value: MealSlot; onChange: (s: MealSlot) => void }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as MealSlot);
      }}
      className="grid w-full grid-cols-4"
      aria-label="选择餐次"
    >
      {SLOT_ORDER.map((s) => {
        const Meta = SLOT_META[s];
        const Icon = Meta.icon;
        return (
          <ToggleGroupItem key={s} value={s} className="gap-1.5">
            <Icon className="size-4" />
            {Meta.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export function ManualMealForm({
  date,
  initialSlot,
  initialFoodId,
  photoDataUrl,
  onSaved,
}: {
  date: string;
  initialSlot: MealSlot;
  initialFoodId?: string | null;
  photoDataUrl?: string | null;
  onSaved?: () => void;
}) {
  const { addMeal, addPhoto } = useApp();
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [food, setFood] = useState<FoodItem | null>(() =>
    initialFoodId ? FOOD_BY_ID.get(initialFoodId) ?? null : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<"g" | "unit">(() =>
    initialFoodId && FOOD_BY_ID.get(initialFoodId)?.gramsPerUnit != null ? "unit" : "g",
  );
  const [amount, setAmount] = useState(() =>
    initialFoodId && FOOD_BY_ID.get(initialFoodId)?.gramsPerUnit != null ? "1" : "100",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const grams = useMemo(() => {
    const v = Number.parseFloat(amount);
    if (!Number.isFinite(v) || v <= 0) return null;
    const g = mode === "unit" && food?.gramsPerUnit != null ? v * food.gramsPerUnit : v;
    return Math.round(g * 10) / 10;
  }, [amount, mode, food]);

  const nutrition = food && grams != null ? scaleFood(food, grams) : null;

  function pickFood(f: FoodItem) {
    setFood(f);
    setError(null);
    if (f.gramsPerUnit != null) {
      setMode("unit");
      setAmount("1");
    } else {
      setMode("g");
      setAmount("100");
    }
  }

  function save() {
    if (!food) {
      setError("请先从食物库选择食物。");
      return;
    }
    if (grams == null || grams <= 0) {
      setError("请输入正确的份量(大于 0)。");
      return;
    }
    if (grams > 5000) {
      setError("单条份量超过 5000 g,请确认是否输入有误。");
      return;
    }
    const n = scaleFood(food, grams);
    let photoId: string | null = null;
    if (photoDataUrl) {
      photoId = addPhoto({
        date,
        kind: "food",
        dataUrl: photoDataUrl,
        label: `${SLOT_META[slot].label}照片`,
        analysis: null,
        analysisSource: null,
      });
    }
    addMeal({
      date,
      slot,
      foodId: food.id,
      label: food.name,
      grams,
      kcal: n.kcal,
      protein: n.protein,
      carb: n.carb,
      fat: n.fat,
      photoId,
      source: "database",
      note: note.trim(),
    });
    toast.success(`已记录 ${food.name} ${fmtInt(grams)} g · ${n.kcal} kcal`, {
      description: `${SLOT_META[slot].label} · 蛋白质 ${fmtInt(n.protein)} / 碳水 ${fmtInt(n.carb)} / 脂肪 ${fmtInt(n.fat)} g`,
    });
    setFood(null);
    setNote("");
    setAmount("100");
    setMode("g");
    setError(null);
    onSaved?.();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>餐次</Label>
        <SlotToggle value={slot} onChange={setSlot} />
      </div>

      {photoDataUrl && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2.5">
          <img src={photoDataUrl} alt="餐食照片预览" className="size-14 rounded-lg object-cover" />
          <p className="text-xs text-muted-foreground">
            照片将随这条记录一起保存(仅存本机浏览器)。
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>食物</Label>
        <Button type="button" variant="outline" className="justify-between" onClick={() => setPickerOpen(true)}>
          {food ? (
            <span className="flex items-center gap-2">
              <span className="font-medium">{food.name}</span>
              <span className="text-xs text-muted-foreground">{food.kcal} kcal/100g</span>
            </span>
          ) : (
            <span className="text-muted-foreground">从食物库选择…</span>
          )}
          <Plus className="size-4" />
        </Button>
        <FoodPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onPick={pickFood} />
      </div>

      {food && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="meal-amount">份量</Label>
            {food.gramsPerUnit != null && (
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={mode}
                onValueChange={(v) => {
                  if (!v) return;
                  const next = v as "g" | "unit";
                  setMode(next);
                  setAmount(next === "unit" ? "1" : String(food.gramsPerUnit ?? 100));
                }}
                aria-label="份量单位"
              >
                <ToggleGroupItem value="g" className="px-3">按克</ToggleGroupItem>
                <ToggleGroupItem value="unit" className="px-3">按{food.unit}</ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="meal-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step={mode === "unit" ? 0.5 : 10}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              className="text-base tabular-nums"
            />
            <span className="shrink-0 text-sm text-muted-foreground">
              {mode === "unit" ? food.unit : "g"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === "unit" && food.gramsPerUnit != null
              ? `1 ${food.unit} ≈ ${food.gramsPerUnit} g,当前约 ${grams != null ? fmtInt(grams) : "—"} g`
              : `参考:1 ${food.unit}${food.gramsPerUnit != null ? ` ≈ ${food.gramsPerUnit} g` : ""}`}
          </p>
        </div>
      )}

      {nutrition && (
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex items-baseline gap-1.5">
            <Flame className="size-4 text-chart-1" />
            <span className="text-2xl font-bold tabular-nums">{nutrition.kcal}</span>
            <span className="text-xs text-muted-foreground">kcal · 按 {fmtInt(grams ?? 0)} g 换算（参考值）</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg bg-background px-1 py-1.5">
              <Beef className="mx-auto size-3.5 text-chart-2" />
              <p className="mt-0.5 text-xs font-semibold tabular-nums">{fmtInt(nutrition.protein)} g</p>
              <p className="text-[10px] text-muted-foreground">蛋白质</p>
            </div>
            <div className="rounded-lg bg-background px-1 py-1.5">
              <Wheat className="mx-auto size-3.5 text-chart-4" />
              <p className="mt-0.5 text-xs font-semibold tabular-nums">{fmtInt(nutrition.carb)} g</p>
              <p className="text-[10px] text-muted-foreground">碳水</p>
            </div>
            <div className="rounded-lg bg-background px-1 py-1.5">
              <Droplets className="mx-auto size-3.5 text-chart-1" />
              <p className="mt-0.5 text-xs font-semibold tabular-nums">{fmtInt(nutrition.fat)} g</p>
              <p className="text-[10px] text-muted-foreground">脂肪</p>
            </div>
            <div className="rounded-lg bg-background px-1 py-1.5">
              <Wheat className="mx-auto size-3.5 text-chart-5" />
              <p className="mt-0.5 text-xs font-semibold tabular-nums">{fmtInt(nutrition.fiber)} g</p>
              <p className="text-[10px] text-muted-foreground">纤维</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="meal-note">备注(可选)</Label>
        <Input
          id="meal-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="如:食堂打的、少油版…"
          maxLength={50}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={save} disabled={!food || grams == null} className="w-full">
        <Plus className="size-4" />
        保存这条记录
      </Button>
    </div>
  );
}

export function MealEntryDialog({
  open,
  onOpenChange,
  date,
  slot,
  initialFoodId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  slot: MealSlot;
  initialFoodId?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[88vh] max-w-md overflow-y-auto ${SCROLL_CLASS}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="size-4 text-muted-foreground" />
            手动记一餐
          </DialogTitle>
          <DialogDescription>
            从食物库选食物、输入份量,热量按《中国食物成分表》每 100 g 参考值换算。
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ManualMealForm
            date={date}
            initialSlot={slot}
            initialFoodId={initialFoodId}
            onSaved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}