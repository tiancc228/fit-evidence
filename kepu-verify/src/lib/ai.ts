import { FOODS } from "@/src/data/foods";

export type AiStatus = "ready" | "service_not_configured" | "error";

export interface AiImageResult {
  status: AiStatus;
  text: string | null;
  items: { label: string; grams: number; foodId: string | null }[];
}

const ENDPOINT = "/functions/v1/app/ai/analyze";

let cached: AiStatus = "service_not_configured";
let probed = false;

/**
 * Synchronous last-known status. Defaults to not-configured so pages render the
 * manual fallback until a probe proves otherwise.
 */
export function aiStatus(): AiStatus {
  return cached;
}

export async function probeAi(): Promise<AiStatus> {
  try {
    const r = await fetch("/functions/v1/app/ai/status", { method: "GET" });
    if (!r.ok) {
      cached = r.status === 503 ? "service_not_configured" : "error";
    } else {
      const j = (await r.json()) as { configured?: boolean };
      cached = j.configured ? "ready" : "service_not_configured";
    }
  } catch {
    cached = "service_not_configured";
  }
  probed = true;
  return cached;
}

export function aiProbed(): boolean {
  return probed;
}

/**
 * Sends the image to the site Function, which holds the DashScope secret.
 * Never invents a result: any failure surfaces as a status the UI must explain.
 */
export async function analyzeImage(
  kind: "body" | "form" | "food",
  dataUrl: string,
  ctx: string,
): Promise<AiImageResult> {
  const empty: AiImageResult = { status: "service_not_configured", text: null, items: [] };
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        image: dataUrl,
        context: ctx,
        foods: kind === "food" ? FOODS.map((f) => ({ id: f.id, name: f.name })) : undefined,
      }),
    });

    if (r.status === 503) {
      cached = "service_not_configured";
      return empty;
    }
    if (!r.ok) {
      cached = "error";
      return { status: "error", text: null, items: [] };
    }

    const j = (await r.json()) as Partial<AiImageResult> & { error?: string };
    if (j.error === "service_not_configured") {
      cached = "service_not_configured";
      return empty;
    }
    cached = "ready";
    return {
      status: "ready",
      text: typeof j.text === "string" ? j.text : null,
      items: Array.isArray(j.items) ? j.items : [],
    };
  } catch {
    cached = "service_not_configured";
    return empty;
  }
}

export const AI_STATUS_LABEL: Record<AiStatus, string> = {
  ready: "AI 图像识别已配置（是否成功以调用结果为准）",
  service_not_configured: "AI 图像识别未配置",
  error: "AI 服务调用失败",
};

export const AI_FALLBACK_HINT: Record<"body" | "form" | "food", string> = {
  body: "未配置 AI 图像识别，无法从照片判断体脂或体型。请手动填写体重、体脂率和围度，评估结果同样准确。",
  form: "未配置 AI 图像识别，无法从照片判断动作问题。请在下方自查清单里勾选你遇到的情况，系统会给出纠正方法和教学视频。",
  food: "未配置 AI 图像识别，无法从照片估算份量。请从食物库手动选择食物并输入克数，热量计算同样准确。",
};