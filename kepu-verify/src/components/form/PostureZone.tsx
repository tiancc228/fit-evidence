import { useMemo, useState } from "react";
import {
  Activity, Bone, ChevronDown, Dumbbell, HeartPulse, ListChecks, PersonStanding, ScanLine, Stethoscope, TriangleAlert,
} from "lucide-react";
import type { AppState, Exercise } from "@/src/lib/types";
import { useApp } from "@/src/lib/store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import ClaimLayers, { type ClaimOverride } from "./ClaimLayers";
import { CLAIMS, EXERCISES, isPostureExercise, matchExercises } from "./data";
import { MissingNote, ProductAdviceTag, SafetyAlert, VideoLink, VideoSourceCard } from "./bits";

interface PostureTopic {
  id: string;
  title: string;
  icon: typeof PersonStanding;
  intro: string;
  bvids: string[];
  checks: string[];
  redFlags?: string[];
  exerciseRe: RegExp;
  advice: string;
}

/** 视频 bvid 均已逐条核对 src/data/real-sources.json；自查条目为产品整理的观察提示，非医学诊断。 */
const TOPICS: PostureTopic[] = [
  {
    id: "round-shoulder",
    title: "圆肩驼背 · 肱骨前移",
    icon: PersonStanding,
    intro: "久坐人群最常见的上身姿态问题：肩向前卷、头前伸，卧推时肩前侧容易不适。",
    bvids: ["BV1ie4y1W7iZ"],
    checks: [
      "自然站立侧面看：耳垂明显在肩峰前方，头向前伸",
      "贴墙站立：脚跟、臀、上背贴墙时，后脑勺难以自然贴墙",
      "推类动作（卧推 / 俯卧撑）中肩膀习惯性前顶、耸肩，肩前侧发紧",
    ],
    exerciseRe: /圆肩|驼背|肱骨|胸椎|面拉|肩外旋|YTWL|后束|反向飞鸟|靠墙天使|扩胸|肩胛|胸肌拉伸|门框/,
    advice: "先放松前侧（胸肩前部），再强化背部（中下斜方肌、菱形肌、肩袖外旋肌）。训练时保持「胸挺、肩沉」，避免耸肩；肩前侧疼痛时暂停推类动作并就医评估。",
  },
  {
    id: "pelvic-tilt",
    title: "骨盆前倾",
    icon: Activity,
    intro: "小腹前凸、臀部后翘、腰曲过大，久站久走后腰部容易酸紧。",
    bvids: ["BV1nv4y177sQ"],
    checks: [
      "自然站立侧面看：小腹前凸、臀部后翘，腰部曲度明显偏大",
      "贴墙站立：臀与上背贴墙时，腰后空隙明显超过一掌厚度",
      "久站或久走后腰部酸紧，髋前侧（腹股沟附近）发紧",
    ],
    exerciseRe: /骨盆|前倾|髋屈|腰肌|臀桥|死虫|平板支撑|鸟狗/,
    advice: "拉伸髋屈肌（髋前侧）与腰部，强化臀部与腹部。站立和训练时保持肋骨下沉、骨盆中立，不要刻意塌腰翘臀。",
  },
  {
    id: "overview",
    title: "八大体态问题 · 总览自查",
    icon: ScanLine,
    intro: "先整体扫描，找出最明显的 1–2 个问题，再进入对应专区做针对性训练，不要一次想纠正所有问题。",
    bvids: ["BV1qdmoYUECG"],
    checks: [
      "对着镜子从头到脚扫描：头前伸、高低肩、肩胛骨外翻（翼状肩）、骨盆倾斜、膝超伸 / 内扣、足弓塌陷等",
      "拍下正面 / 侧面 / 背面自然站立照片，对比左右是否对称",
      "训练录像中反复出现同一处代偿（如深蹲总是塌腰或膝内扣）",
    ],
    exerciseRe: /体态|矫正|纠正/,
    advice: "把观察到的问题记下来，优先处理影响训练动作质量的那一个；配合下方对应专区的纠正训练与真实教学视频逐步改善。",
  },
  {
    id: "lumbar",
    title: "腰椎间盘 · 科普与就医信号",
    icon: Stethoscope,
    intro: "已确诊或怀疑腰椎问题的人，先看懂「什么时候必须就医」，再谈训练。视频为博主科普，不构成诊疗建议。",
    bvids: ["BV1kh411G7Li"],
    redFlags: [
      "腰痛向臀部 / 大腿 / 小腿放射，伴麻木或无力",
      "会阴区麻木、大小便控制异常（立即急诊）",
      "夜间痛醒、休息不缓解，或近期明显外伤",
    ],
    checks: [
      "已由医生确诊腰椎间盘突出 / 膨出，目前处于缓解期，想了解日常维护",
      "久坐后腰部酸僵，活动后缓解（非特异表现，先观察并调整久坐习惯）",
    ],
    exerciseRe: /腰椎|鸟狗|侧桥|死虫|麦吉尔|平板支撑/,
    advice: "出现上方任一红色信号请先就医，不要自行跟练。经医生允许后，从低负荷核心稳定动作（如鸟狗式、侧桥）起步，避免负重弯腰 + 扭转的组合。",
  },
  {
    id: "knee",
    title: "膝盖保养",
    icon: Bone,
    intro: "深蹲膝内扣、上下楼膝前痛是新手最常见的膝部困扰，多数与肌力不平衡和动作模式有关。",
    bvids: ["BV1Bo4y1Y7Fi"],
    checks: [
      "深蹲 / 弓步蹲时膝盖向内扣，无法与脚尖方向保持一致",
      "上下楼或下蹲时膝前侧酸痛，久坐起身后膝部发僵",
      "蹲起时膝盖弹响伴随疼痛或肿胀（无痛弹响通常无需紧张）",
    ],
    exerciseRe: /膝|静蹲|腿弯举|腿屈伸|臀中肌|蚌式/,
    advice: "强化臀中肌与大腿后侧，学习深蹲时「膝盖对准脚尖、向外撑开」；先减重量与幅度，循序渐进。出现肿胀、卡住感或持续疼痛请就医。",
  },
  {
    id: "clicking",
    title: "关节弹响",
    icon: HeartPulse,
    intro: "区分「无痛弹响」与「伴随症状的弹响」，前者多为生理现象，后者需要医学评估。",
    bvids: ["BV1nX4y1z7hn"],
    checks: [
      "热身或活动关节时弹响，但无疼痛、无肿胀、活动范围正常",
      "弹响伴随疼痛、肿胀或「卡住」感（请先就医，不要自行判断）",
    ],
    exerciseRe: /弹响|热身|关节/,
    advice: "无痛弹响一般无需过度担心，训练前充分热身、逐步增加幅度即可；伴痛 / 肿 / 卡住的弹响请交给医生评估。",
  },
];

