import { useMemo, useState } from "react";
import {
  ArrowUpRight, BookOpen, Camera, Dumbbell, ExternalLink, Flame,
  Layers, Quote, Scale, ShieldCheck, Sparkles, Target, UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp, isDemoData } from "@/src/lib/store";
import { assessStage, dayBalance, macroTargets, GOAL_LABEL } from "@/src/lib/calc";
import { EXERCISE_BY_ID } from "@/src/data/exercises";
import sources from "@/src/data/real-sources.json";
import douyin from "@/src/data/douyin-sources.json";
import { CLAIMS } from "@/src/data/knowledge";
import { SOURCE_INDEX, sourceStats } from "@/src/data/source-index";

const VALID_VIDEOS = sources.videos.filter((v) => v.bvid);
const DOUYIN_VIDEOS = douyin.videos;
const VIDEO_TOTAL = VALID_VIDEOS.length + DOUYIN_VIDEOS.length;
const DOI_COUNT = sources.evidence.filter((e) => e.doi).length;
const PMID_COUNT = sources.evidence.filter((e) => e.pmid).length;

const LAYERS = [
  { key: "voice", n: "01", label: "博主原话", color: "var(--layer-voice)", soft: "var(--layer-voice-soft)", icon: Quote, note: "只引用真实存在的原文，不替博主发言" },
  { key: "ai", n: "02", label: "AI 拆解结论", color: "var(--layer-ai)", soft: "var(--layer-ai-soft)", icon: Sparkles, note: "把经验说法拆成可被文献检验的一句话" },
  { key: "science", n: "03", label: "科学证据与裁决", color: "var(--layer-science)", soft: "var(--layer-science-soft)", icon: BookOpen, note: "逐篇标注支持/反驳/部分/背景与证据强度" },
  { key: "advice", n: "04", label: "产品最终建议", color: "var(--layer-advice)", soft: "var(--layer-advice-soft)", icon: ShieldCheck, note: "经人工审核后才发布，证据不足就不给结论" },
] as const;

const DEMO = [
  {
    id: "protein",
    topic: "蛋白质摄入量",
    verdict: "supported" as const,
    verdictLabel: "证据支持",
    voice: {
      quote: "蛋白质摄入量详讲",
      author: "凯圣王",
      title: "蛋白质摄入量详讲",
      date: "2026-01-21",
      duration: "18:04",
      url: "https://www.bilibili.com/video/BV1A4zjB7EcE",
      origin: "引用来自视频标题原文",
      missing: "未获取到逐字字幕（B 站字幕接口需登录），因此不提供时间戳。",
    },
    ai: {
      statement: "抗阻训练人群在充足能量摄入下提高蛋白质摄入，可进一步增加瘦体重与力量。",
      rationale: "视频主题为蛋白质摄入量，拆解为「剂量—效应」型结论，便于用 meta 分析直接检验。",
    },
    science: {
      papers: [{
        title: "A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults.",
        journal: "British Journal of Sports Medicine",
        year: 2018,
        doi: "10.1136/bjsports-2017-097608",
        pmid: "28698222",
        cited: 823,
        relation: "支持",
        strength: "高",
      }],
      reason: "该 meta 分析纳入 49 项研究、1863 名受试者，显示蛋白质补充显著增加抗阻训练带来的瘦体重与力量增长，效应量在约 1.6 g/kg/d 处趋于平台。与博主「重视蛋白质摄入量」的方向一致。",
    },
    advice: {
      text: "增肌期蛋白质 1.6–2.2 g/kg 体重；减脂期提高到 2.0–2.7 g/kg 以保留瘦体重。按每餐平均分配，而非集中一餐。",
      applies: ["规律抗阻训练的健康成人"],
      notFor: ["慢性肾病患者（需遵医嘱）"],
    },
  },
  {
    id: "carb",
    topic: "碳水动态调整",
    verdict: "insufficient" as const,
    verdictLabel: "证据不足",
    voice: {
      quote: "碳水调整以训练状态和水平提升为主保持微微饥饿感",
      author: "谭成义",
      title: "力量训练者如何安排具体碳水蛋白脂肪的量，碳水调整以训练状态和水平提升为主保持微微饥饿感",
      date: "2025-12-10",
      duration: "15:18",
      url: "https://www.bilibili.com/video/BV1fempB5EV5",
      origin: "引用来自视频标题原文片段",
      missing: "未获取到逐字字幕，因此不提供时间戳。",
    },
    ai: {
      statement: "碳水摄入应按训练状态与水平提升动态调整，而非固定为某一体重倍数。",
      rationale: "博主强调「以训练状态为主」，拆解为「动态调整优于固定倍数」的可检验命题。",
    },
    science: {
      papers: [],
      reason: "当前证据库以蛋白质、肌酸、训练频率与容量为主，缺少直接比较「按训练状态动态调整碳水」与「固定碳水倍数」的对照研究。因此判定为证据不足，不将其升级为确定结论。",
    },
    advice: {
      text: null,
      applies: [],
      notFor: [],
    },
  },
];

