// Targeted collection: landmark papers by exact title + fuller blogger catalogs.
// Relevance is verified from the returned title/abstract, never assumed.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "..", "kepu-verify", "src", "data");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const note = (s) => { log.push(s); console.log(s); };

async function get(url, headers = {}, timeout = 30000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: ctl.signal });
    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    return { ok: r.ok, status: r.status, data, text };
  } catch (e) { return { ok: false, status: 0, error: String(e.message) }; }
  finally { clearTimeout(t); }
}

// Exact-title landmark searches. Each entry states the claim it is meant to support.
const LANDMARKS = [
  { id: "protein-meta", topic: "protein", supports: "增肌期蛋白质摄入 1.6 g/kg/d 附近收益趋于平台",
    q: 'TITLE:"protein supplementation" AND TITLE:"meta-regression" AND TITLE:"resistance training"' },
  { id: "protein-meta-alt", topic: "protein", supports: "蛋白质补充对去脂体重与力量的效应",
    q: 'TITLE:"systematic review" AND TITLE:"meta-analysis" AND TITLE:"protein supplementation" AND TITLE:"muscle mass"' },
  { id: "issn-protein", topic: "protein", supports: "ISSN 蛋白质与运动立场声明",
    q: 'TITLE:"International Society of Sports Nutrition position stand" AND TITLE:"protein and exercise"' },
  { id: "frequency", topic: "frequency", supports: "每周每肌群训练频率与肥大关系",
    q: 'TITLE:"Resistance Training Frequency" AND TITLE:"Muscle Hypertrophy"' },
  { id: "volume", topic: "frequency", supports: "训练容量(组数)与肥大的剂量反应",
    q: 'TITLE:"dose-response" AND TITLE:"weekly" AND TITLE:"resistance training" AND TITLE:"hypertrophy"' },
  { id: "failure", topic: "failure", supports: "力竭与非力竭训练的效应比较",
    q: 'TITLE:"failure" AND TITLE:"repetitions in reserve" AND TITLE:"meta-analysis"' },
  { id: "failure-alt", topic: "failure", supports: "是否必须练到力竭",
    q: 'TITLE:"muscular failure" AND TITLE:"resistance training" AND TITLE:"systematic review"' },
  { id: "issn-creatine", topic: "creatine", supports: "ISSN 肌酸立场声明：有效性与安全性",
    q: 'TITLE:"International Society of Sports Nutrition position stand" AND TITLE:"creatine"' },
  { id: "creatine-safety", topic: "creatine", supports: "肌酸长期补充安全性",
    q: 'TITLE:"creatine supplementation" AND TITLE:"safety" AND TITLE:"clinical"' },
  { id: "deficit-rate", topic: "deficit", supports: "减重速率对瘦体重保留的影响",
    q: 'TITLE:"weight-loss rates" AND TITLE:"body composition" AND TITLE:"athletes"' },
  { id: "deficit-rate-alt", topic: "deficit", supports: "缓慢与快速减重对运动员体成分影响",
    q: 'TITLE:"Effect of two different weight-loss rates" ' },
  { id: "issn-diets", topic: "deficit", supports: "ISSN 减重饮食立场声明",
    q: 'TITLE:"International Society of Sports Nutrition position stand" AND TITLE:"diets and body composition"' },
  { id: "contest-prep", topic: "deficit", supports: "自然健美备赛的循证营养建议",
    q: 'TITLE:"Evidence-based recommendations for natural bodybuilding contest preparation"' },
  { id: "protein-cut", topic: "deficit", supports: "减脂期更高蛋白质摄入以保留瘦体重",
    q: 'TITLE:"protein" AND TITLE:"energy restriction" AND TITLE:"lean mass" AND TITLE:"resistance"' },
  { id: "concurrent", topic: "concurrent", supports: "有氧与抗阻并行训练的干扰效应",
    q: 'TITLE:"concurrent training" AND TITLE:"interference" AND TITLE:"meta-analysis"' },
  { id: "concurrent-alt", topic: "concurrent", supports: "并行训练对力量与肥大的影响",
    q: 'TITLE:"Concurrent" AND TITLE:"Aerobic" AND TITLE:"Strength" AND TITLE:"Meta-Analysis"' },
  { id: "sleep", topic: "sleep", supports: "睡眠限制对体成分的影响",
    q: 'TITLE:"sleep" AND TITLE:"body composition" AND TITLE:"weight loss" AND TITLE:"randomized"' },
  { id: "sleep-alt", topic: "sleep", supports: "睡眠不足与肌肉恢复",
    q: 'TITLE:"sleep restriction" AND TITLE:"muscle" AND TITLE:"recovery"' },
  { id: "sodium", topic: "sodium", supports: "减盐对血压的效应",
    q: 'TITLE:"salt intake" AND TITLE:"blood pressure" AND TITLE:"meta-analysis"' },
  { id: "sugar", topic: "sodium", supports: "添加糖/含糖饮料与体重",
    q: 'TITLE:"sugar sweetened beverages" AND TITLE:"body weight" AND TITLE:"meta-analysis"' },
  { id: "novice", topic: "novice", supports: "新手早期力量增长以神经适应为主",
    q: 'TITLE:"neural adaptations" AND TITLE:"strength training"' },
  { id: "hypertrophy-rec", topic: "novice", supports: "最大化肌肥大的抗阻训练建议",
    q: 'TITLE:"Resistance Training Recommendations to Maximize Muscle Hypertrophy"' },
  { id: "rest", topic: "novice", supports: "组间休息时长对力量与肥大的影响",
    q: 'TITLE:"rest interval" AND TITLE:"resistance training" AND TITLE:"meta-analysis"' },
  { id: "range", topic: "novice", supports: "动作幅度(全程/半程)对肥大的影响",
    q: 'TITLE:"range of motion" AND TITLE:"muscle hypertrophy" AND TITLE:"meta-analysis"' },
];