function ExerciseMini({ ex, onOpen }: { ex: Exercise; onOpen: (name: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{ex.name}</span>
        <Badge variant="secondary" className="shrink-0">{ex.part}</Badge>
      </div>
      {ex.cues[0] && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">要领：{ex.cues[0]}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        <VideoLink bvid={ex.videoBvid} mini />
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => onOpen(ex.name)}>
          <Dumbbell className="size-3" />
          动作库详情
        </Button>
      </div>
    </div>
  );
}

export default function PostureZone({ onOpenExercise }: { onOpenExercise: (name: string) => void }) {
  const { state } = useApp();
  const overrides = ((state as AppState).claimOverrides ?? {}) as Record<string, ClaimOverride>;
  const [checked, setChecked] = useState<Record<string, number[]>>({});
  const [evidenceOpen, setEvidenceOpen] = useState<Record<string, boolean>>({});

  const topicData = useMemo(
    () =>
      TOPICS.map((t) => {
        const matched = matchExercises(t.exerciseRe, 6);
        const ids = new Set(matched.map((e) => e.id));
        const claims = CLAIMS.filter((c) => c.exerciseIds?.some((id) => ids.has(id)));
        return { topic: t, matched, claims };
      }),
    [],
  );

  const coveredIds = useMemo(() => {
    const s = new Set<string>();
    for (const { matched } of topicData) for (const e of matched) s.add(e.id);
    return s;
  }, [topicData]);
  const leftovers = EXERCISES.filter((e) => isPostureExercise(e) && !coveredIds.has(e.id));

  const toggle = (topicId: string, idx: number, on: boolean) => {
    setChecked((prev) => {
      const cur = prev[topicId] ?? [];
      return { ...prev, [topicId]: on ? [...cur, idx] : cur.filter((i) => i !== idx) };
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <SafetyAlert />
      <Alert className="border-warn/40 bg-warn/10">
        <TriangleAlert className="text-warn" />
        <AlertTitle>自查清单怎么用</AlertTitle>
        <AlertDescription>
          以下清单是产品整理的观察提示，帮助你留意自己的姿态，不构成医学诊断。勾选结果只在本页临时展示，不会保存。已确诊疾病或持续疼痛，请以医生意见为准。
        </AlertDescription>
      </Alert>

      {topicData.map(({ topic, matched, claims }) => {
        const Icon = topic.icon;
        const myChecks = checked[topic.id] ?? [];
        return (
          <Card key={topic.id} className="rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
                  <Icon className="size-4.5 text-chart-1" />
                </span>
                {topic.title}
              </CardTitle>
              <CardDescription>{topic.intro}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-medium">
                    <ListChecks className="size-4 text-science" />
                    自查清单
                  </h4>
                  <Badge variant="outline" className="text-muted-foreground">产品自查提示 · 非医学诊断</Badge>
                </div>
                {topic.redFlags && (
                  <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
                    <TriangleAlert />
                    <AlertTitle>出现以下情况请先就医</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4">
                        {topic.redFlags.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <ul className="flex flex-col gap-2">
                  {topic.checks.map((c, i) => {
                    const on = myChecks.includes(i);
                    return (
                      <li key={i} className={cn("flex items-start gap-2 rounded-lg border bg-card p-2.5 transition-colors", on ? "border-science/50 bg-science/5" : "border-border")}>
                        <Checkbox
                          id={`posture-${topic.id}-${i}`}
                          checked={on}
                          onCheckedChange={(v) => toggle(topic.id, i, v === true)}
                          className="mt-0.5"
                        />
                        <Label htmlFor={`posture-${topic.id}-${i}`} className="text-sm font-normal leading-snug">
                          {c}
                        </Label>
                      </li>
                    );
                  })}
                </ul>
                {myChecks.length > 0 && (
                  <div className="rounded-lg border border-advice/40 bg-advice-soft p-3">
                    <p className="text-sm font-medium">你勾选了 {myChecks.length} 项观察结果</p>
                    <p className="mt-1 text-xs leading-relaxed">{topic.advice}</p>
                    <div className="mt-1.5">
                      <ProductAdviceTag />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <h4 className="text-sm font-medium">真实教学视频（跳转 B 站原页面）</h4>
                {topic.bvids.map((b) => (
                  <VideoSourceCard key={b} bvid={b} />
                ))}
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-medium">对应纠正训练</h4>
                  <ProductAdviceTag />
                </div>
                {matched.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {matched.map((ex) => (
                      <ExerciseMini key={ex.id} ex={ex} onOpen={onOpenExercise} />
                    ))}
                  </div>
                ) : (
                  <MissingNote>动作库中暂无匹配的纠正训练（素材不足）。可先跟随上方真实视频学习，注意无痛范围。</MissingNote>
                )}
                {claims.length > 0 && (
                  <Collapsible
                    open={!!evidenceOpen[topic.id]}
                    onOpenChange={(o) => setEvidenceOpen((prev) => ({ ...prev, [topic.id]: o }))}
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-2.5 text-left text-sm font-medium">
                      博主拆解与文献证据（{claims.length} 条，四层分开）
                      <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", evidenceOpen[topic.id] && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 flex flex-col gap-4">
                      {claims.map((c) => (
                        <ClaimLayers key={c.id} claim={c} override={overrides[c.id]} />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {leftovers.length > 0 && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-2/10">
                <Dumbbell className="size-4.5 text-chart-2" />
              </span>
              其他体态矫正动作
            </CardTitle>
            <CardDescription>动作库中其余体态矫正类动作，要领与纠错为产品教学建议。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {leftovers.map((ex) => (
              <ExerciseMini key={ex.id} ex={ex} onOpen={onOpenExercise} />
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        视频版权归原博主所有，B 站视频页标注「未经作者授权，禁止转载」。本页仅展示来源信息与跳转链接，不搬运、不重新发布任何视频内容。
      </p>
    </div>
  );
}