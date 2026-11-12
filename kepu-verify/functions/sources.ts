export interface VideoMeta {
  platform: "bilibili";
  bvid: string;
  title: string;
  author: string;
  mid: number | null;
  pubdate: number | null;
  duration: number | null;
  description: string;
  url: string;
  pic: string | null;
  stat: { view: number | null; like: number | null };
  chapters: { startSec: number; title: string }[];
  subtitleStatus: "available" | "missing_requires_login" | "none";
  retrievedAt: string;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function parseBvid(input: string): string | null {
  const s = input.trim();
  const direct = s.match(/^(BV[0-9A-Za-z]{10})$/);
  if (direct) return direct[1];
  const fromUrl = s.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]{10})/);
  if (fromUrl) return fromUrl[1];
  const anywhere = s.match(/(BV[0-9A-Za-z]{10})/);
  return anywhere ? anywhere[1] : null;
}

export async function fetchBilibili(bvid: string): Promise<VideoMeta | null> {
  let res: Response;
  try {
    res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/", Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let data: {
    code?: number;
    data?: {
      bvid?: string; title?: string; desc?: string; pic?: string; pubdate?: number; duration?: number;
      owner?: { name?: string; mid?: number };
      stat?: { view?: number; like?: number };
      pages?: { cid?: number; part?: string; duration?: number }[];
    };
  };
  try {
    data = await res.json();
  } catch {
    return null;
  }
  if (data.code !== 0 || !data.data?.title) return null;
  const d = data.data;

  const chapters: { startSec: number; title: string }[] = [];
  if (Array.isArray(d.pages) && d.pages.length > 1) {
    let offset = 0;
    for (const p of d.pages) {
      const part = (p.part ?? "").trim();
      if (part && part !== d.title) chapters.push({ startSec: offset, title: part.slice(0, 80) });
      offset += p.duration ?? 0;
    }
  }

  return {
    platform: "bilibili",
    bvid: d.bvid ?? bvid,
    title: d.title,
    author: d.owner?.name ?? "",
    mid: d.owner?.mid ?? null,
    pubdate: d.pubdate ?? null,
    duration: d.duration ?? null,
    description: (d.desc ?? "").slice(0, 2000),
    url: `https://www.bilibili.com/video/${d.bvid ?? bvid}`,
    pic: d.pic ?? null,
    stat: { view: d.stat?.view ?? null, like: d.stat?.like ?? null },
    chapters,
    subtitleStatus: "missing_requires_login",
    retrievedAt: new Date().toISOString(),
  };
}

export function parseAwemeId(input: string): string | null {
  const s = input.trim();
  if (/^\d{15,25}$/.test(s)) return s;
  const m = s.match(/douyin\.com\/(?:video|note)\/(\d{15,25})/);
  return m ? m[1] : null;
}

export interface DouyinMeta {
  platform: "douyin";
  aweme_id: string;
  url: string;
  title: string | null;
  author: string | null;
  retrievedAt: string;
  subtitleStatus: "missing_requires_login";
  note: string;
}

export async function fetchDouyin(awemeId: string): Promise<DouyinMeta | null> {
  const url = `https://www.douyin.com/video/${awemeId}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let html: string;
  try {
    html = await res.text();
  } catch {
    return null;
  }
  const pick = (re: RegExp): string | null => {
    const m = html.match(re);
    return m ? m[1].trim() : null;
  };
  const title = pick(/<title[^>]*>([^<]+)<\/title>/i);
  const desc = pick(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const author = pick(/<meta\s+name="author"\s+content="([^"]*)"/i);
  if (!title && !desc) return null;
  return {
    platform: "douyin",
    aweme_id: awemeId,
    url,
    title: title ? title.replace(/-抖音$/, "").trim() : desc,
    author,
    retrievedAt: new Date().toISOString(),
    subtitleStatus: "missing_requires_login",
    note: "抖音页面为客户端渲染，服务端仅能取到 SEO 元信息。章节要点需在真实浏览器中读取，逐字字幕需登录。",
  };
}