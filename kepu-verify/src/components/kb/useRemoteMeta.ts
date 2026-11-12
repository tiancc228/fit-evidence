import { useCallback, useEffect, useRef, useState } from "react";
import type { Remote } from "@/src/lib/evidence";

export type RemoteState<T> =
  | { status: "idle" }
  | { status: "loading"; key: string }
  | { status: "ok"; key: string; data: T; at: string }
  | { status: "not_found"; key: string; message: string }
  | { status: "invalid"; key: string; message: string }
  | { status: "error"; key: string; message: string };

/**
 * 粘贴即自动获取（防抖），并保留手动重试。
 * key 变化时丢弃上一次请求的结果，避免慢响应覆盖新编号的元数据。
 * 每个非 idle 状态都带上它所属的 key：换编号那一次 render 里 state 仍是旧结果，
 * 调用方必须比对 key 才能安全写入表单，否则旧论文会串到新编号上。
 */
export function useRemoteMeta<T>(
  key: string | null,
  fetcher: (key: string) => Promise<Remote<T>>,
  delayMs = 500,
) {
  const [state, setState] = useState<RemoteState<T>>({ status: "idle" });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!key) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", key });
    const timer = setTimeout(() => {
      void fetcherRef.current(key).then((r) => {
        if (cancelled) return;
        setState(r.status === "ok" ? { status: "ok", key, data: r.data, at: new Date().toISOString() } : { ...r, key });
      });
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, nonce, delayMs]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { state, retry };
}

/**
 * 换编号的那一帧里 state 仍属于上一个 key。对界面一律呈现为「正在请求当前编号」，
 * 这样旧编号的元数据既不会写进表单，也不会以成功态展示在新编号下面。
 */
export function currentRemoteState<T>(state: RemoteState<T>, key: string | null): RemoteState<T> {
  if (key == null) return { status: "idle" };
  if (state.status === "idle") return { status: "loading", key };
  return state.key === key ? state : { status: "loading", key };
}