import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_FILE = path.join(ROOT, 'src/data/real-sources.json');
const OUT_FILE = path.join(ROOT, 'src/data/bilibili-extra.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const BVID_RE = /(.{0,26}?)(BV[0-9A-Za-z]{10})/g;
const REQUEST_TIMEOUT_MS = 15000;
const MIN_DELAY_MS = 800;
const MAX_DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = () =>
  MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));

function collectExistingBvids(node, set) {
  if (Array.isArray(node)) {
    for (const item of node) collectExistingBvids(item, set);
  } else if (node && typeof node === 'object') {
    if (typeof node.bvid === 'string') set.add(node.bvid);
    for (const value of Object.values(node)) collectExistingBvids(value, set);
  }
}

function collectCandidates(source) {
  const existing = new Set();
  collectExistingBvids(source, existing);

  const candidates = [];
  const seen = new Set();
  for (const video of source.videos ?? []) {
    if (!video.description) continue;
    BVID_RE.lastIndex = 0;
    let match;
    while ((match = BVID_RE.exec(video.description))) {
      const label = match[1].replace(/\s+/g, ' ').trim();
      const bvid = match[2];
      if (existing.has(bvid) || seen.has(bvid)) continue;
      seen.add(bvid);
      candidates.push({ bvid, label, found_in: video.bvid });
    }
  }
  return { candidates, existingCount: existing.size };
}

function isTimeout(err) {
  return (
    err?.name === 'TimeoutError' ||
    err?.name === 'AbortError' ||
    /timeout|timed out/i.test(err?.message ?? '')
  );
}

async function requestView(bvid) {
  const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

function toVideo(bvid, data) {
  return {
    bvid,
    title: data.title ?? null,
    author: data.owner?.name ?? null,
    mid: data.owner?.mid ?? null,
    pubdate: data.pubdate ?? null,
    duration: data.duration ?? null,
    pages: Array.isArray(data.pages)
      ? data.pages.map((p) => ({ page: p.page, part: p.part }))
      : [],
    desc: data.desc ?? null,
    url: `https://www.bilibili.com/video/${bvid}`,
    pic: data.pic ?? null,
    retrieved_at: new Date().toISOString(),
  };
}

function writeOutput(state) {
  const out = {
    generated_at: new Date().toISOString(),
    source: 'bilibili-public-api',
    total: state.total,
    ok: state.videos.length,
    failed: state.failed,
    videos: state.videos,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

async function main() {
  const source = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
  const { candidates, existingCount } = collectCandidates(source);

  console.log(`existing bvid in real-sources.json: ${existingCount}`);
  console.log(`candidates to crawl: ${candidates.length}`);

  const state = { total: candidates.length, videos: [], failed: [] };
  let riskControl = null;

  for (let i = 0; i < candidates.length; i++) {
    const { bvid } = candidates[i];
    const tag = `[${i + 1}/${candidates.length}] ${bvid}`;

    let result;
    try {
      result = await requestView(bvid);
    } catch (err) {
      if (!isTimeout(err)) {
        state.failed.push({ bvid, code: 'NETWORK_ERROR', message: String(err?.message ?? err) });
        console.log(`${tag} NETWORK_ERROR ${err?.message ?? err}`);
        await sleep(randomDelay());
        continue;
      }
      console.log(`${tag} timeout, retrying once`);
      await sleep(randomDelay());
      try {
        result = await requestView(bvid);
      } catch (retryErr) {
        state.failed.push({
          bvid,
          code: 'NETWORK_TIMEOUT',
          message: String(retryErr?.message ?? retryErr),
        });
        console.log(`${tag} timeout after retry`);
        await sleep(randomDelay());
        continue;
      }
    }

    if (result.status === 412) {
      riskControl = { bvid, reason: 'HTTP 412', ...result };
      console.log(`${tag} HTTP 412 risk control, stopping`);
      break;
    }

    const json = result.json;
    if (!json) {
      state.failed.push({
        bvid,
        code: result.status,
        message: `non-JSON response (HTTP ${result.status})`,
      });
      console.log(`${tag} non-JSON HTTP ${result.status}`);
      await sleep(randomDelay());
      continue;
    }

    if (json.code === 0) {
      state.videos.push(toVideo(bvid, json.data ?? {}));
      console.log(`${tag} ok: ${json.data?.title ?? '(no title)'}`);
    } else if (json.code === -352) {
      riskControl = { bvid, reason: 'code -352', json };
      console.log(`${tag} code -352 risk control, stopping`);
      break;
    } else {
      state.failed.push({ bvid, code: json.code, message: json.message ?? '' });
      console.log(`${tag} failed code=${json.code} message=${json.message}`);
    }

    if (i < candidates.length - 1) await sleep(randomDelay());
  }

  writeOutput(state);

  const remaining = state.total - state.videos.length - state.failed.length;
  console.log('--- summary ---');
  console.log(`total: ${state.total}`);
  console.log(`ok: ${state.videos.length}`);
  console.log(`failed: ${state.failed.length}`);
  console.log(`not attempted (risk control): ${remaining}`);
  if (riskControl) {
    console.log(`RISK CONTROL triggered at ${riskControl.bvid} (${riskControl.reason})`);
  }
  console.log(`written: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
