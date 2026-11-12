import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Quote as QuoteIcon,
  Bot as BotIcon,
  FlaskConical as FlaskIcon,
  BookOpen as BookIcon,
  Compass as CompassIcon,
  Sigma as SigmaIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** Semantic status tones mapped onto the theme's dedicated ok/warn/bad/info palette. */
export type Tone = "low" | "ok" | "warn" | "bad";

export const TONE: Record<Tone, { text: string; bg: string; border: string; bar: string; ring: string }> = {
  low: { text: "text-info", bg: "bg-info/10", border: "border-info/40", bar: "bg-info", ring: "ring-info/30" },
  ok: { text: "text-ok", bg: "bg-ok/10", border: "border-ok/40", bar: "bg-ok", ring: "ring-ok/30" },
  warn: { text: "text-warn", bg: "bg-warn/10", border: "border-warn/40", bar: "bg-warn", ring: "ring-warn/30" },
  bad: { text: "text-bad", bg: "bg-bad/10", border: "border-bad/40", bar: "bg-bad", ring: "ring-bad/30" },
};

/** Scrollbars drawn in the artifact's own palette instead of the browser default. */
export const SCROLL_X =
  "overflow-x-auto scrollbar-thin [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-chart-1/40 hover:[&::-webkit-scrollbar-thumb]:bg-chart-1/70";
export const SCROLL_Y =
  "overflow-y-auto scrollbar-thin [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-chart-2/40 hover:[&::-webkit-scrollbar-thumb]:bg-chart-2/70";

export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", t.bg, t.border, t.text, className)}>
      <span className={cn("size-1.5 rounded-full", t.bar)} />
      {children}
    </span>
  );
}

/** The four provenance layers must never be visually merged.
 *  Colors follow the canonical system in globals.css / kb/meta.ts:
 *  博主原话=voice(品红) · AI 拆解=ai(电蓝) · 科学证据/膳食指南=science(青绿) · 产品建议=advice(柠檬绿). */
export type LayerKind = "quote" | "ai" | "evidence" | "guideline" | "advice" | "calc";
const LAYER: Record<LayerKind, { label: string; cls: string; icon: LucideIcon }> = {
  quote: { label: "博主原话", cls: "text-voice border-voice/30 bg-voice-soft", icon: QuoteIcon },
  ai: { label: "AI 拆解", cls: "text-ai border-ai/30 bg-ai-soft", icon: BotIcon },
  evidence: { label: "科学证据", cls: "text-science border-science/30 bg-science-soft", icon: FlaskIcon },
  guideline: { label: "膳食指南", cls: "text-science border-science/30 bg-science-soft", icon: BookIcon },
  advice: { label: "产品建议", cls: "text-advice border-advice/30 bg-advice-soft", icon: CompassIcon },
  calc: { label: "公式计算", cls: "text-muted-foreground border-border bg-muted", icon: SigmaIcon },
};

export function LayerTag({ kind, className }: { kind: LayerKind; className?: string }) {
  const l = LAYER[kind];
  const Icon = l.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium", l.cls, className)}>
      <Icon className="size-3" />
      {l.label}
    </span>
  );
}

export function SectionHeading({
  icon: Icon,
  title,
  desc,
  right,
  className,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  desc?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-chart-1/15 to-chart-2/15 text-chart-1 ring-1 ring-border">
          <Icon className="size-5" />
        </span>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {desc ? <p className="text-sm text-muted-foreground">{desc}</p> : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone,
  accent = "bg-chart-1",
  className,
}: {
  icon?: LucideIcon;
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  tone?: Tone;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-card p-4", tone && TONE[tone].border, className)}>
      <span className={cn("absolute inset-y-0 left-0 w-1", tone ? TONE[tone].bar : accent)} />
      <div className="flex items-center gap-2 pl-1 text-xs font-medium text-muted-foreground">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1 pl-1">
        <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", tone && TONE[tone].text)}>{value}</span>
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1.5 pl-1 text-xs leading-relaxed text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

/** Colored progress meter with a plain-language gap readout. */
export function MeterRow({
  icon: Icon,
  label,
  current,
  target,
  unit,
  barClass,
  explain,
}: {
  icon?: LucideIcon;
  label: React.ReactNode;
  current: number;
  target: number;
  unit: string;
  barClass: string;
  explain?: React.ReactNode;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const gap = Math.round(target - current);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
          {label}
        </span>
        <span className="tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{Math.round(current)}</span> / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-500", barClass)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{explain ?? `${pct}% 目标`}</span>
        <span className={cn("tabular-nums font-medium", gap > 0 ? "text-warn" : "text-ok")}>
          {gap > 0 ? `还差 ${gap} ${unit}` : gap < 0 ? `超出 ${Math.abs(gap)} ${unit}` : "刚好达标"}
        </span>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
  children,
  className,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  desc?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("border border-border bg-muted/30", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-gradient-to-br from-chart-1/15 to-chart-2/15 text-chart-1">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {desc ? <EmptyDescription>{desc}</EmptyDescription> : null}
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  );
}

export function InfoNote({ icon: Icon, children, className }: { icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground", className)}>
      {Icon ? <Icon className="mt-0.5 size-3.5 shrink-0" /> : null}
      <span>{children}</span>
    </p>
  );
}

/** Read an image File and downscale it to a storage-friendly JPEG dataURL. */
export async function resizeImageFile(file: File, maxDim = 1000, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("读取文件失败，请重试"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("无法解析这张图片，请换一张"));
    i.src = dataUrl;
  });
  const longest = Math.max(img.width, img.height);
  const scale = Math.min(1, maxDim / longest);
  if (scale === 1 && file.size < 350_000) return dataUrl;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function nf(n: number): string {
  return n.toLocaleString("zh-CN");
}
