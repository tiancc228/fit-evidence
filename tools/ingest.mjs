// Real-data ingestion. Every persisted field originates from a live HTTP response.
// Nothing here invents titles, authors, DOIs, PMIDs or timestamps.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "..", "kepu-verify", "src", "data");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

const log = [];
const note = (s) => { log.push(s); console.log(s); };

async function get(url, { headers = {}, timeout = 25000, json = true } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, ...headers },
      signal: ctl.signal,
      redirect: "follow",
    });
    const text = await r.text();
    if (!r.ok) return { ok: false, status: r.status, text };
    return { ok: true, status: r.status, text, data: json ? safeJson(text) : null };
  } catch (e) {
    return { ok: false, status: 0, error: String(e.name || e.message) };
  } finally { clearTimeout(t); }
}
function safeJson(t) { try { return JSON.parse(t); } catch { return null; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Bilibili ----------
async function biliUser(keyword) {
  const r = await get(
    `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(keyword)}`,
    { headers: { Referer: "https://www.bilibili.com/" } }
  );
  const hit = r.data?.data?.result?.find?.((x) => x.uname === keyword) || r.data?.data?.result?.[0];
  if (!hit) { note(`[bili] user not found: ${keyword}`); return null; }
  return {
    mid: hit.mid, uname: hit.uname, usign: hit.usign, fans: hit.fans,
    videos: hit.videos, face: hit.upic?.startsWith("//") ? "https:" + hit.upic : hit.upic,
    recent: (hit.res || []).map((v) => ({
      bvid: v.bvid, title: v.title, pubdate: v.pubdate,
      url: `https://www.bilibili.com/video/${v.bvid}`,
      pic: v.pic?.startsWith("//") ? "https:" + v.pic : v.pic,
    })),
  };
}

async function biliVideo(bvid) {
  const r = await get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
    headers: { Referer: `https://www.bilibili.com/video/${bvid}` },
  });
  const d = r.data?.data;
  if (!d) { note(`[bili] view failed ${bvid}: ${r.data?.code ?? r.status}`); return null; }
  return {
    bvid: d.bvid, aid: d.aid, cid: d.pages?.[0]?.cid,
    title: d.title, desc: d.desc, duration: d.duration,
    pubdate: d.pubdate, cover: d.pic,
    owner: { mid: d.owner?.mid, name: d.owner?.name, face: d.owner?.face },
    stat: { view: d.stat?.view, like: d.stat?.like },
    url: `https://www.bilibili.com/video/${d.bvid}`,
  };
}

async function biliVideoSearch(keyword, page = 1) {
  const r = await get(
    `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(keyword)}&page=${page}`,
    { headers: { Referer: "https://search.bilibili.com/" } }
  );
  const res = r.data?.data?.result;
  if (!Array.isArray(res)) { note(`[bili] video search failed "${keyword}": ${r.data?.code ?? r.status}`); return []; }
  return res.map((v) => ({
    bvid: v.bvid, title: String(v.title || "").replace(/<[^>]+>/g, ""),
    author: v.author, mid: v.mid, pubdate: v.pubdate, duration: v.duration,
    description: v.description, play: v.play,
    url: `https://www.bilibili.com/video/${v.bvid}`,
    pic: v.pic?.startsWith("//") ? "https:" + v.pic : v.pic,
  }));
}

// Subtitle attempt: public player endpoint. Frequently requires login/WBI signing.
async function biliSubtitle(aid, cid, bvid) {
  for (const ep of ["v2", "wbi/v2"]) {
    const r = await get(`https://api.bilibili.com/x/player/${ep}?aid=${aid}&cid=${cid}`, {
      headers: { Referer: `https://www.bilibili.com/video/${bvid}` },
    });
    const subs = r.data?.data?.subtitle?.subtitles;
    if (Array.isArray(subs) && subs.length) {
      const s = subs.find((x) => x.lan === "zh-CN") || subs[0];
      const u = s.subtitle_url?.startsWith("//") ? "https:" + s.subtitle_url : s.subtitle_url;
      if (!u) continue;
      const body = await get(u, { headers: { Referer: `https://www.bilibili.com/video/${bvid}` } });
      const cues = body.data?.body;
      if (Array.isArray(cues) && cues.length) {
        return { status: "fetched", lan: s.lan, cues: cues.map((c) => ({ from: c.from, to: c.to, text: c.content })) };
      }
    }
  }
  return { status: "missing", reason: "subtitle endpoint requires login or WBI signature" };
}

