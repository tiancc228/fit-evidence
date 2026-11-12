import { useMemo } from "react";
import type { Claim } from "@/src/lib/types";
import { CLAIMS } from "@/src/data/knowledge";
import { applyOverride, useApp } from "@/src/lib/store";

/**
 * claimId → 内容 的查找集中在这里：调用方只传编号，不接触底层数据。
 * 未发布的结论也能查到，由抽屉决定拦成什么状态——不在这里静默过滤，
 * 否则「编号存在但没发布」会被误显示成「编号不存在」。
 */
export function useEvidenceTarget() {
  const { state } = useApp();
  const merged = useMemo(
    () => CLAIMS.map((c) => applyOverride(c, state.claimOverrides)),
    [state.claimOverrides],
  );
  const byId = useMemo(() => new Map(merged.map((c) => [c.id, c])), [merged]);
  const published = useMemo(() => merged.filter((c) => c.review.state === "published"), [merged]);

  return {
    merged,
    published,
    getClaim: (id: string | null): Claim | null => (id == null ? null : byId.get(id) ?? null),
  };
}
