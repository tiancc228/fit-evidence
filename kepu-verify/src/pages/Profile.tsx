import { BookOpen, ShieldCheck, Sparkles } from "lucide-react";
import Body from "@/src/pages/Body";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/src/lib/admin";
import { aiStatus, AI_STATUS_LABEL } from "@/src/lib/ai";

/**
 * 「我的」：身体档案与身体数据是主体，管理开关和服务状态放在后面。
 * 普通用户在这里看不到任何审核概念，只有开启管理后才出现入口。
 */
export default function Profile() {
  const [admin, toggleAdmin] = useAdmin();
  const ai = aiStatus();

  return (
    <>
      <Body />

      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-10 md:px-6">
        <Card>
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">AI 分析服务</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{AI_STATUS_LABEL[ai]}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground sm:text-right">
              未配置时，拍照识别会退回手动录入，不影响记录。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">内容管理</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  开启后，导航里才会出现「知识库」与「审核台」。普通用户不应看到这两个入口。
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant={admin ? "default" : "outline"} size="sm" onClick={() => toggleAdmin(!admin)}>
                {admin ? "关闭管理" : "开启管理"}
              </Button>
              {admin && (
                <Button asChild variant="ghost" size="sm">
                  <a href="#/review">去审核台</a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {admin && (
          <Card>
            <CardContent className="flex flex-col gap-2 py-5 text-xs text-muted-foreground">
              <a href="#/knowledge" className="inline-flex items-center gap-1.5 hover:text-primary">
                <BookOpen className="size-3.5" /> 打开知识库（来源、观点、待审核）
              </a>
              <p>待审核内容不会出现在普通用户的「为什么这样建议」里。</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
