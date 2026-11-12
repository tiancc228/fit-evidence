import { useMemo, useState } from "react";
import { ExternalLink, Link2, Paperclip, Search, SquarePlus, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Claim, EvidenceRef } from "@/src/lib/types";
import {
  lookupEvidence, searchEvidenceRemote, toEvidenceRef, refKey, type RemoteRef,
} from "@/src/lib/evidence";
import { EvidenceItem } from "@/src/components/kb/EvidenceItem";
import { ProviderBadge, RemoteNotice } from "@/src/components/kb/MetaNotice";
import { RELATION_META, STRENGTH_META, effectiveEvidence } from "@/src/components/kb/meta";
import { doiUrl, parseDoi, parsePmid, pmidUrl } from "@/src/components/kb/sources";
import { useRemoteMeta, currentRemoteState } from "@/src/components/kb/useRemoteMeta";

type Relation = keyof typeof RELATION_META;
type Strength = keyof typeof STRENGTH_META;

export interface AttachPayload {
  ref: EvidenceRef;
  relation: Relation;
  strength: Strength;
  note: string;
}

interface Judgement {
  relation: Relation;
  strength: Strength;
  note: string;
}

const DEFAULT_JUDGEMENT: Judgement = { relation: "context", strength: "low", note: "" };

interface Props {
  claim: Claim;
  onAttach: (payload: AttachPayload) => void;
  onDetach: (key: string, title: string) => void;
  defaultOpen?: boolean;
}

