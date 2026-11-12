import { useEffect, useRef, useState } from "react";
import { ClipboardList, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import type { Exercise } from "@/src/lib/types";
import { AI_FALLBACK_HINT, aiProbed, aiStatus, analyzeImage, probeAi } from "@/src/lib/ai";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { AiDisclaimerBadge, MissingNote, ProductAdviceTag, VideoLink } from "./bits";

type Phase = "idle" | "running" | "ready" | "unconfigured" | "error";

export interface AnalysisResult {
  text: string | null;
  source: "ai" | "human" | null;
}

function buildManualText(exercise: Exercise, checked: number[]): string {
  const lines = checked.map((idx, i) => {
    const err = exercise.commonErrors[idx];
    return `${i + 1}. 问题：${err.error}\n   纠正：${err.fix}`;
  });
  return [
    `【手动自查 · 产品教学建议】动作：${exercise.name}（部位：${exercise.part}）。`,
    `自查勾选的问题：`,
    ...lines,
    `提示：以上为产品教学建议，非专业教练诊断；出现疼痛请停止训练并就医。`,
  ].join("\n");
}

export default function FormAnalysis({
  exercise,
  dataUrl,
  onResult,
}: {
  exercise: Exercise | null;
  dataUrl: string | null;
  onResult: (r: AnalysisResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>(() => (aiStatus() === "service_not_configured" ? "unconfigured" : "idle"));
  const [manual, setManual] = useState(() => aiStatus() === "service_not_configured");
  const [aiText, setAiText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const touchedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    if (!aiProbed()) {
      probeAi().then((s) => {
        if (!alive || touchedRef.current) return;
        if (s === "ready") {
          setPhase("idle");
          setManual(false);
        } else if (s === "service_not_configured") {
          setPhase("unconfigured");
          setManual(true);
        }
      });
    }
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setAiText(null);
    setErrorMsg(null);
    setChecked([]);
    setPhase(aiStatus() === "service_not_configured" ? "unconfigured" : "idle");
    setManual(aiStatus() === "service_not_configured");
    onResultRef.current({ text: null, source: null });
  }, [exercise?.id, dataUrl]);

  useEffect(() => {
    if (!manual || !exercise || checked.length === 0) {
      if (manual) onResultRef.current({ text: null, source: null });
      return;
    }
    onResultRef.current({ text: buildManualText(exercise, checked), source: "human" });
  }, [manual, checked, exercise]);

  const runAi = async () => {
    if (!exercise || !dataUrl) return;
    touchedRef.current = true;
    setPhase("running");
    setErrorMsg(null);
    try {
      const ctx = `动作：${exercise.name}（${exercise.nameEn}），目标部位：${exercise.part}，器械：${exercise.equipment}。请分析这张训练照片中的动作姿态。`;
      const res = await analyzeImage("form", dataUrl, ctx);
      if (res.status === "ready" && res.text) {
        setAiText(res.text);
        setPhase("ready");
        setManual(false);
        onResultRef.current({ text: res.text, source: "ai" });
      } else if (res.status === "service_not_configured") {
        setPhase("unconfigured");
        setManual(true);
        onResultRef.current({ text: null, source: null });
      } else {
        setPhase("error");
        setErrorMsg(res.text ?? "识别服务返回异常，请稍后重试。");
        setManual(true);
      }
    } catch (e) {
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : "网络或服务异常，请稍后重试。");
      setManual(true);
    }
  };

  const toggleError = (idx: number, on: boolean) => {
    touchedRef.current = true;
    setChecked((prev) => (on ? [...prev, idx] : prev.filter((i) => i !== idx)));
  };

  const showManual = manual || phase === "unconfigured" || phase === "error";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="size-4 text-ai" />
          动作分析
        </h4>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-7 text-xs", !showManual && "bg-ai/10")}
            onClick={() => {
              touchedRef.current = true;
              setManual(false);
              if (phase === "ready" && aiText) onResultRef.current({ text: aiText, source: "ai" });
              else onResultRef.current({ text: null, source: null });
            }}
            disabled={phase === "running" || phase === "unconfigured"}
          >
            AI 分析
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-7 text-xs", showManual && "bg-science/10")}
            onClick={() => {
              touchedRef.current = true;
              setManual(true);
            }}
          >
            手动自查
          </Button>
        </div>
      </div>

      {phase === "unconfigured" && (
        <Alert className="border-warn/40 bg-warn/10">
          <TriangleAlert className="text-warn" />
          <AlertTitle>AI 图像识别未配置</AlertTitle>
          <AlertDescription>
            {AI_FALLBACK_HINT.form}
            本工具不会生成任何虚构的识别结果。
          </AlertDescription>
        </Alert>
      )}

      {!showManual && phase === "idle" && (
        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          {dataUrl
            ? "照片已就绪，点击「开始 AI 分析」。分析结果仅供参考，不能替代专业教练。"
            : "上传照片后可进行 AI 分析；也可以随时切换到「手动自查」，不需要照片。"}
          {dataUrl && exercise && (
            <Button type="button" size="sm" className="mt-2 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={runAi}>
              <Sparkles className="size-3.5" />
              开始 AI 分析
            </Button>
          )}
        </div>
      )}

      {phase === "running" && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4 text-ai" />
            正在分析照片，请稍候…
          </p>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      )}

      {phase === "ready" && aiText && !showManual && (
        <div className="rounded-lg border border-ai/30 bg-ai-soft p-3">
          <AiDisclaimerBadge />
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{aiText}</p>
          <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={runAi}>
            <RefreshCw className="size-3.5" />
            重新分析
          </Button>
        </div>
      )}

      {phase === "error" && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>AI 分析失败</AlertTitle>
          <AlertDescription>
            {errorMsg ?? "服务异常。"}你可以重试，或使用下方手动自查完成同样的纠错流程。
            <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={runAi} disabled={!dataUrl || !exercise}>
              <RefreshCw className="size-3.5" />
              重试
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showManual && (
        <div className="rounded-lg border border-science/30 bg-science-soft p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h5 className="flex items-center gap-1.5 text-sm font-medium">
              <ClipboardList className="size-4 text-science" />
              手动自查清单
            </h5>
            <ProductAdviceTag />
          </div>
          {!exercise ? (
            <MissingNote>请先在上方选择一个动作，才能加载对应的常见错误清单。</MissingNote>
          ) : exercise.commonErrors.length === 0 ? (
            <div className="flex flex-col gap-2">
              <MissingNote>该动作暂无常见错误清单（素材不足）。可先查看动作资料中的关联视频（是否精确匹配见动作详情），并对着镜子或录像自查。</MissingNote>
              <VideoLink bvid={exercise.videoBvid} />
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                对照镜子或照片，勾选你在「{exercise.name}」中存在的问题（可多选）。勾选后会给出对应的纠正方法。
              </p>
              <ul className="flex flex-col gap-2">
                {exercise.commonErrors.map((err, i) => {
                  const on = checked.includes(i);
                  return (
                    <li key={i} className={cn("rounded-lg border bg-card p-2.5 transition-colors", on ? "border-science/50" : "border-border")}>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id={`form-err-${exercise.id}-${i}`}
                          checked={on}
                          onCheckedChange={(v) => toggleError(i, v === true)}
                          className="mt-0.5"
                        />
                        <Label htmlFor={`form-err-${exercise.id}-${i}`} className="text-sm font-normal leading-snug">
                          {err.error}
                        </Label>
                      </div>
                      {on && (
                        <div className="mt-2 flex flex-col gap-1 border-l-2 border-science/50 pl-3 text-xs">
                          <span className="text-destructive">风险：{err.risk}</span>
                          <span className="leading-relaxed">
                            <Badge variant="outline" className="mr-1 border-science/40 bg-science/10 text-foreground">纠正</Badge>
                            {err.fix}
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {checked.length > 0 && (
                <div className="mt-3 rounded-lg border border-advice/40 bg-advice-soft p-3">
                  <p className="text-sm font-medium">已勾选 {checked.length} 项，纠正方案如上（产品教学建议）。</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    保存照片时，这份自查记录会以「手动自查」来源一并存入时间轴，不会冒充 AI 结果。
                  </p>
                  <div className="mt-2">
                    <VideoLink bvid={exercise.videoBvid} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}