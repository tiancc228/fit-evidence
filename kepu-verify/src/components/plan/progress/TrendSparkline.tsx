import type { StrengthSummary } from "@/src/components/plan/progress/strengthMetrics";

export function TrendSparkline({ trend, exerciseName }: {
  trend: StrengthSummary["trend"];
  exerciseName: string;
}) {
  const points = trend.points;
  const W = 220;
  const H = 56;
  const pad = 6;
  const values = points.map((p) => p.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (points.length - 1);
    const ratio = span === 0 ? 0.5 : (p.weightKg - min) / span;
    const y = H - pad - ratio * (H - pad * 2);
    return { x, y, ...p };
  });

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-14 w-full"
        role="img"
        aria-label={`${exerciseName} 最近 30 天最大重量趋势，${points.length} 个数据点`}
      >
        {trend.enough && (
          <polyline
            points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-science"
          />
        )}
        {coords.map((c) => (
          <circle key={c.date} cx={c.x} cy={c.y} r="2.5" className="fill-science">
            <title>{`${c.date} · ${c.weightKg} kg`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{points[0]?.date}</span>
        <span>
          {min === max ? `${min} kg` : `${min}–${max} kg`}
        </span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}
