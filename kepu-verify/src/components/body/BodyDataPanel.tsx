import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Ruler, Plus, Trash2, TrendingDown, TrendingUp, Minus, LineChart as LineChartIcon, Info } from "lucide-react";

import { useApp } from "@/src/lib/store";
import type { BodyEntry } from "@/src/lib/types";
import { today, fmtDate } from "@/src/lib/calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { EmptyState, InfoNote, SectionHeading, SCROLL_Y } from "@/src/components/body/shared";

const weightConfig = { weightKg: { label: "体重 (kg)", color: "var(--chart-1)" } } satisfies ChartConfig;
const fatConfig = { bodyFatPct: { label: "体脂率 (%)", color: "var(--chart-2)" } } satisfies ChartConfig;

type Draft = {
  date: string;
  weightKg: string;
  bodyFatPct: string;
  waistCm: string;
  chestCm: string;
  armCm: string;
  thighCm: string;
  note: string;
};

const emptyDraft = (): Draft => ({
  date: today(),
  weightKg: "",
  bodyFatPct: "",
  waistCm: "",
  chestCm: "",
  armCm: "",
  thighCm: "",
  note: "",
});

function optNum(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const MEASURES: { key: keyof Draft; label: string; unit: string; placeholder: string }[] = [
  { key: "waistCm", label: "腰围", unit: "cm", placeholder: "肚脐水平一周" },
  { key: "chestCm", label: "胸围", unit: "cm", placeholder: "乳头水平一周" },
  { key: "armCm", label: "臂围", unit: "cm", placeholder: "上臂最粗处" },
  { key: "thighCm", label: "大腿围", unit: "cm", placeholder: "大腿最粗处" },
];

export function BodyDataPanel() {
  const { state, addBody, removeEntry } = useApp();
  const entries = React.useMemo(
    () => [...(state.body as BodyEntry[])].sort((a, b) => a.date.localeCompare(b.date)),
    [state.body],
  );
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [error, setError] = React.useState<string | null>(null);

  const chartData = entries.map((e) => ({ date: e.date, weightKg: e.weightKg, bodyFatPct: e.bodyFatPct }));
  const hasFat = entries.some((e) => e.bodyFatPct != null);
  const latest = entries[entries.length - 1];
  const prev = entries[entries.length - 2];
  const first = entries[0];
  const weightDelta = latest && prev ? +(latest.weightKg - prev.weightKg).toFixed(1) : null;
  const totalDelta = latest && first ? +(latest.weightKg - first.weightKg).toFixed(1) : null;

  function set<K extends keyof Draft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const w = optNum(draft.weightKg);
    if (w == null || w < 25 || w > 300) {
      setError("请填写有效体重（25–300 kg），其它围度可留空。");
      return;
    }
    const fat = optNum(draft.bodyFatPct);
    if (fat != null && (fat < 3 || fat > 60)) {
      setError("体脂率需在 3–60% 之间，或留空。");
      return;
    }
    setError(null);
    const entry: Omit<BodyEntry, "id"> = {
      date: draft.date || today(),
      weightKg: w,
      bodyFatPct: fat,
      waistCm: optNum(draft.waistCm),
      chestCm: optNum(draft.chestCm),
      armCm: optNum(draft.armCm),
      thighCm: optNum(draft.thighCm),
      photoId: null,
      note: draft.note.trim(),
    };
    addBody(entry);
    toast.success(`已记录 ${fmtDate(entry.date)} 的身体数据`);
    setDraft({ ...emptyDraft(), date: entry.date });
  }

  return (
    <Card>
      <CardHeader>
        <SectionHeading
          icon={Ruler}
          title="每日身体数据"
          desc="体重和围度是比照片更客观的进度尺。建议固定晨起空腹、同一把秤测量。"
        />
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={submit} className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="body-date">日期</Label>
              <Input id="body-date" type="date" value={draft.date} max={today()} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="body-weight">体重（kg）· 必填</Label>
              <Input id="body-weight" type="number" inputMode="decimal" step={0.1} placeholder="例如 66.5" value={draft.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="body-fat">体脂率（%）· 可空</Label>
              <Input id="body-fat" type="number" inputMode="decimal" step={0.1} placeholder="有体脂秤再填" value={draft.bodyFatPct} onChange={(e) => set("bodyFatPct", e.target.value)} />
            </div>
            {MEASURES.map((m) => (
              <div key={m.key} className="grid gap-2">
                <Label htmlFor={`body-${m.key}`}>{m.label}（{m.unit}）</Label>
                <Input id={`body-${m.key}`} type="number" inputMode="decimal" step={0.1} placeholder={m.placeholder} value={draft[m.key]} onChange={(e) => set(m.key, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body-note">备注</Label>
            <Input id="body-note" placeholder="例如：练腿第二天，略水肿" value={draft.note} onChange={(e) => set("note", e.target.value)} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit">
            <Plus className="size-4" />
            记录今天的数据
          </Button>
        </form>

        {entries.length === 0 ? (
          <EmptyState
            icon={LineChartIcon}
            title="还没有身体数据"
            desc="先在上方记录一次体重，之后每隔几天记一次，就能看到变化曲线。"
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">最新体重</span>
              <span className="text-xl font-semibold tabular-nums">{latest.weightKg} kg</span>
              {weightDelta != null ? (
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", weightDelta > 0 ? "border-chart-5/40 bg-chart-5/10 text-chart-5" : weightDelta < 0 ? "border-chart-2/40 bg-chart-2/10 text-chart-2" : "border-border bg-muted text-muted-foreground")}>
                  {weightDelta > 0 ? <TrendingUp className="size-3" /> : weightDelta < 0 ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
                  较上次 {weightDelta > 0 ? "+" : ""}{weightDelta} kg
                </span>
              ) : null}
              {totalDelta != null && entries.length > 1 ? (
                <span className="text-xs text-muted-foreground">累计 {totalDelta > 0 ? "+" : ""}{totalDelta} kg · 共 {entries.length} 次记录</span>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">体重趋势（kg）</p>
                {entries.length < 2 ? (
                  <p className="flex h-40 items-center justify-center text-center text-xs text-muted-foreground">再记录一次即可生成曲线。<br />当前：{latest.weightKg} kg</p>
                ) : (
                  <ChartContainer config={weightConfig} className="h-44 w-full aspect-auto">
                    <LineChart data={chartData} margin={{ left: -12, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} tickFormatter={(v: number) => `${v}`} />
                      <ChartTooltip content={<ChartTooltipContent labelFormatter={(l) => fmtDate(String(l))} />} />
                      <Line type="monotone" dataKey="weightKg" stroke="var(--color-weightKg)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ChartContainer>
                )}
              </div>
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">体脂率趋势（%）</p>
                {!hasFat ? (
                  <p className="flex h-40 items-center justify-center text-center text-xs text-muted-foreground">还没有体脂数据。<br />没有体脂秤也没关系，看体重和围度即可。</p>
                ) : (
                  <ChartContainer config={fatConfig} className="h-44 w-full aspect-auto">
                    <LineChart data={chartData} margin={{ left: -12, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} />
                      <ChartTooltip content={<ChartTooltipContent labelFormatter={(l) => fmtDate(String(l))} />} />
                      <Line type="monotone" dataKey="bodyFatPct" stroke="var(--color-bodyFatPct)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                    </LineChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            <div className={cn("max-h-64 rounded-lg border", SCROLL_Y)}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">日期</th>
                    <th className="px-3 py-2 text-right font-medium">体重</th>
                    <th className="px-3 py-2 text-right font-medium">体脂</th>
                    <th className="px-3 py-2 text-right font-medium">腰围</th>
                    <th className="px-3 py-2 text-right font-medium">臂围</th>
                    <th className="px-3 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...entries].reverse().map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="px-3 py-2 tabular-nums">{fmtDate(e.date)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.weightKg}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{e.bodyFatPct != null ? `${e.bodyFatPct}%` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{e.waistCm != null ? e.waistCm : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{e.armCm != null ? e.armCm : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`删除 ${fmtDate(e.date)} 的记录`}
                          onClick={() => {
                            removeEntry("body", e.id);
                            toast.success("已删除该条身体数据");
                          }}
                        >
                          <Trash2 className="size-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <InfoNote icon={Info}>
              体重每天会因水分、饮食、排便波动 1–2 kg，属正常现象。看 1–2 周的整体趋势，别盯单日数字。围度建议每 1–2 周测一次。
            </InfoNote>
          </>
        )}
      </CardContent>
    </Card>
  );
}
