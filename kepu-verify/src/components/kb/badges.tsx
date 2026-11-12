import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Claim, ReviewState, Verdict } from "@/src/lib/types";
import { CLAIM_TYPE_LABEL, RELATION_META, REVIEW_META, STRENGTH_META, VERDICT_META } from "@/src/components/kb/meta";

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <Badge variant="outline" className={cn(VERDICT_META[verdict].badge, className)}>
      {VERDICT_META[verdict].label}
    </Badge>
  );
}

export function ReviewBadge({ state, className }: { state: ReviewState; className?: string }) {
  return (
    <Badge variant="outline" className={cn(REVIEW_META[state].badge, className)}>
      {REVIEW_META[state].label}
    </Badge>
  );
}

export function ClaimTypeBadge({ type, className }: { type: Claim["layer2"]["claimType"]; className?: string }) {
  return (
    <Badge variant="secondary" className={className}>
      {CLAIM_TYPE_LABEL[type]}
    </Badge>
  );
}

export function RelationBadge({ relation }: { relation: "supports" | "refutes" | "partial" | "context" }) {
  return (
    <Badge variant="outline" className={RELATION_META[relation].badge}>
      {RELATION_META[relation].label}
    </Badge>
  );
}

export function StrengthBadge({ strength }: { strength: "high" | "medium" | "low" }) {
  return (
    <Badge variant="outline" className={STRENGTH_META[strength].badge}>
      {STRENGTH_META[strength].label}
    </Badge>
  );
}