/**
 * 「为什么这样建议」的唯一出口。
 * 有 onOpenEvidence 就交给页面外壳；没有才退回到 window 事件，
 * 本文件不查询、也不渲染任何证据内容。
 */
export const DIET_EVIDENCE_EVENT = "kepu:diet:open-evidence";

export type EvidenceSource = "diet-balance" | "diet-slot" | "diet-claim" | "diet-next-meal" | "diet-advice";

export interface DietEvidenceDetail {
  /** 要打开的结论编号，如 fatloss-caloric-deficit。 */
  id: string;
  type: "claim";
  source: EvidenceSource;
  /** 全局监听器打开抽屉后置 true，作为「已处理」回执。 */
  handled?: boolean;
}

export type OpenEvidence = (claimId: string) => void;

export type EvidenceRequestResult = "callback" | "event" | "missing";

export function requestEvidence(
  open: OpenEvidence | undefined,
  claimId: string,
  source: EvidenceSource,
  target?: EventTarget,
): EvidenceRequestResult {
  if (open) {
    open(claimId);
    return "callback";
  }
  const detail: DietEvidenceDetail = { id: claimId, type: "claim", source };
  const event = new CustomEvent<DietEvidenceDetail>(DIET_EVIDENCE_EVENT, { detail, cancelable: true });
  // 监听器可用 preventDefault() 或置 detail.handled 表示已打开，避免误报「打不开」。
  (target ?? window).dispatchEvent(event);
  return event.defaultPrevented || detail.handled ? "event" : "missing";
}
