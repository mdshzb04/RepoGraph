export type GrafanaEmbedOptions = {
  /** Full public-dashboard or kiosk embed URL (highest priority). */
  embedUrl?: string | null;
  /** Stack dashboard list or direct dashboard URL. */
  dashboardUrl?: string | null;
  dashboardUid?: string | null;
  dashboardSlug?: string | null;
  orgId?: string;
  refresh?: string;
  theme?: "dark" | "light";
};

const DEFAULT_UID = "engintel-backend-metrics";
const DEFAULT_SLUG = "engintel-backend-metrics";

function parseGrafanaHost(dashboardUrl: string): string | null {
  try {
    const u = new URL(dashboardUrl);
    return u.origin;
  } catch {
    return null;
  }
}

function appendEmbedParams(
  base: string,
  opts: { refresh: string; theme: "dark" | "light" }
): string {
  try {
    const u = new URL(base);
    if (!u.searchParams.has("refresh")) u.searchParams.set("refresh", opts.refresh);
    if (!u.searchParams.has("theme")) u.searchParams.set("theme", opts.theme);
    if (!u.pathname.includes("/public-dashboards/")) {
      if (!u.searchParams.has("kiosk")) u.searchParams.set("kiosk", "tv");
    }
    return u.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}refresh=${opts.refresh}&theme=${opts.theme}&kiosk=tv`;
  }
}

/**
 * Builds a Grafana Cloud iframe URL for the EngIntel platform dashboard.
 * Prefer GRAFANA_CLOUD_EMBED_URL (public dashboard) for auth-free embedding.
 */
export function buildGrafanaEmbedUrl(options: GrafanaEmbedOptions = {}): string | null {
  const refresh = options.refresh ?? "30s";
  const theme = options.theme ?? "dark";

  const explicit = options.embedUrl?.trim();
  if (explicit) {
    return appendEmbedParams(explicit, { refresh, theme });
  }

  return null;
}

/** Only public-dashboard URLs can be embedded cross-origin in Grafana Cloud. */
export function isEmbeddableGrafanaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).pathname.includes("/public-dashboards/");
  } catch {
    return false;
  }
}

function isDirectDashboardUrl(url: URL): boolean {
  return (
    url.pathname.startsWith("/d/") ||
    url.pathname.startsWith("/goto/") ||
    url.pathname.includes("/public-dashboards/")
  );
}

export function buildGrafanaDashboardViewUrl(
  dashboardUrl: string | null | undefined,
  dashboardUid?: string | null
): string | null {
  if (!dashboardUrl?.trim()) return null;
  const trimmed = dashboardUrl.trim();
  try {
    const u = new URL(trimmed);
    if (isDirectDashboardUrl(u)) return trimmed;
  } catch {
    return trimmed;
  }
  const host = parseGrafanaHost(trimmed);
  if (!host) return trimmed;
  const uid = dashboardUid?.trim() || DEFAULT_UID;
  return `${host}/d/${uid}/${DEFAULT_SLUG}`;
}
