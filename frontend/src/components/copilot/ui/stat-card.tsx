import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("copilot-glass rounded-lg p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="copilot-stat mt-1 text-xl font-medium tracking-tight">{value}</p>
      {sub && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}
