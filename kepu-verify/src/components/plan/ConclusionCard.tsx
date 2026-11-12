import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Claim, Verdict } from "@/src/lib/types";
import { CLAIMS } from "@/src/data/knowledge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { CLAIM_TOPICS, isConfirmedState, matchClaims, resolveClaim, type TopicKey } from "@/src/components/plan/claimMatch";
import ClaimLayers, { type ClaimOverride } from "@/src/components/form/ClaimLayers";
import { MissingNote, ProductAdviceTag } from "@/src/components/form/bits";
import { REVIEW_META, VERDICT_META, effectiveStatement, effectiveVerdictReason } from "@/src/components/kb/meta";
import { pmidUrl } from "@/src/components/kb/sources";

export interface Rec {
  id: string;
  title: string;
  value: string;
  basis: string;
  topic: TopicKey;
  exact?: string[];
}

const VERD_ORDER: Verdict[] = ["supported", "partial", "conflict", "insufficient"];

/** 主题精确命中优先：关键词预设可能为空或漏掉新增主题，直接按 topic id 兜底，
 *  再并入关键词旁证，排序为「已确认 → 裁决强度」。 */
export function claimsForRec(rec: Rec, overrides: Record<string, ClaimOverride>): Claim[] {
  const pool = matchClaims(CLAIMS, rec.topic, overrides);
  const seen = new Set(pool.map((c) => c.id));
  const direct = rec.exact
    ? CLAIMS.filter((c) => rec.exact!.includes(c.topic) && !seen.has(c.id)).map((c) => resolveClaim(c, overrides))
    : [];
  return [...pool, ...direct].sort((a, b) => {
    const ca = isConfirmedState(a.review.state) ? 0 : 1;
    const cb = isConfirmedState(b.review.state) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return VERD_ORDER.indexOf(a.layer3.verdict) - VERD_ORDER.indexOf(b.layer3.verdict);
  });
}

function ClaimBlock({ claim, override }: { claim: Claim; override?: ClaimOverride }) {
  const [open, setOpen] = useState(false);
  const shown = useMemo<Claim>(
    () => ({
      ...claim,
      layer2: { ...claim.layer2, statement: effectiveStatement(claim) },
      layer3: { ...claim.layer3, verdictReason: effectiveVerdictReason(claim) },
    }),
    [claim],
  );
  const vm = VERDICT_META[shown.layer3.verdict];
  const rm = REVIEW_META[shown.review.state];
  // ClaimLayers 的「查看文献」只跳一个地址（有 DOI 时优先 DOI），这里补上 PubMed 直达。
  const pmids = [...new Set(shown.layer3.evidence.filter((ev) => ev.ref.doi && ev.ref.pmid).map((ev) => ev.ref.pmid as string))];
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-start justify-between gap-2 p-2.5 text-left">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{shown.topicLabel}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("text-[10px]", vm.badge)}>{vm.label}</Badge>
            <Badge variant="outline" className={cn("text-[10px]", rm.badge)}>{rm.label}</Badge>
            {shown.review.state !== "published" && (
              <Badge variant="outline" className="border-warn/40 bg-warn/10 text-[10px] text-warn">未发布</Badge>
            )}
          </div>
        </div>
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border p-2.5">
        <ClaimLayers claim={shown} override={override} />
        {pmids.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span>PubMed 直达：</span>
            {pmids.map((p) => (
              <a
                key={p}
                href={pmidUrl(p)}
                target="_blank"
                rel="noreferrer noopener"
                className="font-mono text-science underline-offset-2 hover:underline"
              >
                PMID {p}
              </a>
            ))}
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function EvidenceCard({ rec, overrides, onlyConfirmed }: {
  rec: Rec; overrides: Record<string, ClaimOverride>; onlyConfirmed: boolean;
}) {
  const matched = claimsForRec(rec, overrides);
  const keys = rec.exact ?? CLAIM_TOPICS[rec.topic].keys;
  const confirmed = (c: Claim) => !onlyConfirmed || isConfirmedState(c.review.state);
  const exact = matched.filter((c) => keys.includes(c.topic) && confirmed(c));
  const related = matched.filter((c) => !keys.includes(c.topic) && confirmed(c));
  const shownExact = exact.slice(0, 3);
  const shownRelated = related.slice(0, 2);
  const hidden = exact.length + related.length - shownExact.length - shownRelated.length;

  return (
    <Card className="gap-0 rounded-xl py-0">
      <CardHeader className="gap-1.5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">{rec.title}</CardTitle>
          <ProductAdviceTag label="产品建议" />
        </div>
        <p className="text-lg font-semibold tabular-nums text-advice">{rec.value}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{rec.basis}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 border-t border-border p-4">
        {shownExact.length === 0 && shownRelated.length === 0 ? (
          <MissingNote>
            素材不足：拆解清单中暂无{onlyConfirmed ? "已人工确认的" : ""}对应结论，本条仅为产品训练规则推导，不代表博主或文献观点。
          </MissingNote>
        ) : (
          <>
            {shownExact.map((c) => (
              <ClaimBlock key={c.id} claim={c} override={overrides[c.id]} />
            ))}
            {shownRelated.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-2.5">
                <p className="text-[11px] text-muted-foreground">关键词相关参考（主题不完全对应，仅供旁证）</p>
                {shownRelated.map((c) => (
                  <ClaimBlock key={c.id} claim={c} override={overrides[c.id]} />
                ))}
              </div>
            )}
            {hidden > 0 && (
              <p className="text-[11px] text-muted-foreground">
                另有 {hidden} 条相关拆解，去
                <a href="#/knowledge" className="mx-1 text-primary underline-offset-2 hover:underline">知识库</a>
                按主题查看。
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
