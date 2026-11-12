import type { ReactNode } from "react";
import {
  Bot, CalendarDays, Clock, ExternalLink, Paperclip,
  ScrollText, ShieldCheck, Tag, TriangleAlert, UserRound, Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Claim } from "@/src/lib/types";
import { fmtClock } from "@/src/lib/calc";
import { ClaimTypeBadge, ReviewBadge, VerdictBadge } from "@/src/components/kb/badges";
import { EvidenceItem } from "@/src/components/kb/EvidenceItem";
import {
  LAYER_TONE, effectiveEvidence, effectiveStatement, effectiveVerdictReason, fmtUnixDate,
  isAttached, platformLabel, topicLabel, type LayerTone,
} from "@/src/components/kb/meta";

export function LayerSection({
  n, tone, title, sub, action, children, className,
}: {
  n: number;
  tone: LayerTone;
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const t = LAYER_TONE[tone];
  return (
    <section data-layer={n} className={cn("rounded-lg border p-4", t.border, t.soft, className)}>
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold", t.chip)}>
          {n}
        </span>
        <h3 className={cn("text-sm font-semibold", t.head)}>{title}</h3>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </header>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

/** 第 1 层只读视图：审核台也复用，保证两处出处展示完全一致。 */
export function LayerOneView({ layer1 }: { layer1: Claim["layer1"] }) {
  const src = layer1.source;
  if (!src) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-background/40 p-3 text-sm text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
        <span>素材不足：未关联到视频来源。{layer1.missingReason ?? ""}</span>
      </div>
    );
  }
  const quote = layer1.quote ? (layer1.quote.length > 60 ? `${layer1.quote.slice(0, 60)}…` : layer1.quote) : null;
  const timestamp =
    layer1.startSec != null
      ? `${fmtClock(layer1.startSec)}${layer1.endSec != null && layer1.endSec !== layer1.startSec ? `–${fmtClock(layer1.endSec)}` : ""}`
      : null;

  return (
    <div className="grid gap-3">
      {quote ? (
        <blockquote className="border-l-2 border-voice pl-3 text-sm leading-relaxed italic">
          “{quote}”
        </blockquote>
      ) : (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
          未获取到逐字字幕。{layer1.missingReason ?? "原因未记录"}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <UserRound className="size-3.5 text-voice" />
          {src.author}
        </span>
        <span className="inline-flex items-center gap-1">
          <Video className="size-3.5" />
          {platformLabel(src.platform)}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5" />
          {fmtUnixDate(src.pubdate)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" />
          {timestamp ?? "未获取到逐字字幕"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={src.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-voice/40 bg-voice/10 px-2.5 py-1 text-xs font-medium text-voice hover:underline"
        >
          <ExternalLink className="size-3" />
          观看原视频
        </a>
        {src.bvid && <Badge variant="outline" className="font-mono text-muted-foreground">{src.bvid}</Badge>}
        {quote && timestamp == null && (
          <span className="text-xs text-muted-foreground">引用未定位到时间戳</span>
        )}
      </div>
    </div>
  );
}

/**
 * 四层出处正文：公开卡片与证据抽屉共用同一份渲染，保证两处不出现两种说法。
 * include 只决定渲染哪几层——抽屉把第 4 层提到最上方单独渲染，所以传 [1,2,3]。
 */
export function ClaimLayers({
  claim, topics = [], include = [1, 2, 3, 4], className,
}: {
  claim: Claim;
  topics?: { id: string; label: string }[];
  include?: Array<1 | 2 | 3 | 4>;
  className?: string;
}) {
  const statement = effectiveStatement(claim);
  const reason = effectiveVerdictReason(claim);
  const evidence = effectiveEvidence(claim);
  const has = (n: 1 | 2 | 3 | 4) => include.includes(n);

  return (
    <div className={cn("grid gap-4", className)}>
      {has(1) && (
        <LayerSection n={1} tone="voice" title="博主原话" sub="原文引用 · 可跳转原平台核验">
          <LayerOneView layer1={claim.layer1} />
        </LayerSection>
      )}

      {has(2) && (
        <LayerSection
          n={2}
          tone="ai"
          title="AI 拆解结论"
          sub="从原话拆出的可核验陈述，不等于博主原话"
          action={
            <Badge variant="outline" className="gap-1 border-ai/40 bg-ai-soft text-ai">
              {claim.layer2.generatedBy === "ai" ? <Bot className="size-3" /> : <UserRound className="size-3" />}
              {claim.layer2.generatedBy === "ai" ? "AI 拆解" : "人工撰写"}
            </Badge>
          }
        >
          <p className="text-sm leading-relaxed font-medium">{statement}</p>
          <div className="flex items-center gap-2">
            <ClaimTypeBadge type={claim.layer2.claimType} />
            <span className="text-xs text-muted-foreground">宣称类型</span>
          </div>
          {claim.layer2.rationale ? (
            <p className="text-sm leading-relaxed text-muted-foreground">拆解理由：{claim.layer2.rationale}</p>
          ) : (
            <p className="text-sm text-muted-foreground">拆解理由未提供（素材不足）</p>
          )}
        </LayerSection>
      )}

      {has(3) && (
        <LayerSection n={3} tone="science" title="科学证据" sub="论文与指南独立核验，不依赖博主说法">
          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={claim.layer3.verdict} />
            <p className="text-sm leading-relaxed text-muted-foreground">{reason}</p>
          </div>

          {evidence.length > 0 ? (
            <div className="grid gap-3">
              {evidence.map((ev, i) => (
                <div key={ev.ref.doi ?? ev.ref.pmid ?? `${claim.id}-ev-${i}`} className="grid gap-1.5">
                  {isAttached(ev) && (
                    <Badge variant="outline" className="w-fit gap-1 border-science/40 bg-science-soft text-science">
                      <Paperclip className="size-3" />
                      审核人检索后挂载 · 元数据待人工核对
                    </Badge>
                  )}
                  <EvidenceItem
                    item={ev.ref}
                    relation={ev.relation}
                    strength={ev.strength}
                    note={ev.note}
                    topics={topics}
                    className="bg-background/40"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              暂无关联论文（素材不足），裁决仅基于现有材料。
            </p>
          )}

          {claim.layer3.guideline.length > 0 && (
            <div className="grid gap-2 rounded-lg border border-science/30 bg-background/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-science">
                <ScrollText className="size-3.5" />
                指南条款（区别于单篇论文）
              </p>
              {claim.layer3.guideline.map((g, i) => (
                <div key={`${claim.id}-g-${i}`} className="grid gap-1 border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <p className="text-sm font-medium">{g.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.issuer} · {g.publishedAt}
                  </p>
                  <p className="text-sm leading-relaxed">{g.clause}</p>
                  {g.url ? (
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-xs text-info hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      指南原文
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">官方原文链接待人工补充</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </LayerSection>
      )}

      {has(4) && (
        <LayerSection n={4} tone="advice" title="产品最终建议" sub="本站立场 · 经人工审核后给出">
          {claim.layer4.advice ? (
            <p className="text-sm leading-relaxed font-medium">{claim.layer4.advice}</p>
          ) : (
            <p className="text-sm text-muted-foreground">素材不足：最终建议尚未形成。</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">适用：</span>
            {claim.layer4.appliesTo.length > 0 ? (
              claim.layer4.appliesTo.map((t) => (
                <Badge key={t} variant="outline" className="border-advice/40 bg-advice-soft text-advice">{t}</Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">未限定</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">不适用：</span>
            {claim.layer4.notFor.length > 0 ? (
              claim.layer4.notFor.map((t) => (
                <Badge key={t} variant="outline" className="border-bad/40 bg-bad/10 text-bad">{t}</Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">未限定</span>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-advice" />
            {claim.layer4.reviewedBy ? `审核人：${claim.layer4.reviewedBy}` : "待人工审核"}
          </p>
        </LayerSection>
      )}
    </div>
  );
}

export function ClaimCard({ claim, topics = [] }: { claim: Claim; topics?: { id: string; label: string }[] }) {
  const statement = effectiveStatement(claim);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="gap-1">
            <Tag className="size-3" />
            {claim.topicLabel || topicLabel(claim.topic, topics)}
          </Badge>
          <ClaimTypeBadge type={claim.layer2.claimType} />
          <VerdictBadge verdict={claim.layer3.verdict} />
          <ReviewBadge state={claim.review.state} />
          <span className="ml-auto font-mono text-xs text-muted-foreground">{claim.id}</span>
        </div>
        <h2 className="text-lg leading-snug font-semibold tracking-tight">{statement}</h2>
      </CardHeader>

      <CardContent>
        <ClaimLayers claim={claim} topics={topics} />
      </CardContent>
    </Card>
  );
}