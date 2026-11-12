export interface NormalizedRef {
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

const UA = "kepu-verify/1.0 (fitness evidence lookup; contact: local)";

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function getJson(url: string, timeoutMs = 20_000): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function lookupDoi(doi: string): Promise<NormalizedRef | null> {
  const clean = doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  if (!/^10\.\d{4,9}\/\S+$/.test(clean)) return null;
  const data = await getJson(`https://api.crossref.org/works/${encodeURIComponent(clean)}`) as {
    message?: {
      DOI?: string;
      title?: string[];
      author?: { given?: string; family?: string }[];
      "container-title"?: string[];
      issued?: { "date-parts"?: number[][] };
      abstract?: string;
      URL?: string;
      type?: string;
      "is-referenced-by-count"?: number;
    };
  } | null;
  const m = data?.message;
  if (!m?.title?.length) return null;
  return {
    doi: m.DOI ?? clean,
    pmid: null,
    title: stripTags(m.title[0]),
    authors: (m.author ?? []).slice(0, 12).map((a) =>
      [a.given, a.family].filter(Boolean).join(" ")
    ).filter(Boolean),
    journal: m["container-title"]?.[0] ?? null,
    year: m.issued?.["date-parts"]?.[0]?.[0] ?? null,
    abstract: m.abstract ? stripTags(m.abstract).slice(0, 4000) : null,
    url: m.URL ?? `https://doi.org/${clean}`,
    provider: "crossref",
    pubType: m.type ? [m.type] : [],
    citedBy: typeof m["is-referenced-by-count"] === "number" ? m["is-referenced-by-count"] : null,
  };
}

export async function lookupPmid(pmid: string): Promise<NormalizedRef | null> {
  const clean = pmid.trim().replace(/^PMID:\s*/i, "");
  if (!/^\d{1,8}$/.test(clean)) return null;
  const data = await getJson(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:${clean}%20AND%20SRC:MED&format=json&resultType=core&pageSize=1`,
  ) as {
    resultList?: {
      result?: {
        doi?: string;
        pmid?: string;
        title?: string;
        authorString?: string;
        journalInfo?: { journal?: { title?: string } };
        pubYear?: string;
        abstractText?: string;
        pubTypeList?: { pubType?: string[] };
        citedByCount?: number;
      }[];
    };
  } | null;
  const r = data?.resultList?.result?.[0];
  if (!r?.title) return null;
  return {
    doi: r.doi ?? null,
    pmid: r.pmid ?? clean,
    title: stripTags(r.title),
    authors: (r.authorString ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12),
    journal: r.journalInfo?.journal?.title ?? null,
    year: r.pubYear ? Number(r.pubYear) : null,
    abstract: r.abstractText ? stripTags(r.abstractText).slice(0, 4000) : null,
    url: `https://europepmc.org/article/MED/${clean}`,
    provider: "europepmc",
    pubType: r.pubTypeList?.pubType ?? [],
    citedBy: typeof r.citedByCount === "number" ? r.citedByCount : null,
  };
}

interface EpmcRow {
  doi?: string; pmid?: string; title?: string; authorString?: string;
  journalInfo?: { journal?: { title?: string } };
  pubYear?: string; abstractText?: string;
  pubTypeList?: { pubType?: string[] }; citedByCount?: number;
}

async function queryEpmc(clauses: string[], limit: number): Promise<EpmcRow[]> {
  const url =
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`(${clauses.join(" AND ")}) AND SRC:MED`)}` +
    `&format=json&resultType=core&pageSize=${Math.min(limit, 15)}` +
    `&sort=CITED%20desc`;
  const data = await getJson(url) as { resultList?: { result?: EpmcRow[] } } | null;
  return data?.resultList?.result ?? [];
}

export async function searchEvidence(query: string, limit = 8): Promise<NormalizedRef[]> {
  const q = query.trim();
  if (q.length < 3 || q.length > 300) return [];
  // Bare terms match anywhere in the full text, so citation sorting surfaces
  // irrelevant blockbusters ("creatine" hits every creatine-kinase paper).
  // Anchor the subject to the title and the rest to title/abstract; keep
  // hyphenated compounds adjacent ("concurrent-training" vs lymphoma papers).
  const terms = q.split(/\s+/).map((t) => t.replace(/[^\p{L}\p{N}-]/gu, "")).filter(Boolean).slice(0, 6);
  if (terms.length === 0) return [];
  const rows = await queryEpmc(terms.map((t, i) => `${i === 0 ? "TITLE" : "TITLE_ABS"}:"${t}"`), limit);
  return rows.filter((r) => r.title).map((r) => ({
    doi: r.doi ?? null,
    pmid: r.pmid ?? null,
    title: stripTags(r.title!),
    authors: (r.authorString ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12),
    journal: r.journalInfo?.journal?.title ?? null,
    year: r.pubYear ? Number(r.pubYear) : null,
    abstract: r.abstractText ? stripTags(r.abstractText).slice(0, 4000) : null,
    url: r.pmid ? `https://europepmc.org/article/MED/${r.pmid}` : (r.doi ? `https://doi.org/${r.doi}` : null),
    provider: "europepmc",
    pubType: r.pubTypeList?.pubType ?? [],
    citedBy: typeof r.citedByCount === "number" ? r.citedByCount : null,
  }));
}