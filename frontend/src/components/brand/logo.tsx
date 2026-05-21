import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  size?: number;
};

/** Premium AI engineering mark — matte hex, git nodes, terminal cue */
export function DefiLogo({ className, size = 40 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-foreground", className)}
      aria-hidden
    >
      <path
        d="M24 3.5 40.5 13v22L24 44.5 7.5 35V13L24 3.5Z"
        className="fill-[var(--logo-surface)] stroke-[var(--logo-border)]"
        strokeWidth="1"
      />
      <path
        d="M24 14v6M24 20l-6.5 5M24 20l6.5 5"
        className="stroke-[var(--logo-accent)]"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <circle cx="24" cy="13.5" r="2.25" className="fill-[var(--logo-accent)]" />
      <circle cx="17" cy="26" r="1.75" className="fill-[var(--logo-muted)]" />
      <circle cx="31" cy="26" r="1.75" className="fill-[var(--logo-muted)]" />
      <path
        d="M15.5 31.5 19 28.5 22.5 31.5"
        className="stroke-[var(--logo-accent)]"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path
        d="M26 31.5h7"
        className="stroke-[var(--logo-muted)]"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}
