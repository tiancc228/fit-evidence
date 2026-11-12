import { useMemo, useState } from "react";
import { Apple, Beef, Carrot, CupSoda, Flame, Milk, Nut, Plus, Search, Wheat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { FoodItem } from "@/src/lib/types";
import { FOODS, FOOD_CATEGORIES } from "@/src/data/foods";
import { fmtG } from "@/src/components/diet/shared";

const CATEGORY_ICON: Record<string, typeof Wheat> = {
  谷薯: Wheat,
  蛋白质: Beef,
  奶类: Milk,
  蔬菜: Carrot,
  水果: Apple,
  油脂坚果: Nut,
  饮品零食: CupSoda,
};

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = CATEGORY_ICON[category] ?? Wheat;
  return <Icon className={className} />;
}

function useFoodFilter() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("全部");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FOODS.filter((f) => {
      if (category !== "全部" && f.category !== category) return false;
      if (q && !f.name.toLowerCase().includes(q) && !f.id.includes(q)) return false;
      return true;
    });
  }, [query, category]);
  return { query, setQuery, category, setCategory, filtered };
}

function CategoryChips({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-1.5 pb-1">
        {["全部", ...FOOD_CATEGORIES].map((c) => (
          <Button
            key={c}
            type="button"
            size="sm"
            variant={value === c ? "default" : "outline"}
            className="shrink-0 rounded-full"
            onClick={() => onChange(c)}
          >
            {c !== "全部" && <CategoryIcon category={c} className="size-3.5" />}
            {c}
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}

function MacroCell({ label, value, unit = "g" }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-2 py-1.5 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold tabular-nums">
        {fmtG(value)}
        <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

export function FoodLibrary({ onPick }: { onPick: (foodId: string) => void }) {
  const { query, setQuery, category, setCategory, filtered } = useFoodFilter();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索食物,如:鸡胸肉、米饭、牛奶…"
            className="pl-9"
            aria-label="搜索食物"
          />
        </div>
        <CategoryChips value={category} onChange={setCategory} />
        <p className="text-xs text-muted-foreground">
          共 {filtered.length} 种 · 以下均为每 100 g 可食部参考值,数据源自《中国食物成分表》;实际烹饪用油请单独记录。
        </p>
      </div>

      {filtered.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>没有找到「{query}」</EmptyTitle>
            <EmptyDescription>
              换个关键词试试,或切换分类。食物库覆盖约 60 种常见食物,后续会持续扩充。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => (
            <div
              key={f.id}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <CategoryIcon category={f.category} className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {f.category}
                      {f.gramsPerUnit != null ? ` · 1 ${f.unit} ≈ ${f.gramsPerUnit} g` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-chart-1">
                  <Flame className="size-4" />
                  <span className="text-sm font-bold tabular-nums">{f.kcal}</span>
                  <span className="text-[10px] text-muted-foreground">kcal</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <MacroCell label="蛋白质" value={f.protein} />
                <MacroCell label="碳水" value={f.carb} />
                <MacroCell label="脂肪" value={f.fat} />
                <MacroCell label="纤维" value={f.fiber} />
              </div>
              <Button size="sm" variant="secondary" className="w-full" onClick={() => onPick(f.id)}>
                <Plus className="size-4" />
                记一笔
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FoodPickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (food: FoodItem) => void;
}) {
  const { query, setQuery, category, setCategory, filtered } = useFoodFilter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-3">
        <DialogHeader>
          <DialogTitle>选择食物</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索食物名称…"
            className="pl-9"
            aria-label="搜索食物"
          />
        </div>
        <CategoryChips value={category} onChange={setCategory} />
        <ScrollArea className="min-h-0 flex-1">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              没有匹配的食物,换个关键词试试。
            </p>
          ) : (
            <div className="flex flex-col gap-1 pr-3">
              {filtered.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onPick(f);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-colors",
                    "hover:border-border hover:bg-accent",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <CategoryIcon category={f.category} className="size-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{f.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      蛋白 {fmtG(f.protein)} · 碳水 {fmtG(f.carb)} · 脂肪 {fmtG(f.fat)} g/100g
                      {f.gramsPerUnit != null ? ` · 1 ${f.unit} ≈ ${f.gramsPerUnit} g` : ""}
                    </span>
                  </span>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {f.kcal} kcal
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <p className="text-[11px] text-muted-foreground">
          每 100 g 参考值 · 来源《中国食物成分表》
        </p>
      </DialogContent>
    </Dialog>
  );
}