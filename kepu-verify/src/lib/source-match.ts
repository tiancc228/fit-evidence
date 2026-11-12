/**
 * 来源匹配与去重的纯函数，不依赖任何数据文件，便于单元测试。
 * 只做判断，不产生任何文案，不推断内容。
 */

export type MatchLevel = "exact" | "near" | "none";

export const EQUIPMENT_TOKENS = ["哑铃", "杠铃", "史密斯", "器械", "绳索", "壶铃", "弹力带", "自重", "高脚杯", "泽奇"] as const;

const POSITION_TOKENS = ["上斜", "下斜", "平板", "坐姿", "站姿", "俯身", "单臂", "高位", "低位", "仰卧", "跪姿", "直臂", "反向", "双杠", "悬垂"];

/** "18:04" / "1:02:03" / 秒数 → 秒；无法解析返回 null，不猜测。 */
export function toSec(d: unknown): number | null {
  if (typeof d === "number" && Number.isFinite(d) && d >= 0) return Math.round(d);
  if (typeof d !== "string") return null;
  const parts = d.split(":").map((s) => Number(s));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/** 去掉器械与体位修饰，留下动作核心词，例如「上斜哑铃卧推」→「卧推」。 */
export function coreName(name: string): string {
  let out = name;
  for (const t of [...EQUIPMENT_TOKENS, ...POSITION_TOKENS]) out = out.split(t).join("");
  return out.trim();
}

export function equipmentOf(text: string): string[] {
  return EQUIPMENT_TOKENS.filter((t) => text.includes(t));
}

/**
 * 系列视频里常混入饮食、补剂等非动作内容（例如「卧推系列⑩——饮食」），
 * 它们虽然标题含动作词，但不教动作，必须排除，否则会污染动作教学列表。
 */
const NON_TECHNIQUE_TOKENS = /饮食|补剂|营养|食谱|热量|碳水|脱水|补餐/;

/**
 * 判断一段文本（标题 + 分P/章节标题）与某个动作的关系。
 * exact：文本出现动作全名；或出现动作核心词且没有点名任何冲突器械。
 * near ：出现动作核心词，但文本明确点名了另一种器械（哑铃/杠铃/史密斯不能混为一谈）。
 * none ：连核心词都没出现，或属于饮食/补剂类非动作内容。
 */
export function matchExercise(text: string, exerciseName: string): MatchLevel {
  if (!text) return "none";
  if (NON_TECHNIQUE_TOKENS.test(text)) return "none";
  if (text.includes(exerciseName)) return "exact";

  const core = coreName(exerciseName);
  if (core.length < 2 || !text.includes(core)) return "none";

  const want = equipmentOf(exerciseName);
  const got = equipmentOf(text);
  const conflict = got.some((g) => !want.includes(g));
  return conflict ? "near" : "exact";
}

/** 近似匹配时，指出文本里多出来的器械，用于向用户说明差异。 */
export function equipmentDiff(text: string, exerciseName: string): string | null {
  const want = equipmentOf(exerciseName);
  const extra = equipmentOf(text).filter((g) => !want.includes(g));
  return extra.length ? extra.join("、") : null;
}

export interface DedupeCandidate {
  id: string;
  kind: "bilibili" | "douyin";
  author: string;
  durationSec: number | null;
  url: string;
  richness: number;
}

/**
 * 跨平台同内容判定：同一作者 + 时长误差 ≤3 秒。
 * 只用于「同一人把同一视频发到多个平台」这一种情况，不做内容相似度推断。
 */
export function sameWork(a: DedupeCandidate, b: DedupeCandidate): boolean {
  if (a.kind === b.kind) return false;
  if (!a.author || a.author !== b.author) return false;
  if (a.durationSec == null || b.durationSec == null) return false;
  return Math.abs(a.durationSec - b.durationSec) <= 3;
}
