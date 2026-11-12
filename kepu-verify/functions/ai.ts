const BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const MODEL = "qwen-vl-max";

export type AiKind = "body" | "form" | "food";

export interface FoodHint {
  id: string;
  name: string;
}

const SYSTEM = `你是「练得明白」健身应用的图像分析助手。你的输出会被明确标注为「AI 推测」，与博主原话、科学证据、产品建议分开呈现。

铁律：
1. 只描述图像中真实可见的内容。看不清、被遮挡、无法判断的，必须明说「无法判断」，绝不猜测填补。
2. 你不是医生，不做疾病诊断，不开处方。涉及疼痛、损伤、疾病一律建议咨询医生或专业教练。
3. 不给出任何「一定」「保证」「治愈」类断言。用「可能」「倾向于」「建议」等措辞。
4. 数值估计必须标注为估计，并给出合理区间而不是单一精确值。
5. 全部用简体中文回答。`;

const TASK: Record<AiKind, string> = {
  body: `任务：体态与身体状态的视觉观察。
请依次说明：
- 可见的体态特征（如肩部高低、骨盆前后倾倾向、脊柱曲度、肋骨位置），仅就照片可见范围描述；
- 照片质量是否足以判断（光线、角度、遮挡、是否穿着宽松衣物）；
- 无法从照片判断的项目（如体脂率、内脏脂肪、肌肉量），明确说明需要体测设备；
- 给新手的 2–3 条温和的下一步建议（拍照角度统一、结合围度与体重记录、必要时找专业教练评估）。
不要估算体脂率数字。不要做医学诊断。`,
  form: `任务：训练动作姿势的视觉观察。
请依次说明：
- 照片中可见的动作与身体位置；
- 可见的技术问题（如关节角度、躯干稳定、重心、握距、活动幅度），每条都要说明依据的是画面中哪个部位；
- 单张照片的局限：无法判断动作全程、离心控制、呼吸与节奏，需要视频或连续照片；
- 2–3 条可执行的纠正提示，以及「如果训练中出现疼痛应停止并咨询专业人士」。
不要断言损伤或疾病。`,
  food: `任务：识别照片中的食物并估计可食部重量。
只输出一个 JSON 对象，不要输出任何解释文字、不要用 markdown 代码块包裹。格式：
{"items":[{"label":"食物名称","grams":估计克数,"foodId":"候选ID或null","confidence":"high|medium|low"}],"note":"整体说明与不确定性"}
要求：
- grams 是估计值，给整数；无法估计重量时给 null 并在 note 说明。
- foodId 只能从下面给出的候选列表里选，选不到就填 null，绝不编造 ID。
- 烹调油、糖、酱料如果看不见就不要凭空添加，可在 note 里提醒用户自行补充。
- 识别不出的食物不要硬猜。`,
};

export interface AiResult {
  status: "ready" | "service_not_configured" | "error";
  text: string | null;
  items: { label: string; grams: number; foodId: string | null }[];
  error?: string;
}

export function aiConfigured(): boolean {
  return Boolean(Deno.env.get("DASHSCOPE_API_KEY"));
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function analyzeImage(
  kind: AiKind,
  image: string,
  context: string,
  foods: FoodHint[],
): Promise<AiResult> {
  const key = Deno.env.get("DASHSCOPE_API_KEY");
  if (!key) {
    return { status: "service_not_configured", text: null, items: [] };
  }
  if (!image.startsWith("data:image/")) {
    return { status: "error", text: null, items: [], error: "invalid_image" };
  }

  let task = TASK[kind];
  if (kind === "food") {
    const list = foods.map((f) => `${f.id}=${f.name}`).join("; ");
    task += `\n候选食物列表（foodId 只能取自此处）：${list}`;
  }

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: image } },
          { type: "text", text: `${task}\n\n用户补充信息：${context || "（无）"}` },
        ],
      },
    ],
    temperature: 0.2,
  };

  let res: Response;
  try {
    res = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return { status: "error", text: null, items: [], error: "upstream_unreachable" };
  }

  if (!res.ok) {
    return { status: "error", text: null, items: [], error: `upstream_${res.status}` };
  }

  let payload: { choices?: { message?: { content?: string } }[] };
  try {
    payload = await res.json();
  } catch {
    return { status: "error", text: null, items: [], error: "upstream_bad_json" };
  }

  const raw = payload.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { status: "error", text: null, items: [], error: "upstream_empty" };
  }

  if (kind !== "food") {
    return { status: "ready", text: raw.trim(), items: [] };
  }

  const parsed = extractJson(raw) as {
    items?: { label?: unknown; grams?: unknown; foodId?: unknown }[];
    note?: unknown;
  } | null;

  if (!parsed || !Array.isArray(parsed.items)) {
    return { status: "ready", text: raw.trim(), items: [] };
  }

  const valid = new Set(foods.map((f) => f.id));
  const items = parsed.items
    .filter((it) => typeof it?.label === "string" && it.label.trim().length > 0)
    .slice(0, 20)
    .map((it) => {
      const grams = typeof it.grams === "number" && Number.isFinite(it.grams) && it.grams > 0
        ? Math.round(it.grams)
        : 0;
      const foodId = typeof it.foodId === "string" && valid.has(it.foodId) ? it.foodId : null;
      return { label: String(it.label).trim().slice(0, 40), grams, foodId };
    });

  const note = typeof parsed.note === "string" ? parsed.note.trim() : "";
  return { status: "ready", text: note || null, items };
}