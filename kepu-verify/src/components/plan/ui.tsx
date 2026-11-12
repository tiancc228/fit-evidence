import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type Tone = "advice" | "science" | "ai" | "voice" | "warn";

export const CHIP: Record<Tone, string> = {
  advice: "bg-advice-soft text-advice",
  science: "bg-science-soft text-science",
  ai: "bg-ai-soft text-ai",
  voice: "bg-voice-soft text-voice",
  warn: "bg-warn/10 text-warn",
};

export function Stat({ icon: Icon, label, value, unit, sub, tone }: {
  icon: typeof Flame; label: string; value: string; unit?: string; sub: string; tone: Tone;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 items-center justify-center rounded-lg", CHIP[tone])}>
          <Icon className="size-3.5" />
        </span>
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums leading-none">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{sub}</p>
    </div>
  );
}

export function ConsoleRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 [&>div]:w-full">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        {hint && <span className="text-[11px] tabular-nums text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
