import { buildGrafanaEmbedUrl, type GrafanaEmbedOptions } from "./grafana-embed";
import { buildGrafanaDashboardViewUrl } from "./grafana-embed";

const DEFAULT_UID = "engintel-backend-metrics";
const DEFAULT_TITLE = "Engintel Backend Metrics";

let cachedPublicEmbedUrl: string | null = null;
let cachedDashboardUid: string | null = null;

export function getCachedPublicEmbedUrl(): string | null {
  return cachedPublicEmbedUrl;
}

export function getCachedDashboardUid(): string | null {
  return cachedDashboardUid;
}

function parseGrafanaHost(dashboardUrl: string): string | null {
  try {
    return new URL(dashboardUrl).origin;
  } catch {
    return null;
  }
}

function grafanaApiToken(): string | null {
  return (
    process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN?.trim() ||
    process.env.GRAFANA_CLOUD_API_TOKEN?.trim() ||
    null
  );
}

async function grafanaFetch(
  stackOrigin: string,
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${stackOrigin}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

type PublicDashboardResponse = {
  accessToken?: string;
  isEnabled?: boolean;
};

type SearchHit = { uid: string; title: string };

async function findDashboardUidByTitle(
  stackOrigin: string,
  title: string,
  apiToken: string
): Promise<string | null> {
  const res = await grafanaFetch(
    stackOrigin,
    `/api/search?query=${encodeURIComponent(title)}&type=dash-db`,
    apiToken
  );
  if (!res.ok) return null;
  const items = (await res.json()) as SearchHit[];
  const exact = items.find((i) => i.title === title);
  return exact?.uid ?? items[0]?.uid ?? null;
}

export async function resolvePublicDashboardEmbedUrl(
  stackOrigin: string,
  dashboardUid: string,
  apiToken: string
): Promise<string | null> {
  const listPath = `/api/dashboards/uid/${encodeURIComponent(dashboardUid)}/public-dashboards`;

  let res = await grafanaFetch(stackOrigin, listPath, apiToken);
  if (res.status === 404) {
    res = await grafanaFetch(stackOrigin, listPath, apiToken, {
      method: "POST",
      body: JSON.stringify({
        isEnabled: true,
        share: "public",
        timeSelectionEnabled: true,
        annotationsEnabled: false,
      }),
    });
  }

  if (!res.ok) return null;

  const body = (await res.json()) as PublicDashboardResponse;
  if (!body.accessToken || body.isEnabled === false) return null;

  return `${stackOrigin}/public-dashboards/${body.accessToken}`;
}

export async function bootstrapGrafanaPublicEmbed(
  dashboardUrl: string | null,
  dashboardUid?: string
): Promise<void> {
  if (process.env.GRAFANA_CLOUD_EMBED_URL?.trim()) return;

  const token = grafanaApiToken();
  const host = dashboardUrl ? parseGrafanaHost(dashboardUrl) : null;
  if (!host) return;

  let uid =
    dashboardUid?.trim() ||
    process.env.GRAFANA_CLOUD_DASHBOARD_UID?.trim() ||
    null;

  if (!uid && token) {
    const title =
      process.env.GRAFANA_CLOUD_DASHBOARD_TITLE?.trim() || DEFAULT_TITLE;
    uid = await findDashboardUidByTitle(host, title, token);
  }

  uid = uid || DEFAULT_UID;
  cachedDashboardUid = uid;

  if (!token) return;

  try {
    cachedPublicEmbedUrl = await resolvePublicDashboardEmbedUrl(host, uid, token);
    if (cachedPublicEmbedUrl) {
      console.log(`[telemetry] Grafana public embed ready (${uid})`);
    }
  } catch (err) {
    console.warn("[telemetry] Grafana public dashboard resolve failed:", err);
  }
}

export function resolveDashboardEmbedUrl(options: GrafanaEmbedOptions): string | null {
  const explicit = options.embedUrl?.trim();
  if (explicit) {
    return buildGrafanaEmbedUrl({ ...options, embedUrl: explicit });
  }

  const cached = getCachedPublicEmbedUrl();
  if (cached) {
    return buildGrafanaEmbedUrl({ ...options, embedUrl: cached });
  }

  return null;
}

export function resolveDashboardViewUrl(dashboardUrl: string | null): string | null {
  if (!dashboardUrl?.trim()) return null;
  const trimmed = dashboardUrl.trim();
  try {
    const u = new URL(trimmed);
    if (u.pathname.startsWith("/d/") || u.pathname.startsWith("/goto/")) {
      return trimmed;
    }
  } catch {
    return trimmed;
  }
  const uid =
    process.env.GRAFANA_CLOUD_DASHBOARD_UID?.trim() ||
    getCachedDashboardUid() ||
    DEFAULT_UID;
  return buildGrafanaDashboardViewUrl(trimmed, uid) ?? trimmed;
}
