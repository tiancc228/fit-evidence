import { useState } from "react";
import { BookOpen, ExternalLink, FileText, Tag, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { EvidenceRef } from "@/src/lib/types";
import { RelationBadge, StrengthBadge } from "@/src/components/kb/badges";
import { stripHtml, topicLabel } from "@/src/components/kb/meta";
import { doiUrl, pmidUrl } from "@/src/components/kb/sources";

interface Props {
  item: EvidenceRef;
  relation?: "supports" | "refutes" | "partial" | "context";
  strength?: "high" | "medium" | "low";
  note?: string;
  topics?: { id: string; label: string }[];
  className?: string;
}

export function EvidenceItem({ item, relation, strength, note, topics = [], className }: Props) {
  const [open, setOpen] = useState(false);
  const authors = item.authors.length > 0 ? item.authors : null;
  const shownAuthors = authors ? (authors.length > 3 ? `${authors.slice(0, 3).join(", ")} 等 ${authors.length} 人` : authors.join(", ")) : null;
  const abstract = item.abstract ? stripHtml(item.abstract) : null;

  return (
    <article className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {relation && <RelationBadge relation={relation} />}
        {strength && <StrengthBadge strength={strength} />}
        {item.topic && (
          <Badge variant="secondary" className="gap-1">
            <Tag className="size-3" />
            {topicLabel(item.topic, topics)}
          </Badge>
        )}
        {item.pubType?.slice(0, 2).map((t) => (
          <Badge key={t} variant="outline" className="text-muted-foreground">
            {t}
          </Badge>
        ))}
      </div>

      <h4 className="mt-2 text-sm leading-snug font-medium">{stripHtml(item.title)}</h4>

      <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
        <p className="flex items-start gap-1.5">
          <Users className="mt-0.5 size-3.5 shrink-0" />
          <span title={authors?.join(", ")}>{shownAuthors ?? "作者未获取"}</span>
        </p>
        <p className="flex items-start gap-1.5">
          <BookOpen className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {item.journal ?? "期刊未获取"}
            {item.year != null ? ` · ${item.year}` : " · 年份未获取"}
            {item.citedBy != null ? ` · 被引 ${item.citedBy}` : " · 被引数未获取"}
            {` · 来源 ${item.provider}`}
          </span>
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.doi ? (
          <a
            href={doiUrl(item.doi)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-info/40 bg-info/10 px-2 py-1 font-mono text-xs text-info hover:underline"
          >
            <ExternalLink className="size-3" />
            DOI: {item.doi}
          </a>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">无 DOI</Badge>
        )}
        {item.pmid ? (
          <a
            href={pmidUrl(item.pmid)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-science/40 bg-science-soft px-2 py-1 font-mono text-xs text-science hover:underline"
          >
            <ExternalLink className="size-3" />
            PMID: {item.pmid}
          </a>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">无 PMID</Badge>
        )}
        {item.url && !item.doi && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-info hover:underline"
          >
            <ExternalLink className="size-3" />
            原文链接
          </a>
        )}
      </div>

      {item.supports && (
        <p className="mt-3 rounded-md bg-science-soft px-3 py-2 text-xs leading-relaxed text-science">
          关联结论：{item.supports}
        </p>
      )}
      {note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">证据备注：{note}</p>}

      {abstract ? (
        <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="xs" className="text-muted-foreground">
              <FileText className="size-3" />
              {open ? "收起摘要（英文原文）" : "展开摘要（英文原文）"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-2 max-h-64 overflow-y-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              {abstract}
            </p>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">摘要未获取</p>
      )}
    </article>
  );
}