export const CHECK_LABEL: Record<string, string> = {
  ok: "Met",
  warn: "Review",
  fail: "Gap",
};

export const CHECK_CLASS: Record<string, string> = {
  ok: "text-foreground/80",
  warn: "text-muted-foreground",
  fail: "text-destructive",
};

export const CONFIDENCE_LABEL: Record<"detected" | "inferred", string> = {
  detected: "File-backed",
  inferred: "Reference only",
};

export const CONFIDENCE_BADGE: Record<"detected" | "inferred", string> = {
  detected: "border-border bg-muted/40 text-foreground",
  inferred: "border-border/80 bg-transparent text-muted-foreground",
};

export const INDEX_CONFIDENCE_NOTE: Record<string, string> = {
  low: "Narrow index — treat findings as directional",
  medium: "Moderate coverage — confirm critical paths manually",
  high: "Broader coverage — still heuristic, not audited",
};

export function formatUsdRange([lo, hi]: [number, number]): string {
  if (lo === hi) return `~$${lo.toFixed(2)}`;
  return `~$${lo.toFixed(2)}–$${hi.toFixed(2)}`;
}
