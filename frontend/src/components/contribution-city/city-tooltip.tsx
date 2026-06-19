"use client";

import type { CityBuilding, CityContributor } from "./types";

export function CityTooltip({
  building,
  contributor,
  x,
  y,
}: {
  building: CityBuilding;
  contributor: CityContributor | undefined;
  x: number;
  y: number;
}) {
  if (!contributor) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 max-w-[220px] rounded-lg border border-border/60 bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
      style={{ left: x + 12, top: y - 8 }}
      role="tooltip"
    >
      <p className="font-medium text-foreground">{contributor.login}</p>
      <p className="mt-1 text-muted-foreground">
        {contributor.commits} commits · {contributor.mergedPrs} merged PRs ·{" "}
        {contributor.reviews} reviews
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {building.language} · {building.floors} floors
        {building.hasCrane ? " · open PR crane" : ""}
        {building.abandoned ? " · low activity" : ""}
      </p>
    </div>
  );
}
