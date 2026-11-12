import type { EvidenceRef } from "@/src/lib/types";

/**
 * 三个只读证据端点的封装。全部走本站 Function（/functions/v1/app），
 * 由后端访问 Crossref / Europe PMC / B 站公开接口。
 * 铁律：拿不到就返回 not_found / error，绝不返回猜测内容；
 * 每条自动获取的元数据都带 provider，UI 必须标注「待人工核对」。
 */

export interface RemoteRef {
  doi: string | null;
  pmid: string | null;
  title: string;
  authors: string[];
  journal: string | null;
  year: number | null;
  abstract: string | null;
  url: string | null;
  provider: string;
  pubType: string[];
  citedBy: number | null;
}

export interface RemoteVideo {
  platform: "bilibili" | "douyin";
  bvid?: string;
  aweme_id?: string;
  title: string | null;
  author: string | null;
  url: string;
  pubdate?: number | null;
  duration?: number | null;
  description?: string;
  stat?: { view: number | null; like: number | null };
  chapters?: { startSec: number; title: string }[];
  subtitleStatus?: string;
  note?: string;
  retrievedAt: string;
}

export type Remote<T> =
  | { status: "ok"; data: T }
  | { status: "not_found"; message: string }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

const BASE = "/functions/v1/app";
const TIMEOUT_MS = 25_000;

export const PROVIDER_LABEL: Record<string, string> = {
  crossref: "Crossref · DOI 官方登记机构",
  europepmc: "Europe PMC · PubMed 摘要库",
  bilibili: "哔哩哔哩公开视频接口",
  douyin: "抖音公开页面 SEO 元信息",
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider] ?? provider;
}

export const SUBTITLE_LABEL: Record<string, string> = {
  available: "字幕接口返回可用",
  missing_requires_login: "逐字字幕需登录，未获取",
  none: "该视频没有字幕",
};

export const MANUAL_FALLBACK = "自动获取失败不会用猜测内容填补：你仍可手动填写后加入待审核列表，由人工核对。";

const ERROR_TEXT: Record<string, string> = {
  doi_or_pmid_required: "请提供 DOI 或 PMID。",
  url_required: "请粘贴视频链接。",
  unsupported_platform: "只支持 B 站（BV 号）与抖音（aweme_id）链接。",
  not_found: "官方接口未查到该编号，请核对 DOI / PMID 是否正确。",
  bilibili_fetch_failed: "B 站公开接口未返回元信息（视频可能已删除、受限或接口限流）。",
  douyin_fetch_failed: "抖音公开页面未返回元信息（客户端渲染或访问受限）。",
};

interface Envelope {
  ok?: boolean;
  error?: string;
  ref?: RemoteRef;
  refs?: RemoteRef[];
  count?: number;
  source?: RemoteVideo;
}

