import { Info } from "lucide-react";

/**
 * 事实性出处说明：知识库页面与证据抽屉共用同一份文案，
 * 避免两处说法不一致，也避免为了抽屉好看而改写事实性表述。
 */
export function SourcePolicyNote() {
  return (
    <footer className="flex items-start gap-2 rounded-lg border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>
        所有视频与文献均来自真实抓取的来源数据（B 站与抖音公开视频信息 + 公开学术数据库），本站不编造账号、标题、论文、DOI 或 PMID。
        拿不到的数据一律标注「素材不足」并说明原因。四层内容（博主原话 / AI 拆解 / 科学证据 / 产品建议）永远分开呈现，不合并、不混同；
        抖音的章节与整体摘要属平台自动生成的 AI 内容，单独标注，不冒充博主逐字原话。
      </p>
    </footer>
  );
}
