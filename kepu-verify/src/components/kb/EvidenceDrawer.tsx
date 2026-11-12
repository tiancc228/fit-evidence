import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, ChevronDown, FileText, Layers, Lock, Search, ShieldCheck, Tag, Users, Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Activity, Claim } from "@/src/lib/types";
import { GOAL_LABEL } from "@/src/lib/calc";
import { useApp } from "@/src/lib/store";
import { TOPICS } from "@/src/data/knowledge";
import { ClaimTypeBadge, ReviewBadge, VerdictBadge } from "@/src/components/kb/badges";
import { ClaimLayers, LayerSection } from "@/src/components/kb/ClaimCard";
import { ClaimsBrowser } from "@/src/components/kb/ClaimsBrowser";
import { EvidenceLibrary } from "@/src/components/kb/EvidenceLibrary";
import { VideoLibrary } from "@/src/components/kb/VideoLibrary";
import { SourcePolicyNote } from "@/src/components/kb/SourcePolicyNote";
import { REVIEW_META, effectiveEvidence, effectiveStatement, topicLabel } from "@/src/components/kb/meta";
import { useEvidenceTarget } from "@/src/components/kb/useEvidenceTarget";

const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: "久坐少动",
  light: "轻度活动",
  moderate: "中等活动",
  high: "高强度活动",
  athlete: "运动员 / 大量训练",
};

interface Props {
  open: boolean;
  onClose: () => void;
  claimId: string | null;
}

/** 普通用户入口：建议旁的「为什么这样建议」。主对话负责放到具体建议旁边。 */
export function WhyAdviceButton({
  claimId, onClick, className, label = "为什么这样建议",
}: {
  claimId: string | null;
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5", className)}
      onClick={onClick}
      disabled={!claimId}
      title={claimId ? "查看这条建议的完整出处链" : "这条建议还没有关联可核验的结论"}
    >
      <ShieldCheck className="size-4" />
      {label}
    </Button>
  );
}

