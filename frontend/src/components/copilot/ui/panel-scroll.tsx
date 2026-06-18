import { cn } from "@/lib/utils";

/** Reliable scroll container — avoids Base UI ScrollArea zero-height issues in flex layouts. */
export function PanelScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
    </div>
  );
}
