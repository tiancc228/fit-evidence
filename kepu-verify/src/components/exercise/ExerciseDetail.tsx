import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Camera, ChevronDown, CircleCheck, Dumbbell, Focus, Footprints, Images,
  Info, ListChecks, Route, Target, TriangleAlert, Video,
} from "lucide-react";
import type { AppState, Exercise } from "@/src/lib/types";
import { useApp } from "@/src/lib/store";
import { AI_STATUS_LABEL, aiStatus } from "@/src/lib/ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { LEVEL_META, claimsForExercise } from "@/src/components/form/data";
import ClaimLayers, { type ClaimOverride } from "@/src/components/form/ClaimLayers";
import { MissingNote, ProductAdviceTag, SCROLLBAR_X } from "@/src/components/form/bits";
import SourceStatusBadge, { SOURCE_STATUS_META } from "./SourceStatusBadge";
import VideoSources from "./VideoSources";
import { sourcesFor } from "./sources";

const PATTERN_HINT: Record<string, string> = {
  推: "把阻力从身体推离。",
  拉: "把阻力拉向身体。",
  蹲: "屈髋屈膝下沉，再用下肢站起。",
  铰链: "以髋为轴，躯干前倾与后伸。",
  核心: "躯干保持稳定，抵抗伸展或旋转。",
  活动度: "在可控范围内活动关节。",
};

const CHECKPOINT_KEYWORDS = /肩|膝|髋|腰|背|肘|腕|头|脚|重心|核心|中立|贴|朝向|对齐|稳定/g;

