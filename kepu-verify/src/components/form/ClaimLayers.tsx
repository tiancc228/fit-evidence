import { BadgeCheck, CircleAlert, CircleCheck, ExternalLink, Info, OctagonAlert } from "lucide-react";
import type { Claim, Verdict } from "@/src/lib/types";
import { fmtClock } from "@/src/lib/calc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLAIM_TYPE_LABEL, RELATION_LABEL, REVIEW_LABEL, STRENGTH_LABEL, VERDICT_META, getSourceVideo } from "./data";
import { LayerTag, MissingNote } from "./bits";

const VERDICT_ICON = {
  supported: CircleCheck,
  partial: CircleAlert,
  conflict: OctagonAlert,
  insufficient: Info,
} as const;

export interface ClaimOverride {
  verdict?: Verdict;
  advice?: string;
  review?: Claim["review"];
}

function evidenceUrl(ref: { doi: string | null; pmid: string | null; url: string | null }): string | null {
  if (ref.url) return ref.url;
  if (ref.doi) return `https://doi.org/${ref.doi}`;
  if (ref.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`;
  return null;
}

export default function ClaimLayers({ claim, override }: { claim: Claim; override?: ClaimOverride }) {
  const verdict = override?.verdict ?? claim.layer3.verdict;
  const vm = VERDICT_META[verdict];
  const VIcon = VERDICT_ICON[verdict];
  const advice = override?.advice ?? claim.layer4.advice;
  const reviewState = override?.review?.state ?? claim.review.state;
  const src = claim.layer1.source;
  const video = getSourceVideo(src?.bvid);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{claim.topicLabel}</span>
        <Badge variant="secondary">{CLAIM_TYPE_LABEL[claim.layer2.claimType]}</Badge>
        <Badge variant="outline" className="gap-1">
          <BadgeCheck className="size-3 text-science" />
          {REVIEW_LABEL[reviewState]}
        </Badge>
      </div>

      {/* 第一层：博主原话 */}
      <section className="rounded-lg border border-voice/25 bg-voice-soft p-3">
        <LayerTag n={1} className="mb-2" />
        {claim.layer1.quote ? (
          <>
            <blockquote className="border-l-2 border-voice/50 pl-3 text-sm leading-relaxed">
              “{claim.layer1.quote}”
            </blockquote>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {src && (
                <span>
                  {src.author} · {video?.title ?? src.title}
                </span>
              )}
              {claim.layer1.startSec != null && (
                <span>
                  原文位置 {fmtClock(claim.layer1.startSec)}
                  {claim.layer1.endSec != null ? `–${fmtClock(claim.layer1.endSec)}` : ""}
                </span>
              )}
              {src?.url && (
                <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                  <a href={src.url} target="_blank" rel="noopener noreferrer">
                    查看原视频
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
              )}
            </div>
          </>
        ) : (
          <MissingNote>素材不足：{claim.layer1.missingReason ?? "未获取到可核对的博主原话，不展示推测内容。"}</MissingNote>
        )}
      </section>

      {/* 第二层：AI 拆解结论 */}
      <section className="rounded-lg border border-ai/25 bg-ai-soft p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <LayerTag n={2} />
          <Badge variant="outline" className="text-muted-foreground">
            {claim.layer2.generatedBy === "ai" ? "AI 生成，需人工复核" : "人工撰写"}
          </Badge>
        </div>
        <p className="text-sm font-medium leading-relaxed">{claim.layer2.statement}</p>
        {claim.layer2.rationale && <p className="mt-1 text-xs text-muted-foreground">{claim.layer2.rationale}</p>}
      </section>

      {/* 第三层：科学证据 */}
      <section className="rounded-lg border border-science/25 bg-science-soft p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <LayerTag n={3} />
          <Badge variant="outline" className={cn("gap-1", vm.className)}>
            <VIcon className={cn("size-3", vm.iconClass)} />
            {vm.label}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{claim.layer3.verdictReason}</p>
        {claim.layer3.evidence.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-2">
            {claim.layer3.evidence.map((ev, i) => {
              const url = evidenceUrl(ev.ref);
              return (
                <li key={i} className="rounded-lg border border-border bg-card p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        ev.relation === "refutes"
                          ? "border-destructive/40 bg-destructive/10 text-foreground"
                          : "border-science/40 bg-science/10 text-foreground",
                      )}
                    >
                      {RELATION_LABEL[ev.relation]}
                    </Badge>
                    <Badge variant="secondary">证据强度 {STRENGTH_LABEL[ev.strength]}</Badge>
                    {ev.ref.year != null && <span className="text-xs text-muted-foreground">{ev.ref.year}</span>}
                  </div>
                  <p className="mt-1.5 text-xs font-medium leading-snug">{ev.ref.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ev.ref.authors.slice(0, 3).join(", ")}
                    {ev.ref.authors.length > 3 ? " 等" : ""}
                    {ev.ref.journal ? ` · ${ev.ref.journal}` : ""}
                  </p>
                  {ev.note && <p className="mt-1 text-xs text-muted-foreground">{ev.note}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {ev.ref.doi && <Badge variant="outline" className="font-mono text-[10px]">DOI {ev.ref.doi}</Badge>}
                    {ev.ref.pmid && <Badge variant="outline" className="font-mono text-[10px]">PMID {ev.ref.pmid}</Badge>}
                    {url && (
                      <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          查看文献
                          <ExternalLink className="size-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <MissingNote>暂无可核对的文献证据（素材不足），结论强度有限。</MissingNote>
        )}
        {claim.layer3.guideline.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {claim.layer3.guideline.map((g, i) => (
              <li key={i} className="rounded-lg border border-border bg-card p-2.5 text-xs">
                <p className="font-medium">
                  {g.title} · {g.issuer} · {g.publishedAt}
                </p>
                <p className="mt-0.5 text-muted-foreground">{g.clause}</p>
                {g.url && (
                  <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0 text-xs">
                    <a href={g.url} target="_blank" rel="noopener noreferrer">
                      查看指南
                      <ExternalLink className="size-3" />
                    </a>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 第四层：产品最终建议 */}
      <section className="rounded-lg border border-advice/40 bg-advice-soft p-3">
        <LayerTag n={4} className="mb-2" />
        {advice ? (
          <p className="text-sm leading-relaxed">{advice}</p>
        ) : (
          <MissingNote>素材不足：该结论尚未形成产品最终建议。</MissingNote>
        )}
        {(claim.layer4.appliesTo.length > 0 || claim.layer4.notFor.length > 0) && (
          <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            {claim.layer4.appliesTo.length > 0 && <span>适用：{claim.layer4.appliesTo.join("、")}</span>}
            {claim.layer4.notFor.length > 0 && <span className="text-destructive">不适用：{claim.layer4.notFor.join("、")}</span>}
          </div>
        )}
        {claim.layer4.reviewedBy && (
          <p className="mt-1.5 text-xs text-muted-foreground">复核：{claim.layer4.reviewedBy}</p>
        )}
      </section>
    </div>
  );
}