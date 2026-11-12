import { useEffect, useState } from "react";
import {
  Activity, BookOpen, Flame, Layers, Menu, ShieldCheck,
  Target, User, UtensilsCrossed, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/src/lib/store";
import { probeAi, aiStatus, AI_STATUS_LABEL } from "@/src/lib/ai";
import { useAdmin } from "@/src/lib/admin";
import { EvidenceDrawer } from "@/src/components/kb/EvidenceDrawer";
import Home from "@/src/pages/Home";
import Overview from "@/src/pages/Overview";
import Plan from "@/src/pages/Plan";
import Form from "@/src/pages/Form";
import Diet from "@/src/pages/Diet";
import Profile from "@/src/pages/Profile";
import Knowledge from "@/src/pages/Knowledge";
import Review from "@/src/pages/Review";

/** 普通用户只看这五个入口。身体评估已并入「我的」。 */
const USER_NAV = [
  { hash: "#/overview", label: "今日", icon: Flame, element: Overview },
  { hash: "#/plan", label: "训练", icon: Target, element: Plan },
  { hash: "#/diet", label: "饮食", icon: UtensilsCrossed, element: Diet },
  { hash: "#/form", label: "分析", icon: Activity, element: Form },
  { hash: "#/profile", label: "我的", icon: User, element: Profile },
] as const;

/** 只有开启管理模式后才出现在导航里。 */
const ADMIN_NAV = [
  { hash: "#/knowledge", label: "知识库", icon: BookOpen, element: Knowledge },
  { hash: "#/review", label: "审核台", icon: ShieldCheck, element: Review },
] as const;

const HOME = { hash: "#/", label: "首页", icon: Layers, element: Home } as const;

/** 旧地址不能 404。 */
const REDIRECTS: Record<string, string> = { "#/body": "#/profile" };

function useHashRoute() {
  const read = () => (typeof location === "undefined" ? "#/" : location.hash || "#/");
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const on = () => setHash(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export default function App() {
  const rawHash = useHashRoute();
  const hash = REDIRECTS[rawHash] ?? rawHash;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ai, setAi] = useState(aiStatus());
  const [admin] = useAdmin();
  const [why, setWhy] = useState<{ id: string; open: boolean }>({ id: "", open: false });
  const { state } = useApp();

  // 「为什么这样建议」的全局兜底入口：页面没传 onOpenEvidence 时通过事件打开。
  useEffect(() => {
    const on = (e: Event) => {
      const ce = e as CustomEvent<{ id?: string; handled?: boolean }>;
      if (!ce.detail?.id) return;
      ce.detail.handled = true;
      setWhy({ id: ce.detail.id, open: true });
    };
    window.addEventListener("kepu:diet:open-evidence", on);
    return () => window.removeEventListener("kepu:diet:open-evidence", on);
  }, []);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    probeAi().then(setAi);
  }, []);

  useEffect(() => {
    if (REDIRECTS[rawHash]) location.replace(REDIRECTS[rawHash]);
  }, [rawHash]);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [hash]);

  const navItems = admin ? [...USER_NAV, ...ADMIN_NAV] : [...USER_NAV];
  const all = [HOME, ...USER_NAV, ...ADMIN_NAV];
  const route = all.find((n) => n.hash === hash) ?? HOME;
  const Page = route.element;
  const pendingReview = Object.values(state.claimOverrides).filter(
    (o) => o.review?.state === "pending_review",
  ).length;

  return (
    <div className="relative min-h-dvh">
      <div className="field-aurora" aria-hidden />
      <div className="field-grain" aria-hidden />

      <header
        className="fixed inset-x-0 top-0 z-50 transition-all"
        style={{
          background: scrolled ? "color-mix(in srgb, var(--site-bg) 88%, transparent)" : "transparent",
          backdropFilter: scrolled ? "blur(14px) saturate(140%)" : "none",
          borderBottom: scrolled ? "1px solid var(--site-border)" : "1px solid transparent",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
          <a href="#/" className="flex shrink-0 items-center gap-2.5">
            <span className="relative flex size-8 items-center justify-center rounded-lg" style={{ background: "var(--site-accent)", color: "var(--site-on-accent)" }}>
              <Activity className="size-4.5" strokeWidth={2.4} />
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:block">
              练得明白
              <span className="ml-1.5 font-mono text-[10px] font-normal text-muted-foreground">EVIDENCE-FIRST</span>
            </span>
          </a>

          <nav className="ml-auto hidden items-center gap-0.5 lg:flex">
            {navItems.map((n) => {
              const on = n.hash === hash;
              return (
                <a
                  key={n.hash}
                  href={n.hash}
                  className="relative rounded-lg px-2.5 py-2 text-[13px] transition-colors"
                  style={{
                    color: on ? "var(--site-fg)" : "var(--site-muted)",
                    background: on ? "var(--site-elevated)" : "transparent",
                  }}
                >
                  {n.label}
                  {n.hash === "#/review" && pendingReview > 0 && (
                    <span className="ml-1 rounded-full px-1.5 py-0.5 font-mono text-[10px]" style={{ background: "var(--tone-warn)", color: "var(--site-bg)" }}>
                      {pendingReview}
                    </span>
                  )}
                  {on && <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full" style={{ background: "var(--site-accent)" }} />}
                </a>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <span
              className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] md:inline-flex"
              style={{
                borderColor: ai === "ready" ? "color-mix(in srgb, var(--tone-ok) 45%, transparent)" : "var(--site-border)",
                color: ai === "ready" ? "var(--tone-ok)" : "var(--site-muted)",
              }}
              title={AI_STATUS_LABEL[ai]}
            >
              <span className="size-1.5 rounded-full" style={{ background: ai === "ready" ? "var(--tone-ok)" : "var(--site-muted)" }} />
              {ai === "ready" ? "AI 已配置" : "AI 未配置"}
            </span>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <a href="#/plan">开始训练</a>
            </Button>
            <button
              className="rounded-lg border border-border p-2 lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
            <nav className="mx-auto grid max-w-6xl grid-cols-2 gap-1 px-5 py-3">
              {navItems.map((n) => {
                const Icon = n.icon;
                const on = n.hash === hash;
                return (
                  <a
                    key={n.hash}
                    href={n.hash}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                    style={{
                      background: on ? "var(--site-elevated)" : "transparent",
                      color: on ? "var(--site-accent)" : "var(--site-fg)",
                    }}
                  >
                    <Icon className="size-4" />
                    {n.label}
                  </a>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* 移动端底部留出固定导航的高度，避免遮挡页面底部按钮。 */}
      <main className="relative z-10 pb-20 pt-16 lg:pb-0">
        <Page />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
        aria-label="主导航"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {USER_NAV.map((n) => {
            const Icon = n.icon;
            const on = n.hash === hash;
            return (
              <a
                key={n.hash}
                href={n.hash}
                className="flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px]"
                style={{ color: on ? "var(--site-accent)" : "var(--site-muted)" }}
                aria-current={on ? "page" : undefined}
              >
                <Icon className="size-5" strokeWidth={on ? 2.4 : 1.9} />
                {n.label}
              </a>
            );
          })}
        </div>
      </nav>

      <EvidenceDrawer
        open={why.open}
        onClose={() => setWhy((s) => ({ ...s, open: false }))}
        claimId={why.open ? why.id : null}
      />

      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">练得明白 · 证据优先的健身规划</p>
              <p className="mt-1">
                视频版权归作者所有，本站仅存来源信息并提供跳转，不存储或转载视频内容。
              </p>
              <p className="mt-0.5">本工具不能替代专业教练与医生。出现疼痛请停止训练并就医。</p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <a href="#/profile" className="hover:text-primary">我的</a>
              {admin && <a href="#/knowledge" className="hover:text-primary">知识库</a>}
              {admin && <a href="#/review" className="hover:text-primary">审核台</a>}
              <a href="https://university.aliyun.com/action/qoder" target="_blank" rel="noopener noreferrer" className="hover:text-primary">Qoder 高校计划</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}