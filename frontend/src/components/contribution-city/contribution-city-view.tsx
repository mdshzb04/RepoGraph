"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ContributionCityData, ContributionCityPeriod } from "./types";
import { layoutCityBuildings } from "./city-layout";
import { CityRenderer } from "./city-renderer";
import { CityTooltip } from "./city-tooltip";
import { ContributorDrawer } from "./contributor-drawer";
import { exportCityPng } from "./city-export";

const PERIODS: { id: ContributionCityPeriod; label: string }[] = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "all", label: "All-time" },
];

export function ContributionCityView({
  data,
  period,
  onPeriodChange,
  loading,
}: {
  data: ContributionCityData | null;
  period: ContributionCityPeriod;
  onPeriodChange: (p: ContributionCityPeriod) => void;
  loading: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const layoutBuildings = useMemo(
    () => (data ? layoutCityBuildings(data) : []),
    [data]
  );

  const buildingById = useMemo(() => {
    const m = new Map(layoutBuildings.map((b) => [b.id, b]));
    return m;
  }, [layoutBuildings]);

  const contributorById = useMemo(() => {
    const m = new Map((data?.contributors ?? []).map((c) => [c.id, c]));
    return m;
  }, [data?.contributors]);

  const selectedBuilding = selectedBuildingId
    ? buildingById.get(selectedBuildingId) ?? null
    : null;
  const selectedContributor = selectedBuilding
    ? contributorById.get(selectedBuilding.contributorId) ?? null
    : null;
  const selectedDistrict = selectedBuilding
    ? data?.districts.find((d) => d.id === selectedBuilding.districtId)
    : undefined;

  const hoverBuilding = hoverId ? buildingById.get(hoverId) : null;
  const hoverContributor = hoverBuilding
    ? contributorById.get(hoverBuilding.contributorId)
    : undefined;

  const handleExport = useCallback(async () => {
    if (!svgRef.current || !data) return;
    setExporting(true);
    try {
      const slug = data.fullName.replace(/\//g, "-");
      await exportCityPng(svgRef.current, `contribution-city-${slug}.png`);
    } finally {
      setExporting(false);
    }
  }, [data]);

  if (!data && loading) {
    return (
      <div className="flex h-[min(420px,60vh)] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Building skyline from index analytics…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-border/50 bg-muted/20 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPeriodChange(p.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                period === p.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{data.buildings.length} buildings</span>
          <span>·</span>
          <span>{data.openPrs} open PRs</span>
          <span>·</span>
          <span>{data.openIssues} issues</span>
          {!data.githubAvailable && (
            <>
              <span>·</span>
              <span className="text-chart-5">heuristic mode</span>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Download className="size-3" />
            )}
            PNG
          </Button>
        </div>
      </div>

      <div className="relative min-h-[min(420px,60vh)] flex-1 overflow-hidden rounded-xl border border-border/40 bg-card/30">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div
          className="h-full w-full"
          onMouseLeave={() => setHoverId(null)}
        >
          <CityRenderer
            data={data}
            layoutBuildings={layoutBuildings}
            selectedId={selectedBuildingId}
            onSelectBuilding={setSelectedBuildingId}
            onHoverBuilding={(id, ev) => {
              setHoverId(id);
              if (ev) {
                const rect = (ev.currentTarget as SVGGElement)
                  .closest("svg")
                  ?.getBoundingClientRect();
                if (rect) {
                  setHoverPos({
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                  });
                }
              }
            }}
            svgRef={svgRef}
          />
        </div>
        {hoverBuilding && hoverContributor && (
          <CityTooltip
            building={hoverBuilding}
            contributor={hoverContributor}
            x={hoverPos.x}
            y={hoverPos.y}
          />
        )}
        <ContributorDrawer
          open={Boolean(selectedBuildingId)}
          contributor={selectedContributor}
          building={selectedBuilding}
          district={selectedDistrict}
          onClose={() => setSelectedBuildingId(null)}
        />
      </div>
    </div>
  );
}