function DrawerGate({
  icon, title, description, action,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Empty className="border border-border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

/** 第 4 层提到最上方：用户点的是建议，先看到建议本身。 */
function AdviceCard({ claim }: { claim: Claim }) {
  return (
    <LayerSection n={4} tone="advice" title="产品最终建议" sub="你点开的这条建议 · 第 4 层">
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
  );
}

/**
 * 用户数据只用来判断「这条建议适不适合你」，不参与生成建议文本。
 * 写清楚这一点，避免让人以为建议是按个人数据算出来的。
 */
function UsedDataCard({ claim }: { claim: Claim }) {
  const { state } = useApp();
  const profile = state.profile;
  const latest = useMemo(() => {
    if (state.body.length === 0) return null;
    return [...state.body].sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [state.body]);

  const bodyFat = latest?.bodyFatPct ?? profile?.bodyFatPct ?? null;

  return (
    <section data-used-data className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Users className="size-4 text-info" />
        <h3 className="text-sm font-semibold">使用了哪些你的数据</h3>
        <span className="text-xs text-muted-foreground">只用于判断适用性</span>
      </header>

      {!profile ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          还没有填写身体与目标数据，无法判断这条建议是否适合你。先完成「身体评估」再回来看会更准确。
        </p>
      ) : (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "训练目标", value: GOAL_LABEL[profile.goal] },
              { label: "每周训练", value: `${profile.trainingDaysPerWeek} 天` },
              { label: "体重", value: `${(latest?.weightKg ?? profile.weightKg).toFixed(1)} kg` },
              { label: "体脂", value: bodyFat != null ? `${bodyFat}%` : "未记录" },
              { label: "活动量", value: ACTIVITY_LABEL[profile.activity] },
            ].map((d) => (
              <div key={d.label} className="rounded-md border border-border bg-background/50 p-2.5">
                <p className="text-[11px] text-muted-foreground">{d.label}</p>
                <p className="text-sm font-semibold tabular-nums">{d.value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-1.5 rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed">
            <p>
              <span className="font-medium text-foreground">建议标注的适用条件：</span>
              {claim.layer4.appliesTo.length > 0 ? claim.layer4.appliesTo.join(" · ") : "未限定"}
            </p>
            <p>
              <span className="font-medium text-foreground">不适用：</span>
              {claim.layer4.notFor.length > 0 ? claim.layer4.notFor.join(" · ") : "未限定"}
            </p>
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        你的数据只用于判断这条建议是否适用；建议文本来自公开知识库，不会因个人数据改写。
      </p>
    </section>
  );
}

/**
 * 证据抽屉：普通用户点「为什么这样建议」后从右侧滑出。
 * 默认只展示当前结论的建议、适用性、四层出处；整个知识库的浏览收进「查看更多来源」。
 */
export function EvidenceDrawer({ open, onClose, claimId }: Props) {
  const { getClaim } = useEvidenceTarget();
  const [activeId, setActiveId] = useState<string | null>(claimId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveId(claimId);
  }, [claimId]);

  const claim = getClaim(activeId);
  const published = claim?.review.state === "published";

  // 文献库的 topic 是粗粒度（protein / creatine…），结论的 topic 是细粒度（protein-intake…），
  // 直接拿 claim.topic 去筛会 0 命中。用本条实际引用的文献主题来收窄。
  const evidenceTopics = useMemo(() => {
    if (!claim) return [] as string[];
    const set = new Set<string>();
    effectiveEvidence(claim).forEach((ev) => { if (ev.ref.topic) set.add(ev.ref.topic); });
    return Array.from(set);
  }, [claim]);
  const evidenceTopic = evidenceTopics.length === 1 ? evidenceTopics[0] : "all";

  function openClaim(id: string) {
    setActiveId(id);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-none lg:max-w-3xl">
        <div ref={scrollRef} className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto">
          <SheetHeader className="sticky top-0 z-10 gap-2 border-b border-border bg-background/95 p-4 pr-12 backdrop-blur">
            <p className="text-[11px] font-semibold tracking-widest text-primary uppercase">Evidence · 出处链</p>
            <SheetTitle className="text-xl">为什么这样建议</SheetTitle>

            {claim ? (
              <>
                <SheetDescription className="text-sm leading-relaxed font-medium text-foreground">
                  {effectiveStatement(claim)}
                </SheetDescription>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="gap-1">
                    <Tag className="size-3" />
                    {claim.topicLabel || topicLabel(claim.topic, TOPICS)}
                  </Badge>
                  <ClaimTypeBadge type={claim.layer2.claimType} />
                  <VerdictBadge verdict={claim.layer3.verdict} />
                  <ReviewBadge state={claim.review.state} />
                  <span className="font-mono text-[11px] text-muted-foreground">{claim.id}</span>
                </div>
              </>
            ) : (
              <SheetDescription className="text-sm text-muted-foreground">
                这里只展示已通过人工审核并发布的结论出处。
              </SheetDescription>
            )}
          </SheetHeader>

          <div className="grid gap-4 p-4 pb-10">
            {activeId == null ? (
              <DrawerGate
                icon={<Search />}
                title="还没有选择结论"
                description="在任意建议旁点「为什么这样建议」，这里会展示该条建议的完整出处链：博主原话、AI 拆解、科学证据和产品建议分别列出。"
              />
            ) : !claim ? (
              <DrawerGate
                icon={<Search />}
                title="没有找到这条结论"
                description={`编号 ${activeId} 不在知识库里，可能是链接来自旧版本或编号有误。可以先浏览已发布结论，再点「在抽屉里查看这条的出处」。`}
                action={<Button variant="outline" size="sm" onClick={onClose}>关闭抽屉</Button>}
              />
            ) : !published ? (
              <DrawerGate
                icon={<Lock />}
                title="这条结论尚未发布"
                description={
                  <>
                    当前审核状态：{REVIEW_META[claim.review.state].label}。未通过人工审核并发布的结论不会出现在用户侧，
                    它的博主原话、科学证据与产品建议都不在这里展示。请在「人工审核台」查看与推进。
                  </>
                }
                action={<ReviewBadge state={claim.review.state} />}
              />
            ) : (
              <>
                <AdviceCard claim={claim} />
                <UsedDataCard claim={claim} />

                <div className="grid gap-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="text-sm font-semibold">出处链 · 第 1–3 层</h2>
                    <span className="text-xs text-muted-foreground">
                      先看第 4 层建议，下面是可以核验的原始出处：博主原话 → AI 拆解 → 科学证据。
                    </span>
                  </div>
                  <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                    第 1 层只展示真实抓取到的博主原文（视频标题 / 简介）；逐字字幕需登录未获取时如实标注，
                    不用推测内容补写成博主原话。
                  </p>
                  <ClaimLayers claim={claim} topics={TOPICS} include={[1, 2, 3]} />
                </div>

                <SourcePolicyNote />

                <Collapsible key={activeId} className="rounded-lg border border-border bg-card">
                  <CollapsibleTrigger
                    className="flex w-full items-center gap-2 p-4 text-left data-[state=open]:[&>svg:last-child]:rotate-180"
                  >
                    <Layers className="size-4 shrink-0 text-primary" />
                    <span className="text-sm font-semibold">查看更多来源</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      全部结论 · 文献库 · 视频源（默认按本条主题与来源筛选）
                    </span>
                    <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-border p-4">
                    <Tabs defaultValue="claims" className="gap-3">
                      <TabsList className="w-full sm:w-fit">
                        <TabsTrigger value="claims" className="gap-1.5">
                          <FileText className="size-4" />
                          全部结论
                        </TabsTrigger>
                        <TabsTrigger value="evidence" className="gap-1.5">
                          <BookOpen className="size-4" />
                          文献库
                        </TabsTrigger>
                        <TabsTrigger value="videos" className="gap-1.5">
                          <Video className="size-4" />
                          视频源
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="claims" className="mt-3">
                        <ClaimsBrowser
                          scope="public"
                          initialTopic={claim.topic}
                          onOpenClaim={openClaim}
                          note="默认只显示与本条建议同主题的已发布结论；可以切到别的主题或清空筛选。"
                        />
                      </TabsContent>

                      <TabsContent value="evidence" className="mt-3">
                        <EvidenceLibrary
                          initialTopic={evidenceTopic}
                          note={evidenceTopic === "all"
                            ? "本条引用的文献涉及多个主题或暂未标注主题，这里没有收窄筛选。"
                            : `默认只显示与本条结论引用文献同主题的文献（${topicLabel(evidenceTopic, TOPICS)}）；可切到「全部主题」。`}
                        />
                      </TabsContent>

                      <TabsContent value="videos" className="mt-3">
                        <VideoLibrary
                          initialPlatform={claim.layer1.source?.platform ?? "all"}
                          initialAuthor={claim.layer1.source?.author ?? "all"}
                          note={claim.layer1.source
                            ? "默认只显示本条建议的来源视频；点「只看 …」可清除博主筛选，查看全部来源。"
                            : "本条结论没有可用的视频来源，下面展示全部来源供核对。"}
                        />
                      </TabsContent>
                    </Tabs>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
