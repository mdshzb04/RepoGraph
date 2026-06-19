"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CityContributor, CityDistrict, LayoutBuilding } from "./types";

export function ContributorDrawer({
  contributor,
  building,
  district,
  open,
  onClose,
}: {
  contributor: CityContributor | null;
  building: LayoutBuilding | null;
  district: CityDistrict | undefined;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !contributor) return null;

  return (
    <aside
      className="absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-border/50 bg-card/95 shadow-xl backdrop-blur-md"
      aria-label="Contributor details"
    >
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <h3 className="text-sm font-semibold">{contributor.login}</h3>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        {contributor.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contributor.avatarUrl}
            alt=""
            className="size-14 rounded-full border border-border/50"
          />
        ) : null}
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <dt className="text-muted-foreground">Commits</dt>
          <dd>{contributor.commits}</dd>
          <dt className="text-muted-foreground">Merged PRs</dt>
          <dd>{contributor.mergedPrs}</dd>
          <dt className="text-muted-foreground">Reviews</dt>
          <dd>{contributor.reviews}</dd>
          <dt className="text-muted-foreground">Height score</dt>
          <dd>{contributor.heightScore}</dd>
          <dt className="text-muted-foreground">Primary language</dt>
          <dd>{contributor.primaryLanguage}</dd>
          <dt className="text-muted-foreground">District</dt>
          <dd>{district?.name ?? building?.districtId ?? "—"}</dd>
        </dl>
        {building && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Building footprint {building.width}×{building.depth}px, {building.floors}{" "}
            floors
            {building.hasCrane ? ", construction crane (open PRs)" : ""}
            {building.maintenanceLevel > 0.3
              ? ", maintenance activity (open issues)"
              : ""}
            {building.abandoned ? ", abandoned visual (inactive period)" : ""}
          </p>
        )}
      </div>
    </aside>
  );
}
