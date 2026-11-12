import type { Profile } from "@/src/lib/types";
import { defaultConfig, type PlanConfig } from "@/src/components/plan/dietEngine";

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 只随机训练字段；饮食字段保留档案默认值，训练页不再展示它们。 */
export function randomConfig(p: Profile): PlanConfig {
  const d = defaultConfig(p);
  return {
    ...d,
    goal: pick(["muscle", "fatloss", "recomp"] as const),
    trainingDays: 1 + Math.floor(Math.random() * 6),
    level: pick(["novice", "intermediate"] as const),
    split: pick(["auto", "full", "upperlower", "ppl", "three"] as const),
  };
}

export function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
