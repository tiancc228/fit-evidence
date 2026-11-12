import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Check, Clock, ExternalLink, FileText, Info, ListVideo, Plus, Quote, TriangleAlert, Users, Video,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { lookupEvidence, fetchVideoMeta, autoFillPatch, SUBTITLE_LABEL, MANUAL_FALLBACK } from "@/src/lib/evidence";
import { ManualBadge, ProviderBadge, RemoteNotice } from "@/src/components/kb/MetaNotice";
import { fmtDateTime, fmtDuration, fmtUnixDate, stripHtml } from "@/src/components/kb/meta";
import {
  biliUrl, doiUrl, douyinUrl, parseAwemeId, parseBvid, parseDoi, parsePmid, pmidUrl,
  type PendingPaper, type PendingVideo,
} from "@/src/components/kb/sources";
import { useRemoteMeta, currentRemoteState } from "@/src/components/kb/useRemoteMeta";

type VideoTarget = { platform: "bilibili" | "douyin"; id: string; url: string };
type PaperTarget = { doi: string | null; pmid: string | null; url: string };

/** B 站 BV 号优先，其次抖音 aweme_id；都不匹配就返回 null，不猜平台。 */
function parseVideoInput(input: string): VideoTarget | null {
  const bvid = parseBvid(input);
  if (bvid) return { platform: "bilibili", id: bvid, url: biliUrl(bvid) };
  const aweme = parseAwemeId(input);
  if (aweme) return { platform: "douyin", id: aweme, url: douyinUrl(aweme) };
  return null;
}

/** DOI 优先（走 Crossref），否则 PMID（走 Europe PMC）。 */
function parsePaperInput(input: string): PaperTarget | null {
  const doi = parseDoi(input);
  if (doi) return { doi, pmid: parsePmid(input), url: doiUrl(doi) };
  const pmid = parsePmid(input);
  if (pmid) return { doi: null, pmid, url: pmidUrl(pmid) };
  return null;
}

const videoSchema = z.object({
  url: z.string().min(1, "请粘贴视频链接，或 BV 号 / 抖音 aweme_id")
    .refine((v) => parseVideoInput(v) != null, "未识别到 BV 号（BV + 10 位）或抖音 aweme_id（15–25 位数字）"),
  title: z.string(),
  author: z.string(),
});

const paperSchema = z.object({
  url: z.string().min(1, "请粘贴 DOI、PMID，或 doi.org / pubmed 链接")
    .refine((v) => parsePaperInput(v) != null, "未识别到 DOI（10.xxxx/…）或 PMID（1–8 位数字）"),
  title: z.string(),
  authors: z.string(),
  journal: z.string(),
  year: z.string(),
  abstract: z.string(),
});

type VideoValues = z.infer<typeof videoSchema>;
type PaperValues = z.infer<typeof paperSchema>;
const PAPER_TEXT_FIELDS = ["title", "authors", "journal", "year", "abstract"] as const;
const VIDEO_TEXT_FIELDS = ["title", "author"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knownBvids: string[];
  knownAwemeIds: string[];
  knownDois: string[];
  knownPmids: string[];
  onAddVideo: (v: Omit<PendingVideo, "id" | "addedAt">) => void;
  onAddPaper: (p: Omit<PendingPaper, "id" | "addedAt">) => void;
}