async function call(path: string, init?: RequestInit): Promise<{ status: number; body: Envelope | null }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json", ...(init?.headers ?? {}) },
  });
  let body: Envelope | null = null;
  try {
    body = (await res.json()) as Envelope;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/** ERROR_TEXT 里的句子自带句号，拼接前先去掉，避免出现「。。」。 */
function sentence(s: string): string {
  return s.replace(/。+$/, "");
}

function failure(status: number, body: Envelope | null, subject: string): Remote<never> {
  const code = body?.error ?? "";
  const known = ERROR_TEXT[code];
  if (status === 404 || code === "not_found") {
    return { status: "not_found", message: `${subject}未查到：${sentence(known ?? "官方接口没有这条记录")}。${MANUAL_FALLBACK}` };
  }
  if (status === 400) {
    return { status: "invalid", message: known ?? "请求参数不合法，请检查编号或链接格式。" };
  }
  return {
    status: "error",
    message: `${subject}自动获取失败（HTTP ${status}${code ? ` · ${code}` : ""}）：${sentence(known ?? "服务端或外部接口异常")}。${MANUAL_FALLBACK}`,
  };
}

function networkFailure(subject: string, err: unknown): Remote<never> {
  const timeout = err instanceof DOMException && err.name === "TimeoutError";
  return {
    status: "error",
    message: timeout
      ? `${subject}请求超时（${TIMEOUT_MS / 1000} 秒）。外部接口可能较慢，可重试。${MANUAL_FALLBACK}`
      : `${subject}无法连接证据服务（${BASE}）。请确认本地后端已启动。${MANUAL_FALLBACK}`,
  };
}

/** DOI 走 Crossref，PMID 走 Europe PMC；两者都只返回真实抓到的字段。 */
export async function lookupEvidence(input: { doi?: string | null; pmid?: string | null }): Promise<Remote<RemoteRef>> {
  const doi = input.doi?.trim();
  const pmid = input.pmid?.trim();
  if (!doi && !pmid) return { status: "invalid", message: ERROR_TEXT.doi_or_pmid_required };
  const subject = doi ? "Crossref" : "Europe PMC";
  const qs = doi ? `doi=${encodeURIComponent(doi)}` : `pmid=${encodeURIComponent(pmid!)}`;
  try {
    const { status, body } = await call(`/evidence/lookup?${qs}`);
    if (status === 200 && body?.ok && body.ref?.title) return { status: "ok", data: body.ref };
    return failure(status, body, `${subject} 元数据`);
  } catch (err) {
    return networkFailure(`${subject} 元数据`, err);
  }
}

/** 关键词检索：后端把主题词锁标题、其余词锁标题/摘要，按被引降序。 */
export async function searchEvidenceRemote(query: string, limit = 5): Promise<Remote<RemoteRef[]>> {
  const q = query.trim();
  if (q.length < 3) return { status: "invalid", message: "关键词至少 3 个字符，建议用英文主题词，例如 creatine muscle hypertrophy。" };
  if (q.length > 300) return { status: "invalid", message: "关键词过长（上限 300 字符），请精简。" };
  try {
    const { status, body } = await call(`/evidence/search?q=${encodeURIComponent(q)}&limit=${Math.min(Math.max(limit, 1), 15)}`);
    if (status === 200 && body?.ok && Array.isArray(body.refs)) {
      if (body.refs.length === 0) {
        return { status: "not_found", message: `Europe PMC 未检索到「${q}」的相关文献。换成英文主题词 + 人群/指标再试，例如 protein intake muscle mass。` };
      }
      return { status: "ok", data: body.refs };
    }
    return failure(status, body, "文献检索");
  } catch (err) {
    return networkFailure("文献检索", err);
  }
}

/** 视频元信息：B 站返回标题/UP主/时长/分P；抖音只有 SEO 元信息。字幕一律需登录未获取。 */
export async function fetchVideoMeta(url: string): Promise<Remote<RemoteVideo>> {
  const input = url.trim();
  if (!input) return { status: "invalid", message: ERROR_TEXT.url_required };
  try {
    const { status, body } = await call("/sources/video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: input }),
    });
    if (status === 200 && body?.ok && body.source) return { status: "ok", data: body.source };
    return failure(status, body, "视频元信息");
  } catch (err) {
    return networkFailure("视频元信息", err);
  }
}

/** 远端结构 → 本站 EvidenceRef，provider 原样保留，供 UI 标注来源与「待人工核对」。 */
export function toEvidenceRef(r: RemoteRef): EvidenceRef {
  return {
    doi: r.doi,
    pmid: r.pmid,
    title: r.title,
    authors: r.authors,
    journal: r.journal,
    year: r.year,
    abstract: r.abstract,
    url: r.url ?? (r.doi ? `https://doi.org/${r.doi}` : r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : null),
    provider: r.provider,
    pubType: r.pubType,
    citedBy: r.citedBy,
  };
}

export function refKey(r: { doi: string | null; pmid: string | null; title: string }): string {
  return (r.doi ?? "").toLowerCase() || (r.pmid ?? "") || r.title.toLowerCase();
}

/** 自动补全只写人工没碰过的字段：dirty 的一律保留，接口值绝不覆盖人工输入。 */
export function autoFillPatch<T extends string>(
  values: Record<T, string>,
  dirty: Partial<Record<string, boolean | undefined>>,
): Partial<Record<T, string>> {
  const patch: Partial<Record<T, string>> = {};
  for (const k of Object.keys(values) as T[]) {
    if (!dirty[k]) patch[k] = values[k];
  }
  return patch;
}