// ---------- Douyin ----------
function douyinFromHtml(html) {
  const m = html.match(/window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (!m) return null;
  const j = safeJson(m[1]);
  if (!j?.loaderData) return null;
  for (const key of Object.keys(j.loaderData)) {
    const node = j.loaderData[key];
    const info = node?.videoInfoRes || node?.aweme_detail || node?.item_list?.[0];
    if (!info) continue;
    const item = info.item_list?.[0] || info;
    if (!item?.desc && !item?.aweme_id) continue;
    return {
      aweme_id: String(item.aweme_id || ""),
      desc: item.desc || "",
      create_time: item.create_time || null,
      duration: item.video?.duration || item.duration || null,
      author: item.author?.nickname || null,
      author_sec_uid: item.author?.sec_uid || null,
      author_signature: item.author?.signature || null,
      cover: item.video?.cover?.url_list?.[0] || item.video?.origin_cover?.url_list?.[0] || null,
      stats: item.statistics ? {
        digg: item.statistics.digg_count, comment: item.statistics.comment_count,
        share: item.statistics.share_count, collect: item.statistics.collect_count,
      } : null,
    };
  }
  return null;
}

async function douyinVideo(id) {
  const r = await get(`https://www.iesdouyin.com/share/video/${id}/`, {
    headers: { "User-Agent": MOBILE_UA }, json: false,
  });
  if (!r.ok) { note(`[douyin] fetch failed ${id}: ${r.status}`); return null; }
  const parsed = douyinFromHtml(r.text);
  if (!parsed) { note(`[douyin] no SSR payload for ${id}`); return null; }
  return { ...parsed, url: `https://www.douyin.com/video/${parsed.aweme_id || id}` };
}

// ---------- Scientific literature ----------
async function crossref(query, rows = 4) {
  const r = await get(
    `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${rows}&select=DOI,title,author,container-title,published,type,abstract,URL,subject`,
    { headers: { "User-Agent": "KePuVerify/1.0 (mailto:research@example.org)" } }
  );
  const items = r.data?.message?.items;
  if (!Array.isArray(items)) { note(`[crossref] failed "${query}": ${r.status}`); return []; }
  return items.filter((i) => i.DOI && i.title?.[0]).map((i) => ({
    doi: i.DOI,
    title: i.title[0],
    authors: (i.author || []).slice(0, 8).map((a) => [a.given, a.family].filter(Boolean).join(" ")),
    journal: i["container-title"]?.[0] || null,
    year: i.published?.["date-parts"]?.[0]?.[0] || null,
    type: i.type || null,
    abstract: i.abstract ? i.abstract.replace(/<[^>]+>/g, "").slice(0, 1600) : null,
    url: i.URL || `https://doi.org/${i.DOI}`,
    provider: "crossref",
  }));
}

async function europepmc(query, size = 4) {
  const r = await get(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${size}&resultType=core`
  );
  const items = r.data?.resultList?.result;
  if (!Array.isArray(items)) { note(`[europepmc] failed "${query}": ${r.status}`); return []; }
  return items.filter((i) => i.title).map((i) => ({
    doi: i.doi || null,
    pmid: i.pmid || null,
    title: i.title,
    authors: (i.authorString || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8),
    journal: i.journalInfo?.journal?.title || i.journalTitle || null,
    year: i.pubYear ? Number(i.pubYear) : null,
    type: i.pubType || null,
    abstract: i.abstractText ? i.abstractText.slice(0, 1600) : null,
    url: i.doi ? `https://doi.org/${i.doi}` : (i.pmid ? `https://europepmc.org/article/MED/${i.pmid}` : null),
    provider: "europepmc",
  }));
}