export function AddSourceDialog({
  open, onOpenChange, knownBvids, knownAwemeIds, knownDois, knownPmids, onAddVideo, onAddPaper,
}: Props) {
  const [tab, setTab] = useState<"video" | "paper">("video");

  const videoForm = useForm<VideoValues>({
    resolver: zodResolver(videoSchema),
    defaultValues: { url: "", title: "", author: "" },
  });
  const paperForm = useForm<PaperValues>({
    resolver: zodResolver(paperSchema),
    defaultValues: { url: "", title: "", authors: "", journal: "", year: "", abstract: "" },
  });

  const videoUrl = videoForm.watch("url");
  const paperUrl = paperForm.watch("url");
  const videoTarget = parseVideoInput(videoUrl);
  const paperTarget = parsePaperInput(paperUrl);
  const videoKey = videoTarget?.url ?? null;
  const paperKey = paperTarget ? (paperTarget.doi ?? paperTarget.pmid) : null;

  const videoDup = videoTarget != null
    && (videoTarget.platform === "bilibili" ? knownBvids : knownAwemeIds).includes(videoTarget.id);
  const paperDup = paperTarget != null
    && ((paperTarget.doi != null && knownDois.includes(paperTarget.doi))
      || (paperTarget.pmid != null && knownPmids.includes(paperTarget.pmid)));

  const videoRemote = useRemoteMeta(videoKey, fetchVideoMeta);
  const paperRemoteKey = paperTarget ? (paperTarget.doi ? `doi:${paperTarget.doi}` : `pmid:${paperTarget.pmid}`) : null;
  const paperRemote = useRemoteMeta(
    paperRemoteKey,
    (key) => key.startsWith("doi:") ? lookupEvidence({ doi: key.slice(4) }) : lookupEvidence({ pmid: key.slice(5) }),
  );

  useEffect(() => {
    if (open) {
      videoForm.reset();
      paperForm.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const appliedVideo = useRef<string | null>(null);
  const appliedPaper = useRef<string | null>(null);

  // 换编号时清掉上一条自动填进来的值；人工改过的字段保留。
  useEffect(() => {
    appliedVideo.current = null;
    const patch = autoFillPatch({ title: "", author: "" }, videoForm.formState.dirtyFields);
    for (const f of VIDEO_TEXT_FIELDS) {
      const v = patch[f];
      if (v != null) videoForm.setValue(f, v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoKey]);

  useEffect(() => {
    appliedPaper.current = null;
    const patch = autoFillPatch({ title: "", authors: "", journal: "", year: "", abstract: "" }, paperForm.formState.dirtyFields);
    for (const f of PAPER_TEXT_FIELDS) {
      const v = patch[f];
      if (v != null) paperForm.setValue(f, v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperKey]);

  // 只写入接口真实返回的字段，绝不覆盖人工已改过的内容。
  // state.key 必须等于当前编号：换编号那一次 render 里 state 还是上一条的结果，
  // 少了这道守卫就会把上一篇文献串到新编号下面。
  useEffect(() => {
    if (videoRemote.state.status !== "ok" || videoKey == null) return;
    if (videoRemote.state.key !== videoKey || appliedVideo.current === videoKey) return;
    appliedVideo.current = videoKey;
    const s = videoRemote.state.data;
    const patch = autoFillPatch({ title: s.title ?? "", author: s.author ?? "" }, videoForm.formState.dirtyFields);
    for (const f of VIDEO_TEXT_FIELDS) {
      const v = patch[f];
      if (v != null) videoForm.setValue(f, v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRemote.state, videoKey]);

  useEffect(() => {
    if (paperRemote.state.status !== "ok" || paperRemoteKey == null) return;
    if (paperRemote.state.key !== paperRemoteKey || appliedPaper.current === paperRemoteKey) return;
    appliedPaper.current = paperRemoteKey;
    const r = paperRemote.state.data;
    const patch = autoFillPatch({
      title: r.title,
      authors: r.authors.join(", "),
      journal: r.journal ?? "",
      year: r.year != null ? String(r.year) : "",
      abstract: r.abstract ? stripHtml(r.abstract) : "",
    }, paperForm.formState.dirtyFields);
    for (const f of PAPER_TEXT_FIELDS) {
      const v = patch[f];
      if (v != null) paperForm.setValue(f, v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperRemote.state, paperRemoteKey]);

  // 界面与提交都只认「属于当前编号」的结果，旧编号的元数据一律不参与。
  const videoState = currentRemoteState(videoRemote.state, videoKey);
  const paperState = currentRemoteState(paperRemote.state, paperRemoteKey);
  const videoMeta = videoState.status === "ok" ? videoState.data : null;
  const paperMeta = paperState.status === "ok" ? paperState.data : null;
  const videoDirty = videoForm.formState.dirtyFields;
  const paperDirty = paperForm.formState.dirtyFields;
  const videoEdited = Boolean(videoDirty.title || videoDirty.author);
  const paperEdited = PAPER_TEXT_FIELDS.some((f) => paperDirty[f]);
  const videoSettled = videoState.status !== "loading" && videoState.status !== "idle";
  const paperSettled = paperState.status !== "loading" && paperState.status !== "idle";

  function submitVideo(values: VideoValues) {
    const target = parseVideoInput(values.url);
    if (!target) return;
    if ((target.platform === "bilibili" ? knownBvids : knownAwemeIds).includes(target.id)) {
      videoForm.setError("url", { message: "该视频已在来源库或待审核列表中" });
      return;
    }
    const auto = videoMeta != null;
    onAddVideo({
      url: target.url,
      platform: target.platform,
      bvid: target.platform === "bilibili" ? target.id : null,
      awemeId: target.platform === "douyin" ? target.id : null,
      title: values.title.trim() || null,
      author: values.author.trim() || null,
      durationSec: videoMeta?.duration ?? null,
      pubdate: videoMeta?.pubdate ?? null,
      description: videoMeta?.description ?? null,
      chapters: videoMeta?.chapters ?? [],
      subtitleStatus: videoMeta?.subtitleStatus ?? null,
      provider: auto ? videoMeta.platform : null,
      metaSource: auto ? "auto" : "manual",
      edited: auto ? videoEdited : undefined,
      retrievedAt: videoState.status === "ok" ? videoState.at : null,
    });
    toast.success("已加入待审核视频来源", {
      description: auto
        ? `${target.id} · 元信息由接口自动获取，待人工核对后才会进入公开知识库`
        : `${target.id} · 元信息未自动获取，需人工核对补全`,
    });
    onOpenChange(false);
  }

  function submitPaper(values: PaperValues) {
    const target = parsePaperInput(values.url);
    if (!target) return;
    if ((target.doi != null && knownDois.includes(target.doi)) || (target.pmid != null && knownPmids.includes(target.pmid))) {
      paperForm.setError("url", { message: "该 DOI / PMID 已在文献库或待审核列表中" });
      return;
    }
    const auto = paperMeta != null;
    const year = Number.parseInt(values.year.trim(), 10);
    onAddPaper({
      url: target.url,
      doi: target.doi ?? paperMeta?.doi ?? null,
      pmid: target.pmid ?? paperMeta?.pmid ?? null,
      title: values.title.trim() || null,
      authors: values.authors.split(",").map((a) => a.trim()).filter(Boolean),
      journal: values.journal.trim() || null,
      year: Number.isFinite(year) ? year : null,
      abstract: values.abstract.trim() || null,
      citedBy: paperMeta?.citedBy ?? null,
      provider: auto ? paperMeta.provider : null,
      metaSource: auto ? "auto" : "manual",
      edited: auto ? paperEdited : undefined,
      retrievedAt: paperState.status === "ok" ? paperState.at : null,
    });
    toast.success("已加入待审核文献", {
      description: auto
        ? `${target.doi ?? `PMID ${target.pmid}`} · 元数据自动获取，待人工核对后才会进入公开知识库`
        : `${target.doi ?? `PMID ${target.pmid}`} · 元数据未自动获取，需人工从官方来源核对补全`,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>添加来源</DialogTitle>
          <DialogDescription>
            粘贴编号即自动向官方接口取真实元数据（DOI → Crossref，PMID → Europe PMC，视频 → B 站 / 抖音公开信息）。
            自动获取的内容一律标注来源与「待人工核对」；查不到就如实说未查到，绝不编造。新增来源需人工审核后才进入公开知识库。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "video" | "paper")}>
          <TabsList className="w-full">
            <TabsTrigger value="video" className="gap-1.5">
              <Video className="size-4" />
              视频来源
            </TabsTrigger>
            <TabsTrigger value="paper" className="gap-1.5">
              <FileText className="size-4" />
              文献
            </TabsTrigger>
          </TabsList>

          <TabsContent value="video" className="mt-4">
            <form onSubmit={videoForm.handleSubmit(submitVideo)} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="src-video-url">B 站 / 抖音视频链接（或 BV 号 / aweme_id）</Label>
                <Input
                  id="src-video-url"
                  placeholder="https://www.bilibili.com/video/BV… / https://www.douyin.com/video/… / BV号 / aweme_id"
                  {...videoForm.register("url")}
                />
                {videoForm.formState.errors.url && (
                  <p className="text-xs text-bad">{videoForm.formState.errors.url.message}</p>
                )}
                {videoUrl.trim() !== "" && (
                  videoTarget ? (
                    <p className="flex flex-wrap items-center gap-1.5 rounded-md border border-ok/40 bg-ok/10 px-2.5 py-1.5 text-xs text-ok">
                      <Check className="size-3.5" />
                      解析成功：{videoTarget.platform === "bilibili" ? "哔哩哔哩" : "抖音"}
                      <span className="font-mono">{videoTarget.id}</span>
                      <a href={videoTarget.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
                        {videoTarget.url}
                        <ExternalLink className="size-3" />
                      </a>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 rounded-md border border-bad/40 bg-bad/10 px-2.5 py-1.5 text-xs text-bad">
                      <TriangleAlert className="size-3.5" />
                      未识别到 BV 号或抖音 aweme_id，请检查链接是否完整
                    </p>
                  )
                )}
                {videoDup && <p className="text-xs text-warn">该视频已在来源库或待审核列表中，无需重复添加。</p>}
              </div>

              <RemoteNotice state={videoState} onRetry={videoRemote.retry} subject="视频元信息" />

              {videoMeta && (
                <div className="grid gap-2 rounded-lg border border-science/30 bg-science-soft/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ProviderBadge provider={videoMeta.platform} />
                    {videoEdited && <Badge variant="outline" className="border-warn/40 bg-warn/10 text-warn">已人工修订</Badge>}
                    {videoState.status === "ok" && (
                      <span className="text-[11px] text-muted-foreground">获取于 {fmtDateTime(videoState.at)}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      时长 {videoMeta.duration != null ? fmtDuration(videoMeta.duration) : "未获取"}
                    </span>
                    <span>发布时间 {videoMeta.pubdate != null ? fmtUnixDate(videoMeta.pubdate) : "未获取"}</span>
                    <span className="inline-flex items-center gap-1">
                      <ListVideo className="size-3" />
                      {videoMeta.platform === "bilibili" ? "分P / 章节" : "章节"} {videoMeta.chapters?.length ?? 0} 个
                      {(videoMeta.chapters?.length ?? 0) === 0 && "（接口未返回，不推算）"}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    逐字字幕：{videoMeta.subtitleStatus ? SUBTITLE_LABEL[videoMeta.subtitleStatus] ?? videoMeta.subtitleStatus : "接口未返回字幕状态"}
                    。本站不伪造时间戳，只登记接口真实返回的起始时间点。
                  </p>
                  {videoMeta.description ? (
                    <p className="line-clamp-3 rounded-md bg-background/60 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
                      <Quote className="mr-1 inline size-3" />
                      博主本人撰写的简介：{videoMeta.description}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">简介未获取（素材不足），不补写内容。</p>
                  )}
                  {videoMeta.note && <p className="text-xs text-warn">{videoMeta.note}</p>}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="src-video-title">标题（可人工修改）</Label>
                  <Input id="src-video-title" placeholder="自动获取失败时手动填写" {...videoForm.register("title")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="src-video-author">博主 / UP 主（可人工修改）</Label>
                  <Input id="src-video-author" placeholder="自动获取失败时手动填写" {...videoForm.register("author")} />
                </div>
              </div>
              {!videoMeta && videoTarget && videoSettled && <ManualBadge className="w-fit" />}

              <Alert>
                <Info />
                <AlertDescription>
                  本站不抓取、不存储、不转载视频内容，仅登记来源信息并提供原平台跳转。
                  自动获取只读取公开元信息（标题、UP 主、时长、分P），逐字字幕需登录未获取，不会伪造时间戳。
                  {MANUAL_FALLBACK}
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button type="submit" disabled={!videoTarget || videoDup}>
                  <Plus className="size-4" />
                  加入待审核列表
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="paper" className="mt-4">
            <form onSubmit={paperForm.handleSubmit(submitPaper)} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="src-paper-doi">DOI 或 PMID（支持 doi.org / pubmed 链接）</Label>
                <Input
                  id="src-paper-doi"
                  placeholder="10.1136/bjsports-2017-097608 / https://doi.org/… / 28698288 / PMID: 28698288"
                  {...paperForm.register("url")}
                />
                {paperForm.formState.errors.url && (
                  <p className="text-xs text-bad">{paperForm.formState.errors.url.message}</p>
                )}
                {paperUrl.trim() !== "" && (
                  paperTarget ? (
                    <div className="grid gap-1.5 rounded-md border border-ok/40 bg-ok/10 px-2.5 py-1.5 text-xs text-ok">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <Check className="size-3.5" />
                        解析成功：
                        <span className="font-mono">{paperTarget.doi ?? `PMID ${paperTarget.pmid}`}</span>
                        <span className="text-muted-foreground">
                          {paperTarget.doi ? "→ Crossref（DOI 登记机构）" : "→ Europe PMC（PubMed 摘要库）"}
                        </span>
                      </p>
                      <p className="flex flex-wrap items-center gap-2">
                        <a href={paperTarget.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
                          {paperTarget.url}
                          <ExternalLink className="size-3" />
                        </a>
                        {paperTarget.doi && paperTarget.pmid && (
                          <a href={pmidUrl(paperTarget.pmid)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
                            PubMed 直达
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="flex items-center gap-1.5 rounded-md border border-bad/40 bg-bad/10 px-2.5 py-1.5 text-xs text-bad">
                      <TriangleAlert className="size-3.5" />
                      未识别到 DOI（10.xxxx/…）或 PMID（1–8 位数字）
                    </p>
                  )
                )}
                {paperDup && <p className="text-xs text-warn">该 DOI / PMID 已在文献库或待审核列表中，无需重复添加。</p>}
              </div>

              <RemoteNotice state={paperState} onRetry={paperRemote.retry} subject="文献元数据" />

              {paperMeta && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-science/30 bg-science-soft/50 p-3">
                  <ProviderBadge provider={paperMeta.provider} />
                  {paperMeta.doi && <Badge variant="outline" className="font-mono text-science">DOI {paperMeta.doi}</Badge>}
                  {paperMeta.pmid && <Badge variant="outline" className="font-mono text-science">PMID {paperMeta.pmid}</Badge>}
                  <Badge variant="secondary">被引 {paperMeta.citedBy ?? "未获取"}</Badge>
                  {paperMeta.pubType.slice(0, 2).map((t) => (
                    <Badge key={t} variant="outline" className="text-muted-foreground">{t}</Badge>
                  ))}
                  {paperEdited && <Badge variant="outline" className="border-warn/40 bg-warn/10 text-warn">已人工修订</Badge>}
                  {paperState.status === "ok" && (
                    <span className="text-[11px] text-muted-foreground">获取于 {fmtDateTime(paperState.at)}</span>
                  )}
                  {paperMeta.url && (
                    <a href={paperMeta.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-info hover:underline">
                      <ExternalLink className="size-3" />
                      原文链接
                    </a>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="src-paper-title">标题（可人工修改）</Label>
                <Input id="src-paper-title" placeholder="自动获取失败时手动填写" {...paperForm.register("title")} />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <div className="grid gap-2">
                  <Label htmlFor="src-paper-journal">期刊（可人工修改）</Label>
                  <Input id="src-paper-journal" placeholder="自动获取失败时手动填写" {...paperForm.register("journal")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="src-paper-year">年份</Label>
                  <Input id="src-paper-year" inputMode="numeric" placeholder="如 2018" {...paperForm.register("year")} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="src-paper-authors" className="gap-1.5">
                  <Users className="size-3.5" />
                  作者（逗号分隔，可人工修改）
                </Label>
                <Textarea id="src-paper-authors" rows={2} placeholder="自动获取失败时手动填写" {...paperForm.register("authors")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="src-paper-abstract">摘要（英文原文，可人工修改）</Label>
                <Textarea id="src-paper-abstract" rows={4} placeholder="接口未返回摘要时留空，不补写、不翻译编造" {...paperForm.register("abstract")} />
              </div>
              {!paperMeta && paperTarget && paperSettled && <ManualBadge className="w-fit" />}

              <Alert>
                <Info />
                <AlertDescription>
                  元数据由后端实时向 Crossref（DOI）或 Europe PMC（PMID）获取并自动填入上方表单，请人工核对后再审核通过；
                  接口只返回真实字段，缺失项留空并标注未获取，本站不会自动生成或编造标题、作者、期刊与摘要。{MANUAL_FALLBACK}
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button type="submit" disabled={!paperTarget || paperDup}>
                  <Plus className="size-4" />
                  加入待审核列表
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}