function CandidateCard({
  remote, status, judgement, onJudge, onAttach, onDetach,
}: {
  remote: RemoteRef;
  status: "new" | "base" | "attached";
  judgement: Judgement;
  onJudge: (patch: Partial<Judgement>) => void;
  onAttach: () => void;
  onDetach: () => void;
}) {
  const ref = toEvidenceRef(remote);
  return (
    <div className="grid gap-2 rounded-lg border border-science/30 bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ProviderBadge provider={remote.provider} />
        {status === "base" && <Badge variant="secondary">已在原始证据列表</Badge>}
        {status === "attached" && (
          <Badge variant="outline" className="gap-1 border-ok/40 bg-ok/10 text-ok">
            <Link2 className="size-3" />
            已挂载 · 仍待人工确认裁决
          </Badge>
        )}
        {remote.url && (
          <a
            href={remote.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs text-info hover:underline"
          >
            <ExternalLink className="size-3" />
            原文链接
          </a>
        )}
      </div>

      <EvidenceItem item={ref} className="bg-card" />

      {status === "new" ? (
        <div className="grid gap-2 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            挂载前先判断这篇文献与本条结论的关系。默认「背景参考 / 低」，请人工核对全文后调整；挂载不会改动裁决。
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`ev-rel-${refKey(remote)}`} className="text-xs">与结论的关系</Label>
              <div className="[&>div]:w-full">
                <NativeSelect
                  id={`ev-rel-${refKey(remote)}`}
                  value={judgement.relation}
                  onChange={(e) => onJudge({ relation: e.target.value as Relation })}
                  className="w-full"
                >
                  {(Object.keys(RELATION_META) as Relation[]).map((r) => (
                    <NativeSelectOption key={r} value={r}>{RELATION_META[r].label}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`ev-str-${refKey(remote)}`} className="text-xs">证据强度</Label>
              <div className="[&>div]:w-full">
                <NativeSelect
                  id={`ev-str-${refKey(remote)}`}
                  value={judgement.strength}
                  onChange={(e) => onJudge({ strength: e.target.value as Strength })}
                  className="w-full"
                >
                  {(Object.keys(STRENGTH_META) as Strength[]).map((s) => (
                    <NativeSelectOption key={s} value={s}>{STRENGTH_META[s].label}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`ev-note-${refKey(remote)}`} className="text-xs">挂载备注（写入留痕，建议注明核对到的关键数据）</Label>
            <Input
              id={`ev-note-${refKey(remote)}`}
              value={judgement.note}
              onChange={(e) => onJudge({ note: e.target.value })}
              placeholder="例如：核对摘要，受试者为未经训练成年男性，剂量 3 g/日…"
            />
          </div>
          <Button type="button" size="sm" className="w-fit" onClick={onAttach}>
            <SquarePlus className="size-4" />
            挂到本条证据
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {status === "base"
              ? "这条文献来自原始抓取数据，只读，不可在此移除。"
              : "已写入审核留痕。裁决与发布仍需人工操作，系统不会自动推进。"}
          </p>
          {status === "attached" && (
            <Button type="button" variant="outline" size="xs" className="ml-auto" onClick={onDetach}>
              <Unlink className="size-3" />
              移除挂载
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 审核台「找文献」：实时调 Europe PMC 检索 / Crossref·Europe PMC 精确取用。
 * 只把接口真实返回的文献挂到 claim 上，挂载动作写进留痕，绝不改 verdict 与审核状态。
 */
export function EvidenceFinder({ claim, onAttach, onDetach, defaultOpen = false }: Props) {
  // 连字符必须保留：Europe PMC 把 "concurrent-training" 当相邻词组，拆成空格会命中淋巴瘤论文。
  const suggested = claim.topic;
  const [open, setOpen] = useState(defaultOpen);
  const [q, setQ] = useState(suggested);
  const [limit, setLimit] = useState(5);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [judgements, setJudgements] = useState<Record<string, Judgement>>({});

  const search = useRemoteMeta(
    submitted,
    (key) => {
      const sep = key.indexOf("::");
      return searchEvidenceRemote(key.slice(sep + 2), Number.parseInt(key.slice(0, sep), 10));
    },
    0,
  );
  const manual = useRemoteMeta(
    manualKey,
    (key) => key.startsWith("doi:") ? lookupEvidence({ doi: key.slice(4) }) : lookupEvidence({ pmid: key.slice(5) }),
    0,
  );

  // 换关键词那一帧旧结果属于上一个 query，不能当成新 query 的结果展示或挂载。
  const searchState = currentRemoteState(search.state, submitted);
  const manualState = currentRemoteState(manual.state, manualKey);

  const baseKeys = useMemo(() => new Set(claim.layer3.evidence.map((e) => refKey(e.ref))), [claim.layer3.evidence]);
  const attachedKeys = useMemo(
    () => new Set(effectiveEvidence(claim).filter((e) => !baseKeys.has(refKey(e.ref))).map((e) => refKey(e.ref))),
    [claim, baseKeys],
  );

  const results = searchState.status === "ok" ? searchState.data : [];
  const manualRef = manualState.status === "ok" ? manualState.data : null;
  const canSearch = q.trim().length >= 3;

  function statusOf(r: RemoteRef): "new" | "base" | "attached" {
    const k = refKey(r);
    if (baseKeys.has(k)) return "base";
    if (attachedKeys.has(k)) return "attached";
    return "new";
  }

  function judgeOf(r: RemoteRef): Judgement {
    return judgements[refKey(r)] ?? DEFAULT_JUDGEMENT;
  }

  function attach(r: RemoteRef) {
    const j = judgeOf(r);
    onAttach({ ref: toEvidenceRef(r), relation: j.relation, strength: j.strength, note: j.note.trim() });
  }

  function runSearch() {
    if (!canSearch) return;
    setSubmitted(`${limit}::${q.trim()}`);
  }

  function runManual() {
    const doi = parseDoi(manualInput);
    if (doi) { setManualKey(`doi:${doi}`); return; }
    const pmid = parsePmid(manualInput);
    if (pmid) { setManualKey(`pmid:${pmid}`); return; }
    setManualKey(null);
  }

  const manualParsed = parseDoi(manualInput) ?? parsePmid(manualInput);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-science/40 bg-science-soft/40">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-science">
          <Search className="size-4" />
          找文献 · 实时检索 Europe PMC / Crossref
          {attachedKeys.size > 0 && (
            <Badge variant="outline" className="gap-1 border-science/40 text-science">
              <Paperclip className="size-3" />
              已挂载 {attachedKeys.size}
            </Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{open ? "收起" : "展开"}</span>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="grid gap-3 p-3 pt-0">
        <p className="rounded-md border border-warn/40 bg-warn/10 px-2.5 py-2 text-xs leading-relaxed text-warn">
          检索结果只是候选文献，元数据由官方接口实时返回并标注「待人工核对」。
          挂载只追加审核留痕，<span className="font-semibold">不会自动修改裁决、不会自动推进状态、不会自动发布</span>——改裁决仍是真人操作。
        </p>

        <div className="grid gap-2">
          <Label htmlFor={`ev-q-${claim.id}`} className="text-xs">关键词（建议英文主题词，后端按被引降序返回）</Label>
          <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
            <Input
              id={`ev-q-${claim.id}`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
              placeholder="例如 creatine muscle hypertrophy"
              aria-label="检索文献关键词"
            />
            <div className="[&>div]:w-full">
              <NativeSelect
                value={String(limit)}
                onChange={(e) => setLimit(Number.parseInt(e.target.value, 10))}
                className="w-full"
                aria-label="返回条数"
              >
                {[5, 10, 15].map((n) => (
                  <NativeSelectOption key={n} value={String(n)}>返回 {n} 条</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <Button type="button" onClick={runSearch} disabled={!canSearch}>
              <Search className="size-4" />
              检索
            </Button>
          </div>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            建议词来自本条主题标签（英文，可改）：
            <button
              type="button"
              className="rounded bg-muted px-1.5 py-0.5 font-mono hover:text-foreground"
              onClick={() => { setQ(suggested); setSubmitted(`${limit}::${suggested}`); }}
            >
              {suggested}
            </button>
            {!canSearch && <span className="text-warn">关键词至少 3 个字符。</span>}
          </p>
        </div>

        <RemoteNotice state={searchState} onRetry={search.retry} subject="文献检索" />

        {searchState.status === "ok" && (
          <p className="text-xs text-muted-foreground">
            Europe PMC 返回 {results.length} 篇真实文献（请求上限 {limit} 篇）。
            逐条核对标题与摘要后再挂载；被引数高不等于支持本条结论。
          </p>
        )}

        {results.length > 0 && (
          <div className="grid gap-3">
            {results.map((r) => (
              <CandidateCard
                key={refKey(r)}
                remote={r}
                status={statusOf(r)}
                judgement={judgeOf(r)}
                onJudge={(patch) => setJudgements((prev) => ({ ...prev, [refKey(r)]: { ...judgeOf(r), ...patch } }))}
                onAttach={() => attach(r)}
                onDetach={() => onDetach(refKey(r), r.title)}
              />
            ))}
          </div>
        )}

        <div className="grid gap-2 rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs font-semibold text-foreground">检索不到？按 DOI / PMID 精确取用</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            检索失败或结果不相关时，可直接粘贴 DOI / PMID（或 doi.org / pubmed 链接），由 Crossref / Europe PMC 精确取回真实元数据后挂载。
            两者都拿不到时，请到知识库「添加来源」手动登记并人工核对，本站不会用猜测内容填补。
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runManual(); } }}
              placeholder="10.1186/s12970-017-0173-z 或 28615996"
              aria-label="按 DOI 或 PMID 取回文献"
            />
            <Button type="button" variant="outline" onClick={runManual} disabled={manualParsed == null}>
              <Paperclip className="size-4" />
              取回元数据
            </Button>
          </div>
          {manualInput.trim() !== "" && manualParsed == null && (
            <p className="text-xs text-bad">未识别到 DOI（10.xxxx/…）或 PMID（1–8 位数字）。</p>
          )}
          {manualParsed != null && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              解析成功：<span className="font-mono">{manualParsed}</span>
              <a
                href={parseDoi(manualInput) ? doiUrl(manualParsed) : pmidUrl(manualParsed)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-info hover:underline"
              >
                官方页面
                <ExternalLink className="size-3" />
              </a>
            </p>
          )}
          <RemoteNotice state={manualState} onRetry={manual.retry} subject="文献元数据" />
          {manualRef && (
            <CandidateCard
              remote={manualRef}
              status={statusOf(manualRef)}
              judgement={judgeOf(manualRef)}
              onJudge={(patch) => setJudgements((prev) => ({ ...prev, [refKey(manualRef)]: { ...judgeOf(manualRef), ...patch } }))}
              onAttach={() => attach(manualRef)}
              onDetach={() => onDetach(refKey(manualRef), manualRef.title)}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}