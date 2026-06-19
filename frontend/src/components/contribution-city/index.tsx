"use client";

import dynamic from "next/dynamic";

export const ContributionCityPanel = dynamic(
  () =>
    import("./contribution-city-panel").then((m) => m.ContributionCityPanel),
  {
    ssr: false,
    loading: () => (
      <p className="p-8 font-mono text-xs text-muted-foreground">
        {">"} Loading Contribution City…
      </p>
    ),
  }
);

export type {
  ContributionCityData,
  ContributionCityPeriod,
} from "./types";