async function epmc(q, size = 5) {
  const r = await get(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&format=json&pageSize=${size}&resultType=core&sort=CITED%20desc`);
  const items = r.data?.resultList?.result;
  if (!Array.isArray(items)) { note(`  [epmc] FAIL ${r.status} ${r.data ? "" : r.error || ""}`); return []; }
  return items.filter((i) => i.title).map((i) => ({
    doi: i.doi || null, pmid: i.pmid || null, title: i.title.replace(/\s+/g, " ").trim(),
    authors: (i.authorString || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10),
    journal: i.journalInfo?.journal?.title || null,
    year: i.pubYear ? Number(i.pubYear) : null,
    pubType: Array.isArray(i.pubTypeList?.pubType) ? i.pubTypeList.pubType : [],
    abstract: i.abstractText ? i.abstractText.replace(/\s+/g, " ").slice(0, 2200) : null,
    citedBy: i.citedByCount ?? null,
    url: i.doi ? `https://doi.org/${i.doi}` : (i.pmid ? `https://europepmc.org/article/MED/${i.pmid}` : null),
    provider: "europepmc",
  }));
}

async function biliSearch(keyword, page = 1) {
  const r = await get(`https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(keyword)}&page=${page}`,
    { Referer: "https://search.bilibili.com/" });
  const res = r.data?.data?.result;
  if (!Array.isArray(res)) return [];
  return res.map((v) => ({
    bvid: v.bvid, title: String(v.title || "").replace(/<[^>]+>/g, ""),
    author: v.author, mid: v.mid, pubdate: v.pubdate, duration: v.duration,
    description: v.description, play: v.play,
    url: `https://www.bilibili.com/video/${v.bvid}`,
    pic: v.pic?.startsWith("//") ? "https:" + v.pic : v.pic,
  }));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const stamp = new Date().toISOString();
  const prev = JSON.parse(readFileSync(join(OUT, "real-sources.json"), "utf8"));

  note("=== LANDMARK LITERATURE ===");
  const evidence = [];
  const seen = new Set();
  for (const L of LANDMARKS) {
    const got = await epmc(L.q, 4);
    note(`[${L.id}] ${got.length} hits`);
    for (const e of got) {
      const k = e.doi || e.pmid || e.title;
      if (seen.has(k)) continue;
      seen.add(k);
      evidence.push({ ...e, topic: L.topic, landmarkId: L.id, supports: L.supports, query: L.q, retrieved_at: stamp });
      note(`   ${(e.title || "").slice(0, 88)} | ${e.journal || "?"} ${e.year || "?"} | cited ${e.citedBy} | DOI ${e.doi} PMID ${e.pmid}`);
    }
    await sleep(700);
  }

  note("=== BLOGGER CATALOGS (Bilibili) ===");
  const videos = [...prev.videos];
  const vseen = new Set(videos.map((v) => v.bvid));
  const qs = [
    "谭成义 三分化", "谭成义 背部训练", "谭成义 胸", "谭成义 饮食", "谭成义 碳水",
    "谭成义 新手", "谭成义 拉伸", "谭成义 热身",
    "凯圣王 饮食详解", "凯圣王 蹭饭", "凯圣王 新手增肌", "凯圣王 三分化",
    "凯圣王 卧推", "凯圣王 硬拉", "凯圣王 体态", "凯圣王 减脂",
  ];
  for (const q of qs) {
    const res = await biliSearch(q, 1);
    let added = 0;
    for (const v of res) {
      if (vseen.has(v.bvid)) continue;
      // Only keep videos actually authored by the two target bloggers.
      if (v.author !== "凯圣王" && v.author !== "谭成义") continue;
      vseen.add(v.bvid);
      videos.push({ platform: "bilibili", ...v, query: q, retrieved_at: stamp });
      added++;
    }
    note(`[bili] "${q}" -> ${res.length} hits, +${added} owned`);
    await sleep(1800);
  }

  const owned = videos.filter((v) => v.author === "凯圣王" || v.author === "谭成义");
  const payload = {
    generated_at: stamp,
    bloggers: prev.bloggers,
    videos: owned,
    otherVideos: videos.filter((v) => !owned.includes(v)),
    douyin: prev.douyin,
    subtitleProbes: prev.subtitleProbes,
    evidence,
  };
  writeFileSync(join(OUT, "real-sources.json"), JSON.stringify(payload, null, 2));
  writeFileSync(join(ROOT, "scratch", "ingest2-log.txt"), log.join("\n"));
  note("=== SUMMARY ===");
  note(`owned videos=${owned.length} (凯圣王 ${owned.filter(v=>v.author==="凯圣王").length} / 谭成义 ${owned.filter(v=>v.author==="谭成义").length})`);
  note(`evidence=${evidence.length} DOI=${evidence.filter(e=>e.doi).length} PMID=${evidence.filter(e=>e.pmid).length}`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });