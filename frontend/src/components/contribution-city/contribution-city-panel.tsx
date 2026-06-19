"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { RepoMeta } from "@/components/copilot/types";
import { SectionHeader } from "@/components/copilot/ui/section-header";
import { PanelScroll } from "@/components/copilot/ui/panel-scroll";
import type { ContributionCityData, ContributionCityPeriod } from "./types";
import { ContributionCityView } from "./contribution-city-view";

export function ContributionCityPanel({
  repo,
  active,
}: {
  repo: RepoMeta | null;
  active: boolean;
}) {
  const [data, setData] = useState<ContributionCityData | null>(null);
  const [period, setPeriod] = useState<ContributionCityPeriod>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!repo?.id || repo.status !== "ready") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/repos/${repo.id}/contribution-city?period=${period}`
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load Contribution City");
      }
      setData((await res.json()) as ContributionCityData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load city");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [repo?.id, repo?.status, period]);

  useEffect(() => {
    if (!active || !repo?.id) {
      if (!repo?.id) {
        setData(null);
        setError(null);
      }
      return;
    }
    if (repo.status === "ready") void load();
    else if (repo.status === "indexing") {
      setError(null);
      setData(null);
      setLoading(true);
    } else {
      setLoading(false);
      setError("Repository index failed or is unavailable.");
    }
  }, [active, repo?.id, repo?.status, load]);

  if (!repo) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Connect and index a repository to generate Contribution City.
      </p>
    );
  }

  if (repo.status === "indexing") {
    return (
      <PanelScroll className="p-6">
        <SectionHeader
          title="Contribution City"
          description="Skyline generates automatically when indexing completes — no extra AI calls."
        />
        <p className="mt-6 text-sm text-muted-foreground">
          Indexing in progress… city layout will appear when the repository is ready.
        </p>
      </PanelScroll>
    );
  }

  return (
    <PanelScroll className="flex min-h-0 flex-1 flex-col p-6">
      <SectionHeader
        title="Contribution City"
        description="Isometric skyline from your GitHub profile, contributors, and repo modules — builds automatically when a repository is indexed."
      />
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <ContributionCityView
          data={data}
          period={period}
          onPeriodChange={setPeriod}
          loading={loading}
        />
      </div>
    </PanelScroll>
  );
}
