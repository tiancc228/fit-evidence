import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EVIDENCE, TOPICS } from "@/src/data/knowledge";
import { EvidenceItem } from "@/src/components/kb/EvidenceItem";
import { topicLabel } from "@/src/components/kb/meta";

type EvidenceSort = "year-desc" | "year-asc" | "cited-desc" | "title";

interface Props {
  /** 抽屉里默认只显示与当前结论同主题的文献 */
  initialTopic?: string;
  note?: string;
}

/** 文献库：搜索 / 主题 / 排序 / 计数 / 全字段卡片，整体来自原知识库页。 */
export function EvidenceLibrary({ initialTopic = "all", note }: Props) {
  const [evQ, setEvQ] = useState("");
  const [evTopic, setEvTopic] = useState(initialTopic);
  const [evSort, setEvSort] = useState<EvidenceSort>("year-desc");

  const evTopics = useMemo(() => Array.from(new Set(EVIDENCE.map((e) => e.topic).filter((t): t is string => !!t))), []);
  const doiCount = EVIDENCE.filter((e) => e.doi).length;
  const pmidCount = EVIDENCE.filter((e) => e.pmid).length;

  const filteredEvidence = useMemo(() => {
    const kw = evQ.trim().toLowerCase();
    const list = EVIDENCE.filter((e) => {
      if (evTopic !== "all" && e.topic !== evTopic) return false;
      if (kw) {
        const hay = [e.title, e.authors.join(" "), e.journal ?? "", e.doi ?? "", e.pmid ?? "", e.supports ?? ""].join(" ").toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
    const sorted = [...list];
    switch (evSort) {
      case "year-desc": sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)); break;
      case "year-asc": sorted.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)); break;
      case "cited-desc": sorted.sort((a, b) => (b.citedBy ?? -1) - (a.citedBy ?? -1)); break;
      case "title": sorted.sort((a, b) => a.title.localeCompare(b.title)); break;
    }
    return sorted;
  }, [evQ, evTopic, evSort]);

  return (
    <div className="grid gap-4">
      {note && <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>}

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={evQ} onChange={(e) => setEvQ(e.target.value)} placeholder="搜索标题、作者、期刊、DOI…" className="pl-9" aria-label="搜索文献" />
          </div>
          <div className="[&>div]:w-full">
            <NativeSelect value={evTopic} onChange={(e) => setEvTopic(e.target.value)} className="w-full" aria-label="按主题筛选文献">
              <NativeSelectOption value="all">全部主题</NativeSelectOption>
              {evTopics.map((t) => (
                <NativeSelectOption key={t} value={t}>{topicLabel(t, TOPICS)}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="[&>div]:w-full">
            <NativeSelect value={evSort} onChange={(e) => setEvSort(e.target.value as EvidenceSort)} className="w-full" aria-label="文献排序">
              <NativeSelectOption value="year-desc">年份 · 新到旧</NativeSelectOption>
              <NativeSelectOption value="year-asc">年份 · 旧到新</NativeSelectOption>
              <NativeSelectOption value="cited-desc">被引数 · 高到低</NativeSelectOption>
              <NativeSelectOption value="title">标题 · A→Z</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          共 {EVIDENCE.length} 篇真实文献 · {doiCount} 个 DOI · {pmidCount} 个 PMID · 当前显示 {filteredEvidence.length} 篇
        </p>
      </Card>

      {filteredEvidence.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
            <EmptyTitle>没有匹配的文献</EmptyTitle>
            <EmptyDescription>换个关键词或主题试试。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredEvidence.map((e, i) => (
            <EvidenceItem key={e.doi ?? e.pmid ?? `${e.title}-${i}`} item={e} topics={TOPICS} />
          ))}
        </div>
      )}
    </div>
  );
}
