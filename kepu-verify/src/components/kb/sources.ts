import { useCallback, useState } from "react";
import { uid } from "@/src/lib/calc";

export function parseBvid(input: string): string | null {
  const m = input.match(/BV[0-9A-Za-z]{10}/);
  return m ? m[0] : null;
}

export function parseDoi(input: string): string | null {
  const cleaned = input.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  const m = cleaned.match(/10\.\d{4,9}\/[^\s]+/);
  if (!m) return null;
  return m[0].replace(/[.,;)\]]+$/, "");
}

/** 接受「PMID: 12345678」、pubmed 链接或纯数字。 */
export function parsePmid(input: string): string | null {
  const s = input.trim();
  const fromUrl = s.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{1,8})/i) ?? s.match(/europepmc\.org\/article\/MED\/(\d{1,8})/i);
  if (fromUrl) return fromUrl[1];
  const labeled = s.match(/^PMID:?\s*(\d{1,8})$/i);
  if (labeled) return labeled[1];
  return /^\d{1,8}$/.test(s) ? s : null;
}

/** 抖音 aweme_id：纯数字或 douyin.com/video|note/<id> 链接。 */
export function parseAwemeId(input: string): string | null {
  const s = input.trim();
  if (/^\d{15,25}$/.test(s)) return s;
  const m = s.match(/douyin\.com\/(?:video|note)\/(\d{15,25})/i);
  return m ? m[1] : null;
}

export function biliUrl(bvid: string): string {
  return `https://www.bilibili.com/video/${bvid}`;
}

export function douyinUrl(awemeId: string): string {
  return `https://www.douyin.com/video/${awemeId}`;
}

export function doiUrl(doi: string): string {
  return `https://doi.org/${doi}`;
}

export function pmidUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

/**
 * 待审核来源。自动获取到的元数据一律带 provider + metaSource="auto"，
 * UI 必须标注「待人工核对」；自动获取失败时这些字段为空，走人工填写路径。
 */
export interface PendingVideo {
  id: string;
  url: string;
  addedAt: string;
  platform?: "bilibili" | "douyin";
  bvid?: string | null;
  awemeId?: string | null;
  title?: string | null;
  author?: string | null;
  durationSec?: number | null;
  pubdate?: number | null;
  description?: string | null;
  chapters?: { startSec: number; title: string }[];
  subtitleStatus?: string | null;
  provider?: string | null;
  metaSource?: "auto" | "manual";
  edited?: boolean;
  retrievedAt?: string | null;
}

export interface PendingPaper {
  id: string;
  url: string;
  addedAt: string;
  doi?: string | null;
  pmid?: string | null;
  title?: string | null;
  authors?: string[];
  journal?: string | null;
  year?: number | null;
  abstract?: string | null;
  citedBy?: number | null;
  provider?: string | null;
  metaSource?: "auto" | "manual";
  edited?: boolean;
  retrievedAt?: string | null;
}

interface PendingData {
  videos: PendingVideo[];
  papers: PendingPaper[];
}

const KEY = "kepu-verify:kb-pending-sources:v1";
const EMPTY: PendingData = { videos: [], papers: [] };

function load(): PendingData {
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PendingData>;
    return { videos: parsed.videos ?? [], papers: parsed.papers ?? [] };
  } catch {
    return EMPTY;
  }
}

function persist(data: PendingData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 存储不可用时仅保留内存态 */
  }
}

/** 用户新增的来源只进待审核列表，经人工审核后才会进入公开知识库。 */
export function usePendingSources() {
  const [data, setData] = useState<PendingData>(load);

  const update = useCallback((next: PendingData) => {
    setData(next);
    persist(next);
  }, []);

  return {
    videos: data.videos,
    papers: data.papers,
    addVideo(v: Omit<PendingVideo, "id" | "addedAt">) {
      update({ ...data, videos: [...data.videos, { ...v, id: uid(), addedAt: new Date().toISOString() }] });
    },
    addPaper(p: Omit<PendingPaper, "id" | "addedAt">) {
      update({ ...data, papers: [...data.papers, { ...p, id: uid(), addedAt: new Date().toISOString() }] });
    },
    removeVideo(id: string) {
      update({ ...data, videos: data.videos.filter((v) => v.id !== id) });
    },
    removePaper(id: string) {
      update({ ...data, papers: data.papers.filter((p) => p.id !== id) });
    },
  };
}