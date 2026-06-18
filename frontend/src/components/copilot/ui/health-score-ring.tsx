import { cn } from "@/lib/utils";

/** Compact heuristic indicator — not a production SLO or grade. */
export function HealthScoreRing({
  score,
  posture,
  size = "lg",
}: {
  score: number;
  posture?: string;
  grade?: string;
  size?: "sm" | "lg";
}) {
  const dim = size === "lg" ? 120 : 72;
  const stroke = size === "lg" ? 6 : 4;
  const r = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 75
      ? "stroke-muted-foreground/60"
      : score >= 50
        ? "stroke-muted-foreground/45"
        : "stroke-muted-foreground/35";

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center">
      <svg width={dim} height={dim} className="-rotate-90 opacity-90">
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border/50"
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(color, "transition-all duration-500")}
        />
      </svg>
      <div className="absolute flex max-w-[4.5rem] flex-col items-center px-1 text-center">
        <span
          className={cn(
            "font-mono font-medium tracking-tight text-foreground/90",
            size === "lg" ? "text-2xl" : "text-base"
          )}
        >
          {score}
        </span>
        <span className="text-[8px] leading-tight text-muted-foreground">
          index signal
        </span>
        {posture && size === "lg" && (
          <span className="mt-0.5 hidden text-[8px] text-muted-foreground sm:block">
            heuristic
          </span>
        )}
      </div>
    </div>
  );
}