/** 按关键词相关度挑选检查点，只选原文，不改写；同分时保持动作库顺序。 */
function pickCheckpoints(cues: string[]) {
  return cues
    .map((text, index) => ({ text, index, score: (text.match(CHECKPOINT_KEYWORDS) ?? []).length }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index);
}

function DetailSection({
  icon: Icon,
  title,
  tag,
  description,
  children,
}: {
  icon: typeof Target;
  title: string;
  tag?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-20 rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
          <Icon className="size-4 text-chart-1" />
        </span>
        <h2 className="font-semibold">{title}</h2>
        {tag}
      </div>
      {description && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MetaItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function ExerciseDetail({
  exercise,
  onBack,
  onAnalyze,
}: {
  exercise: Exercise;
  onBack: () => void;
  onAnalyze: (exercise: Exercise) => void;
}) {
  const { state } = useApp();
  const [metaOpen, setMetaOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);

  const sources = useMemo(() => sourcesFor(exercise), [exercise]);
  const claims = useMemo(() => claimsForExercise(exercise.id), [exercise.id]);
  const overrides = ((state as AppState).claimOverrides ?? {}) as Record<string, ClaimOverride>;
  const formPhotos = useMemo(
    () => ((state as AppState).photos ?? []).filter((p) => p.kind === "form" && p.label === exercise.name),
    [state, exercise.name],
  );
  const latestPhoto = formPhotos.reduce<string | null>(
    (max, photo) => (max === null || photo.date > max ? photo.date : max),
    null,
  );
  const level = LEVEL_META[exercise.level];
  const ai = aiStatus();

  const preparation = exercise.cues[0] ?? null;
  const execution = exercise.cues.slice(1);
  const checkpoints = pickCheckpoints(exercise.cues);
  const statusLabel = SOURCE_STATUS_META[sources.status].label;

  return (
    <div className="flex flex-col gap-4">
      <article className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
            <ArrowLeft className="size-4" />
            返回动作列表
          </Button>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{exercise.part}</Badge>
            <Badge variant="outline">{exercise.pattern}</Badge>
            <SourceStatusBadge
              status={sources.status}
              count={sources.status === "exact" ? sources.exact.length : sources.near.length}
            />
          </div>
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{exercise.name}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          动作要领与纠错标注为「产品教学建议」；视频来源按精确匹配与相关变式分开，缺失内容不补写。
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onAnalyze(exercise)}>
            <Camera className="size-4" />
            上传我的动作
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => videoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <Video className="size-4" />
            查看相关教学视频
          </Button>
        </div>

        <Collapsible open={metaOpen} onOpenChange={setMetaOpen} className="mt-3">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Dumbbell className="size-3.5" />
            动作资料：英文名 / 器械 / 难度 / MET
            <ChevronDown className={cn("size-3.5 transition-transform", metaOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem label="英文名" value={exercise.nameEn} />
            <MetaItem label="器械" value={exercise.equipment} />
            <MetaItem label="难度" value={level.label} />
            <MetaItem
              label="MET"
              value={String(exercise.met)}
              hint="MET（代谢当量）用于估算热量消耗，数值越高单位时间消耗越大。"
            />
          </CollapsibleContent>
        </Collapsible>
      </article>

      <DetailSection
        icon={Target}
        title="动作目的"
        tag={<ProductAdviceTag />}
        description="动作库没有单列「动作目的」字段；以下只按库中的目标部位与动作模式整理，不推断增肌或减脂效果。"
      >
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">目标部位：{exercise.part}</Badge>
          <Badge variant="outline">动作模式：{exercise.pattern}</Badge>
        </div>
        <p className="mt-2 text-sm leading-relaxed">
          {PATTERN_HINT[exercise.pattern] ?? "动作库未收录该动作模式的释义。"}
        </p>
      </DetailSection>

      <DetailSection
        icon={Footprints}
        title="准备姿势"
        tag={<ProductAdviceTag />}
        description="动作库没有单独的「准备姿势」字段；这里把第 1 条要领原文作为起始位展示，未改写。"
      >
        {preparation ? (
          <div className="rounded-lg border border-science/30 bg-science-soft p-3 text-sm leading-relaxed">
            <span className="mr-2 text-xs text-muted-foreground">要领 1 / {exercise.cues.length}</span>
            {preparation}
          </div>
        ) : (
          <MissingNote>动作库暂未提供准备姿势（素材不足）。</MissingNote>
        )}
      </DetailSection>

      <DetailSection
        icon={ListChecks}
        title="执行步骤"
        tag={<ProductAdviceTag />}
        description="其余要领按动作库原顺序展示，未改写。"
      >
        {execution.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {execution.map((cue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-science/15 text-xs font-medium">
                  {i + 2}
                </span>
                <span>{cue}</span>
              </li>
            ))}
          </ol>
        ) : (
          <MissingNote>动作库只记录了 1 条要领，已全部显示在「准备姿势」中。</MissingNote>
        )}
      </DetailSection>

      <DetailSection
        icon={Focus}
        title="三个最关键检查点"
        tag={<ProductAdviceTag />}
        description="按「关节对齐 / 重心 / 躯干稳定」等关键词相关度，从动作库要领中挑出最多 3 条；原文未改动，不是博主原话。"
      >
        <div className="flex flex-col gap-2">
          {checkpoints.map((checkpoint) => (
            <div key={checkpoint.index} className="flex items-start gap-2 rounded-lg border border-ok/30 bg-ok/5 p-2.5">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />
              <div className="min-w-0">
                <p className="text-sm leading-relaxed">{checkpoint.text}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">动作库要领 {checkpoint.index + 1}</p>
              </div>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection
        icon={TriangleAlert}
        title="常见错误"
        tag={<ProductAdviceTag />}
        description="错误表现、风险与纠正方法均为动作库中的产品教学建议。"
      >
        {exercise.commonErrors.length > 0 ? (
          <div className={cn("rounded-lg border border-border", SCROLLBAR_X)}>
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-muted-foreground">
                  <th className="px-3 py-2 font-medium">错误表现</th>
                  <th className="px-3 py-2 font-medium">风险</th>
                  <th className="px-3 py-2 font-medium">纠正方法</th>
                </tr>
              </thead>
              <tbody>
                {exercise.commonErrors.map((error, i) => (
                  <tr key={i} className="border-b border-border align-top last:border-0">
                    <td className="px-3 py-2 font-medium">{error.error}</td>
                    <td className="px-3 py-2 text-destructive">{error.risk}</td>
                    <td className="px-3 py-2 leading-relaxed">{error.fix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <MissingNote>动作库暂未收录该动作的常见错误清单（素材不足）。</MissingNote>
        )}
      </DetailSection>

      <DetailSection
        icon={Route}
        title="退阶、进阶和替代动作"
      >
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Info className="size-4 text-muted-foreground" />
            暂未收录经核对的退阶 / 进阶 / 替代关系
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            动作库与现有来源没有提供可核验的替代动作字段。本页不自动推断，避免把不同动作说成可以互相替代。
          </p>
        </div>
      </DetailSection>

      <div ref={videoRef}>
        <DetailSection
          icon={Video}
          title="相关教学视频"
          tag={
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="border-ok/40 bg-ok/10 text-foreground">精确 {sources.exact.length}</Badge>
              <Badge variant="outline" className="border-warn/40 bg-warn/10 text-foreground">变式 {sources.near.length}</Badge>
            </div>
          }
          description="视频按动作组织，不设博主入口。精确匹配与相关变式分开，near 的差异说明来自原始数据字段。"
        >
          <VideoSources exercise={exercise} sources={sources} />
        </DetailSection>
      </div>

      <DetailSection
        icon={Camera}
        title="上传我的动作"
        description="照片会进入本机「训练照片」时间轴，并按动作名分组；点击下方按钮会切到「训练照片」并预选当前动作。AI 分析是否可用取决于服务配置。"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{AI_STATUS_LABEL[ai]}</Badge>
          {formPhotos.length > 0 ? (
            <Badge variant="secondary" className="gap-1">
              <Images className="size-3" />
              已记录 {formPhotos.length} 张{latestPhoto ? ` · 最近 ${latestPhoto}` : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">还没有这个动作的训练照片</Badge>
          )}
        </div>
        {ai !== "ready" && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            未配置 AI 图像识别时，可使用「手动自查」：按常见错误清单逐项勾选，生成纠错记录，不会冒充 AI 结果。
          </p>
        )}
        <div className="mt-3">
          <Button className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onAnalyze(exercise)}>
            <Camera className="size-4" />
            拍照 / 上传分析
          </Button>
        </div>
      </DetailSection>

      <DetailSection
        icon={Info}
        title="为什么这样判断"
        description="把来源判定规则、缺失内容和已整理的证据摊开说明，四层信息不合并。"
      >
        <div className="flex flex-col gap-2.5">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed">
            <p className="text-sm font-medium">教学来源状态：{statusLabel}</p>
            <p className="mt-1">
              精确匹配 {sources.exact.length} 条 · 相关变式 {sources.near.length} 条
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>exact：标题或章节与动作名一致，或包含核心动作词且未点名冲突器械。</li>
              <li>near：只点名了不同器械或体位，仅作变式参考，不视为同一个动作。</li>
              <li>none：经过定向补采仍没有 exact / near，视频区保持空状态。</li>
            </ul>
          </div>

          {sources.gap?.matchLevel === "none" && sources.gap.difference ? (
            <div className="rounded-lg border border-border p-3 text-xs leading-relaxed">
              <p className="font-medium">定向补采原始结论</p>
              <p className="mt-1 text-muted-foreground">{sources.gap.difference}</p>
            </div>
          ) : null}

          {sources.status === "none" && exercise.videoBvid ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              动作资料里另有一条关联视频，但标题 / 章节没有通过动作名核验；为避免误导，不列入教学来源。
            </p>
          ) : null}

          <div className="rounded-lg border border-border p-3 text-xs leading-relaxed">
            <p className="font-medium">不会被补写的内容</p>
            <p className="mt-1 text-muted-foreground">
              博主原话、逐字字幕、时间点、AI 总结、「该视频解决的问题」：只有来源数据真实存在时才展示。
              没有字幕或时间点时显示空状态，不根据标题或章节推测。
            </p>
          </div>

          {claims.length > 0 ? (
            <Collapsible open={evidenceOpen} onOpenChange={setEvidenceOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 text-left text-sm font-medium">
                已整理的拆解与文献证据（{claims.length} 条，四层分开）
                <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", evidenceOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 flex flex-col gap-4">
                {claims.map((claim) => (
                  <ClaimLayers key={claim.id} claim={claim} override={overrides[claim.id]} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <MissingNote>
              该动作暂无已核对的博主拆解与文献证据（素材不足）。上方要领与纠错为产品教学建议。
            </MissingNote>
          )}
        </div>
      </DetailSection>

      <Button variant="outline" className="w-fit gap-1.5" onClick={onBack}>
        <ArrowLeft className="size-4" />
        返回动作列表
      </Button>
    </div>
  );
}