// ---------- run ----------
const TOPICS = [
  { id: "protein", label: "蛋白质摄入量与增肌", q: "protein intake resistance training muscle hypertrophy meta-analysis", zh: "蛋白质 增肌 摄入量" },
  { id: "frequency", label: "抗阻训练频率", q: "resistance training frequency muscle hypertrophy systematic review", zh: "训练频率 增肌" },
  { id: "failure", label: "训练至力竭的必要性", q: "training to failure versus non failure muscle strength hypertrophy", zh: "力竭 训练" },
  { id: "deficit", label: "减脂期能量赤字与瘦体重", q: "energy deficit rate fat loss lean mass retention athletes", zh: "热量缺口 减脂" },
  { id: "creatine", label: "肌酸补充剂", q: "creatine monohydrate supplementation safety efficacy position stand", zh: "肌酸 补剂" },
  { id: "whey", label: "乳清蛋白与其他蛋白来源", q: "whey protein versus other protein sources body composition", zh: "乳清蛋白" },
  { id: "concurrent", label: "有氧与抗阻并行训练", q: "concurrent aerobic resistance training interference effect", zh: "有氧 抗阻 并行" },
  { id: "sleep", label: "睡眠与恢复体成分", q: "sleep restriction body composition muscle recovery athletes", zh: "睡眠 恢复" },
  { id: "sodium", label: "食盐与添加糖限量", q: "sodium intake reduction blood pressure systematic review", zh: "食盐 限量" },
  { id: "novice", label: "新手神经适应与力量增长", q: "neural adaptations strength training untrained beginners", zh: "新手 力量 神经适应" },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const stamp = new Date().toISOString();

  note("=== 1. Bilibili bloggers ===");
  const bloggers = [];
  for (const kw of ["凯圣王", "谭成义"]) {
    const u = await biliUser(kw);
    if (u) { bloggers.push({ platform: "bilibili", ...u, retrieved_at: stamp }); note(`[bili] ${u.uname} mid=${u.mid} fans=${u.fans} videos=${u.videos} recent=${u.recent.length}`); }
    await sleep(1200);
  }

  note("=== 2. Bilibili topic videos ===");
  const videos = [];
  const seen = new Set();
  const queries = ["凯圣王 饮食", "凯圣王 蛋白质", "凯圣王 新手", "凯圣王 卧推", "凯圣王 深蹲", "凯圣王 补剂", "谭成义 训练", "谭成义 减脂"];
  for (const q of queries) {
    const res = await biliVideoSearch(q, 1);
    note(`[bili] search "${q}" -> ${res.length}`);
    for (const v of res.slice(0, 6)) {
      if (seen.has(v.bvid)) continue;
      seen.add(v.bvid);
      videos.push({ platform: "bilibili", ...v, query: q, retrieved_at: stamp });
    }
    await sleep(1500);
  }

  note("=== 3. Bilibili subtitle probe ===");
  const subtitleProbes = [];
  for (const v of videos.slice(0, 4)) {
    const full = await biliVideo(v.bvid);
    if (!full) continue;
    const sub = await biliSubtitle(full.aid, full.cid, full.bvid);
    subtitleProbes.push({ bvid: v.bvid, title: full.title, status: sub.status, cueCount: sub.cues?.length || 0, reason: sub.reason || null });
    note(`[bili] subtitle ${v.bvid}: ${sub.status} cues=${sub.cues?.length || 0}`);
    if (sub.status === "fetched") {
      writeFileSync(join(OUT, `subtitle-${v.bvid}.json`), JSON.stringify({ bvid: v.bvid, title: full.title, ...sub }, null, 2));
    }
    await sleep(1200);
  }

  note("=== 4. Douyin ===");
  const douyin = [];
  const dy = await douyinVideo("7585532380253883663");
  if (dy) { douyin.push({ platform: "douyin", ...dy, retrieved_at: stamp }); note(`[douyin] OK desc="${(dy.desc || "").slice(0, 60)}" author=${dy.author}`); }

  note("=== 5. Literature ===");
  const evidence = [];
  const evSeen = new Set();
  for (const t of TOPICS) {
    let got = await europepmc(t.q, 3);
    if (got.length < 2) { const extra = await crossref(t.q, 3); got = got.concat(extra); }
    note(`[${t.id}] ${got.length} records`);
    for (const e of got) {
      const key = e.doi || e.pmid || e.title;
      if (evSeen.has(key)) continue;
      evSeen.add(key);
      evidence.push({ ...e, topic: t.id, topicLabel: t.label, retrieved_at: stamp });
    }
    await sleep(900);
  }

  const payload = { generated_at: stamp, bloggers, videos, douyin, subtitleProbes, evidence };
  writeFileSync(join(OUT, "real-sources.json"), JSON.stringify(payload, null, 2));
  writeFileSync(join(ROOT, "scratch", "ingest-log.txt"), log.join("\n"));

  note("=== SUMMARY ===");
  note(`bloggers=${bloggers.length} videos=${videos.length} douyin=${douyin.length} evidence=${evidence.length}`);
  note(`evidence with DOI=${evidence.filter((e) => e.doi).length} with PMID=${evidence.filter((e) => e.pmid).length}`);
  note(`subtitles fetched=${subtitleProbes.filter((s) => s.status === "fetched").length}/${subtitleProbes.length}`);
  note(`written -> ${join(OUT, "real-sources.json")}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });