import { aiConfigured, analyzeImage, type AiKind, type FoodHint } from "./ai.ts";
import { lookupDoi, lookupPmid, searchEvidence } from "./evidence.ts";
import { fetchBilibili, fetchDouyin, parseAwemeId, parseBvid } from "./sources.ts";

const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };
const MAX_IMAGE_BYTES = 8_000_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

function route(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  // 本地是 /functions/v1/app/…，云端网关把函数名换成上游物理名 /app-<id>/…，
  // 所以只能丢掉函数名那一段，不能按字面匹配 app。
  const rest = parts[0] === "functions" ? parts.slice(3) : parts.slice(1);
  return "/" + rest.join("/");
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (text.length > MAX_IMAGE_BYTES) return null;
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = route(url.pathname);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...HEADERS, Allow: "GET, POST, OPTIONS" },
    });
  }

  if (path === "/" || path === "/health") {
    return json({ ok: true, service: "kepu-verify", aiConfigured: aiConfigured() });
  }

  if (path === "/ai/status" && method === "GET") {
    return json({ configured: aiConfigured() });
  }

  if (path === "/ai/analyze" && method === "POST") {
    if (!aiConfigured()) {
      return json({ status: "service_not_configured", text: null, items: [], error: "service_not_configured" }, 503);
    }
    const body = await readBody(request);
    if (!body) return json({ status: "error", error: "invalid_body" }, 400);

    const kind = body.kind;
    if (kind !== "body" && kind !== "form" && kind !== "food") {
      return json({ status: "error", error: "invalid_kind" }, 400);
    }
    const image = body.image;
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return json({ status: "error", error: "invalid_image" }, 400);
    }
    const context = typeof body.context === "string" ? body.context.slice(0, 2000) : "";
    const foods: FoodHint[] = Array.isArray(body.foods)
      ? (body.foods as unknown[])
        .filter((f): f is FoodHint =>
          !!f && typeof f === "object" &&
          typeof (f as FoodHint).id === "string" && typeof (f as FoodHint).name === "string")
        .slice(0, 200)
        .map((f) => ({ id: f.id.slice(0, 60), name: f.name.slice(0, 60) }))
      : [];

    const result = await analyzeImage(kind as AiKind, image, context, foods);
    return json(result, result.status === "error" ? 502 : 200);
  }

  if (path === "/evidence/lookup" && method === "GET") {
    const doi = url.searchParams.get("doi");
    const pmid = url.searchParams.get("pmid");
    if (!doi && !pmid) return json({ ok: false, error: "doi_or_pmid_required" }, 400);
    const ref = doi ? await lookupDoi(doi) : await lookupPmid(pmid!);
    if (!ref) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true, ref });
  }

  if (path === "/evidence/search" && method === "GET") {
    const q = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "8");
    const refs = await searchEvidence(q, Number.isFinite(limit) ? limit : 8);
    return json({ ok: true, count: refs.length, refs });
  }

  if (path === "/sources/video" && method === "POST") {
    const body = await readBody(request);
    const input = typeof body?.url === "string" ? body.url : "";
    if (!input) return json({ ok: false, error: "url_required" }, 400);

    const bvid = parseBvid(input);
    if (bvid) {
      const meta = await fetchBilibili(bvid);
      if (!meta) return json({ ok: false, error: "bilibili_fetch_failed" }, 502);
      return json({ ok: true, source: meta });
    }
    const aweme = parseAwemeId(input);
    if (aweme) {
      const meta = await fetchDouyin(aweme);
      if (!meta) return json({ ok: false, error: "douyin_fetch_failed" }, 502);
      return json({ ok: true, source: meta });
    }
    return json({ ok: false, error: "unsupported_platform" }, 400);
  }

  return json({ ok: false, error: "not_found", path }, 404);
}