const VERDICT_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  supported: { bg: "var(--layer-science-soft)", fg: "var(--layer-science)", label: "证据支持" },
  partial: { bg: "color-mix(in srgb, var(--tone-warn) 15%, transparent)", fg: "var(--tone-warn)", label: "部分支持" },
  conflict: { bg: "color-mix(in srgb, var(--tone-bad) 15%, transparent)", fg: "var(--tone-bad)", label: "存在冲突" },
  insufficient: { bg: "color-mix(in srgb, var(--site-muted) 18%, transparent)", fg: "var(--site-muted)", label: "证据不足" },
};

const FEATURES = [
  { href: "#/body", icon: Scale, title: "身体状态评估", desc: "身高体重体脂 + 照片记录，判断你处在哪个阶段", color: "var(--chart-3)" },
  { href: "#/plan", icon: Target, title: "健身计划规划", desc: "碳水几倍、主食多少 g、蔬菜多少 g，每条都带出处", color: "var(--layer-advice)" },
  { href: "#/form", icon: Dumbbell, title: "动作规范与纠正", desc: "动作库 + 常见错误 + 真实教学视频直达", color: "var(--chart-4)" },
  { href: "#/diet", icon: UtensilsCrossed, title: "食物热量计算", desc: "拍照或手动记录，判断缺口盈余是否合理", color: "var(--chart-5)" },
  { href: "#/overview", icon: Flame, title: "总体状态评估", desc: "饮食训练睡眠汇总，回答「我现在合理吗」", color: "var(--chart-2)" },
  { href: "#/knowledge", icon: Layers, title: "知识库与文献库", desc: "四层分离的知识卡片，完整出处可点击核验", color: "var(--layer-science)" },
];

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="rise">
      <div className="font-mono text-3xl font-semibold tabular-nums text-foreground md:text-4xl">{value}</div>
      <div className="mt-1 text-sm text-foreground/80">{label}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export default function Home() {
  const { state, clearAll } = useApp();
  const [demoIdx, setDemoIdx] = useState(0);
  const [activeLayer, setActiveLayer] = useState(0);
  const demo = DEMO[demoIdx];

  const snapshot = useMemo(() => {
    const p = state.profile;
    if (!p) return null;
    const t = macroTargets(p);
    const stage = assessStage(p);
    const todayStr = new Date().toISOString().slice(0, 10);
    const meals = state.meals.filter((m) => m.date === todayStr);
    const trainings = state.training
      .filter((x) => x.date === todayStr)
      .map((x) => ({
        durationMin: x.durationMin,
        met: EXERCISE_BY_ID.get(x.exerciseId)?.met ?? 4.5,
        weightKg: p.weightKg,
      }));
    const bal = dayBalance(p, meals, trainings);
    return { p, t, stage, bal };
  }, [state]);

  return (
    <div className="relative">
      {/* ── Hero ───────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="energy-line h-1 w-full" />
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 md:pt-20 md:pb-16">
          <div className="rise flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              2026 Qoder 高校创造力大赛
            </Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">
              证据可核验 · 出处可点击
            </Badge>
          </div>

          <h1 className="rise mt-6 max-w-3xl text-4xl leading-[1.12] font-semibold tracking-tight md:text-6xl" style={{ animationDelay: "60ms" }}>
            训练怎么练，饮食怎么吃，
            <span className="relative inline-block">
              <span className="relative z-10">每一步都有依据。</span>
              <span className="absolute inset-x-0 bottom-1 z-0 h-3 md:h-4" style={{ background: "color-mix(in srgb, var(--site-accent) 38%, transparent)" }} />
            </span>
          </h1>

          <p className="rise mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg" style={{ animationDelay: "120ms" }}>
            根据你的目标、训练条件和每日记录，算出今天该练什么、该吃多少。
            <span className="text-foreground"> 每条关键建议都能点开</span>
            ，看到它出自哪位博主的哪条视频、哪些论文，以及这些论文到底支持还是反对。
            <span className="text-foreground">证据不足时，我们直说。</span>
          </p>

          <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "180ms" }}>
            <Button asChild size="lg" className="gap-2">
              <a href="#/plan">开始制定计划 <ArrowUpRight className="size-4" /></a>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <a href="#/overview">先看今天的示例 <Flame className="size-4" /></a>
            </Button>
          </div>

          <p className="rise mt-7 max-w-3xl text-xs leading-relaxed text-muted-foreground" style={{ animationDelay: "240ms" }}>
            已登记 {SOURCE_INDEX.length} 条视频来源，其中 {sourceStats().withChapters} 条有公开章节；{CLAIMS.length} 条观点已拆解、{sources.evidence.length} 篇文献可追溯。
            <span className="text-foreground"> 登记来源不等于已核验</span>——只有通过人工审核的结论才会进入你的建议。
          </p>
        </div>
      </section>

      {/* ── 四层机制演示 ───────────────────────── */}
      <section id="mechanism" className="mx-auto max-w-6xl px-5 py-14 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs tracking-[0.2em] text-primary uppercase">The mechanism</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">一条结论是怎么诞生的</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              下面两条都是真实数据。点左侧任意一层查看内容——注意第二条：证据不够，产品就不给建议。
            </p>
          </div>
          <div className="flex gap-2">
            {DEMO.map((d, i) => (
              <button
                key={d.id}
                onClick={() => { setDemoIdx(i); setActiveLayer(0); }}
                className="rounded-lg border px-3 py-2 text-left text-xs transition-colors"
                style={{
                  borderColor: i === demoIdx ? VERDICT_STYLE[d.verdict].fg : "var(--site-border)",
                  background: i === demoIdx ? VERDICT_STYLE[d.verdict].bg : "transparent",
                  color: i === demoIdx ? VERDICT_STYLE[d.verdict].fg : "var(--site-muted)",
                }}
              >
                <div className="font-medium">{d.topic}</div>
                <div className="mt-0.5 opacity-80">{d.verdictLabel}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[260px_1fr]">
          {/* 层导航 */}
          <div className="flex flex-col gap-2">
            {LAYERS.map((L, i) => {
              const Icon = L.icon;
              const on = i === activeLayer;
              return (
                <button
                  key={L.key}
                  onClick={() => setActiveLayer(i)}
                  className="group flex items-start gap-3 rounded-xl border p-3 text-left transition-all"
                  style={{
                    borderColor: on ? L.color : "var(--site-border)",
                    background: on ? L.soft : "var(--site-surface)",
                  }}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: on ? L.color : "var(--site-elevated)", color: on ? "var(--site-bg)" : L.color }}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[10px] opacity-60">{L.n}</span>
                      <span className="text-sm font-medium" style={{ color: on ? L.color : "var(--site-fg)" }}>{L.label}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-muted-foreground">{L.note}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* 层内容 */}
          <div className="rounded-2xl border border-border bg-card p-5 md:p-7" style={{ borderColor: `color-mix(in srgb, ${LAYERS[activeLayer].color} 35%, var(--site-border))` }}>
            {activeLayer === 0 && (
              <div className="rise">
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--layer-voice)" }}>
                  <Quote className="size-3.5" /> 第 1 层 · 博主原话
                </div>
                <blockquote className="mt-4 border-l-2 pl-4 text-lg leading-relaxed md:text-xl" style={{ borderColor: "var(--layer-voice)" }}>
                  「{demo.voice.quote}」
                </blockquote>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{demo.voice.author}</span>
                  <span>{demo.voice.date}</span>
                  <span className="font-mono">{demo.voice.duration}</span>
                  <a href={demo.voice.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-foreground underline decoration-dotted underline-offset-4 hover:text-primary">
                    观看原视频 <ExternalLink className="size-3" />
                  </a>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  {demo.voice.origin}。{demo.voice.missing}
                </p>
              </div>
            )}

            {activeLayer === 1 && (
              <div className="rise">
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--layer-ai)" }}>
                  <Sparkles className="size-3.5" /> 第 2 层 · AI 拆解结论
                </div>
                <p className="mt-4 text-lg leading-relaxed md:text-xl">{demo.ai.statement}</p>
                <div className="mt-5 rounded-xl border border-border bg-elevated p-4">
                  <div className="text-xs font-medium text-muted-foreground">拆解理由</div>
                  <p className="mt-1.5 text-sm leading-relaxed">{demo.ai.rationale}</p>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  这一层是 AI 生成的推论，<span className="text-foreground">不等于博主原话，也不等于科学结论</span>，必须经第 3 层检验。
                </p>
              </div>
            )}

            {activeLayer === 2 && (
              <div className="rise">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--layer-science)" }}>
                    <BookOpen className="size-3.5" /> 第 3 层 · 科学证据与裁决
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: VERDICT_STYLE[demo.verdict].bg, color: VERDICT_STYLE[demo.verdict].fg }}>
                    {demo.verdictLabel}
                  </span>
                </div>

                {demo.science.papers.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {demo.science.papers.map((p) => (
                      <div key={p.doi} className="rounded-xl border border-border bg-elevated p-4">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded px-2 py-0.5 text-[11px]" style={{ background: "var(--layer-science-soft)", color: "var(--layer-science)" }}>{p.relation}</span>
                          <span className="rounded px-2 py-0.5 text-[11px] text-muted-foreground">证据强度 {p.strength}</span>
                          <span className="rounded px-2 py-0.5 text-[11px] text-muted-foreground">被引 {p.cited}</span>
                        </div>
                        <p className="mt-2.5 text-sm leading-snug font-medium">{p.title}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">{p.journal} · {p.year}</p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono underline decoration-dotted underline-offset-4 hover:text-primary">
                            DOI {p.doi} <ExternalLink className="size-3" />
                          </a>
                          <a href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono underline decoration-dotted underline-offset-4 hover:text-primary">
                            PMID {p.pmid} <ExternalLink className="size-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-center">
                    <p className="text-sm text-muted-foreground">证据库中没有可直接检验该结论的研究</p>
                  </div>
                )}

                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{demo.science.reason}</p>
              </div>
            )}

            {activeLayer === 3 && (
              <div className="rise">
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--layer-advice)" }}>
                  <ShieldCheck className="size-3.5" /> 第 4 层 · 产品最终建议
                </div>
                {demo.advice.text ? (
                  <>
                    <p className="mt-4 text-lg leading-relaxed md:text-xl">{demo.advice.text}</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border bg-elevated p-4">
                        <div className="text-xs font-medium" style={{ color: "var(--tone-ok)" }}>适用人群</div>
                        <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                          {demo.advice.applies.map((x) => <li key={x}>· {x}</li>)}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-border bg-elevated p-4">
                        <div className="text-xs font-medium" style={{ color: "var(--tone-bad)" }}>不适用</div>
                        <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                          {demo.advice.notFor.map((x) => <li key={x}>· {x}</li>)}
                        </ul>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed p-6" style={{ borderColor: "color-mix(in srgb, var(--site-muted) 45%, transparent)" }}>
                    <p className="text-base font-medium">暂不给出确定建议</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      第 3 层判定为「证据不足」。产品不会把博主的个人经验包装成科学结论。
                      你可以参考原视频，但请把它当作<span className="text-foreground">经验分享</span>而非定论。
                    </p>
                  </div>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  审核状态：AI 提取 → 等待审核 → 人工确认 → 正式发布。未发布内容不会进入公开建议。
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 今日快照 ───────────────────────────── */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-xs tracking-[0.2em] text-primary uppercase">Today</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">今日快照</h2>
            </div>
            {isDemoData() && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">当前为示例数据</span>
                <Button variant="outline" size="sm" onClick={clearAll}>清空并开始记录</Button>
              </div>
            )}
          </div>

          {snapshot ? (
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="text-xs text-muted-foreground">当前阶段</div>
                <div className="mt-2 text-xl font-semibold">{snapshot.stage.stage}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{snapshot.stage.headline}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-elevated px-2.5 py-1">BMI {snapshot.stage.bmiValue}</span>
                  <span className="rounded-full bg-elevated px-2.5 py-1">{snapshot.stage.bmiLabel}</span>
                  <span className="rounded-full bg-elevated px-2.5 py-1">目标 {GOAL_LABEL[snapshot.p.goal]}</span>
                </div>
                <Button asChild variant="link" className="mt-3 h-auto p-0 text-sm">
                  <a href="#/body">查看完整评估 <ArrowUpRight className="size-3.5" /></a>
                </Button>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="text-xs text-muted-foreground">能量平衡</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-semibold tabular-nums" style={{ color: snapshot.bal.verdict === "deficit" ? "var(--tone-ok)" : snapshot.bal.verdict === "surplus" ? "var(--tone-warn)" : "var(--site-fg)" }}>
                    {snapshot.bal.net > 0 ? "+" : ""}{snapshot.bal.net}
                  </span>
                  <span className="text-sm text-muted-foreground">kcal</span>
                </div>
                <div className="mt-1 text-sm font-medium">{snapshot.bal.verdictLabel}</div>
                <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between"><dt>摄入</dt><dd className="font-mono text-foreground">{snapshot.bal.intake}</dd></div>
                  <div className="flex justify-between"><dt>训练消耗（仅参考）</dt><dd className="font-mono text-foreground">{snapshot.bal.burnExercise}</dd></div>
                  <div className="flex justify-between"><dt>目标</dt><dd className="font-mono text-foreground">{snapshot.bal.target}</dd></div>
                </dl>
                <Button asChild variant="link" className="mt-3 h-auto p-0 text-sm">
                  <a href="#/overview">查看总体评估 <ArrowUpRight className="size-3.5" /></a>
                </Button>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="text-xs text-muted-foreground">三大营养素目标</div>
                <div className="mt-3 space-y-3">
                  {[
                    { k: "蛋白质", v: snapshot.t.proteinG, a: snapshot.bal.protein, c: "var(--chart-3)" },
                    { k: "碳水", v: snapshot.t.carbG, a: snapshot.bal.carb, c: "var(--layer-advice)" },
                    { k: "脂肪", v: snapshot.t.fatG, a: snapshot.bal.fat, c: "var(--chart-4)" },
                  ].map((m) => (
                    <div key={m.k}>
                      <div className="flex justify-between text-xs">
                        <span>{m.k}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">{m.a} / {m.v} g</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (m.a / m.v) * 100)}%`, background: m.c }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-elevated px-3 py-2 text-xs">
                  碳水 ≈ 体重 × <span className="font-mono font-semibold text-primary">{snapshot.t.carbPerKg}</span> 倍
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
              <Camera className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">还没有身体数据。先做一次评估，就能得到属于你的克数。</p>
              <Button asChild className="mt-4"><a href="#/body">开始身体评估</a></Button>
            </div>
          )}
        </div>
      </section>

      {/* ── 功能入口 ───────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-14 md:py-20">
        <div className="font-mono text-xs tracking-[0.2em] text-primary uppercase">Modules</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">五个模块，一条证据链</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <a
                key={f.href}
                href={f.href}
                className="rise group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: f.color }} />
                <span className="flex size-10 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${f.color} 16%, transparent)`, color: f.color }}>
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 flex items-center gap-1.5 text-base font-semibold">
                  {f.title}
                  <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── 来源与版权 ─────────────────────────── */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="font-mono text-xs tracking-[0.2em] text-primary uppercase">Provenance</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">来源与版权</h2>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sources.bloggers.map((b) => (
              <div key={b.mid} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                <img src={b.face} alt={b.uname} className="size-14 shrink-0 rounded-full border border-border object-cover" loading="lazy" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{b.uname}</span>
                    <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground">哔哩哔哩</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{b.usign}</p>
                  <div className="mt-2 flex gap-3 font-mono text-xs text-muted-foreground">
                    <span>{(b.fans / 10000).toFixed(1)}万 粉丝</span>
                    <span>{b.videos} 稿件</span>
                  </div>
                  <a href={`https://space.bilibili.com/${b.mid}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline decoration-dotted underline-offset-4 hover:text-primary">
                    访问主页 <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            ))}
            {douyin.bloggers.map((b) => (
              <div key={b.sec_uid} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-elevated text-lg font-semibold text-muted-foreground">
                  {b.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{b.name}</span>
                    <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground">抖音</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{b.signature}</p>
                  <div className="mt-2 flex gap-3 font-mono text-xs text-muted-foreground">
                    <span>{b.followers_text} 粉丝</span>
                    <span>{b.work_count} 作品</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    已抓取 {DOUYIN_VIDEOS.length} 条公开视频的来源信息与平台章节要点
                  </p>
                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline decoration-dotted underline-offset-4 hover:text-primary">
                    访问主页 <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-elevated p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0" style={{ color: "var(--layer-science)" }} />
              <div className="text-sm leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">视频版权归作者所有。</p>
                <p className="mt-1.5">
                  本站<span className="text-foreground">不下载、不存储、不转载任何完整视频</span>，仅保存标题、作者、发布时间等来源信息，
                  并提供跳转原平台的链接。原视频页面标注「未经作者授权，禁止转载」，我们严格遵守。
                  短引用不超过 60 字，且明确标注来自标题/简介还是逐字字幕。
                </p>
                <p className="mt-2">
                  抖音的「章节要点」是<span className="text-foreground">平台自动生成的 AI 摘要，不是博主逐字原话</span>，
                  本站一律单独标注、不并入原话层。逐字字幕需登录才能获取，未获取到的一律标注「素材不足」，不猜测时间点。
                </p>
                <p className="mt-2">
                  文献信息来自 Crossref 与 Europe PMC 公开接口，DOI 与 PMID 均可点击核验。
                  食物成分为《中国食物成分表（标准版）》常见参考值，按近似值处理。
                  膳食建议依据《中国居民膳食指南（2022）》量化条款。
                </p>
                <p className="mt-2 text-xs">
                  本工具不能替代专业教练与医生。出现疼痛请停止训练并就医。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}