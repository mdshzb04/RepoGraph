import { resolveDashboardEmbedUrl, resolveDashboardViewUrl } from "./grafana-public";

export type TelemetryRuntimeMode = "long_running" | "serverless";

export type TelemetryConfig = {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  runtimeMode: TelemetryRuntimeMode;
  grafanaCloud: {
    otlpMetricsUrl: string;
    headers: Record<string, string>;
  } | null;
  dashboardUrl: string | null;
  exportIntervalMs: number;
  resourceAttributes: Record<string, string>;
};

export type TelemetryPublicStatus = {
  enabled: boolean;
  provider: "grafana_cloud" | "none";
  serviceName: string;
  environment: string;
  runtimeMode: TelemetryRuntimeMode;
  dashboardUrl: string | null;
  /** iframe-ready URL (public dashboard or kiosk mode) */
  dashboardEmbedUrl: string | null;
  otlpConfigured: boolean;
};

function envFlag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function detectRuntimeMode(): TelemetryRuntimeMode {
  if (process.env.TELEMETRY_RUNTIME_MODE === "long_running") return "long_running";
  if (process.env.TELEMETRY_RUNTIME_MODE === "serverless") return "serverless";
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return "serverless";
  return "long_running";
}

/** Parse `Authorization=Basic xxx,Other=value` from OTEL_EXPORTER_OTLP_HEADERS. */
export function parseOtlpHeaders(): Record<string, string> {
  const raw = process.env.OTEL_EXPORTER_OTLP_HEADERS?.trim();
  if (!raw) return {};
  const headers: Record<string, string> = {};
  for (const part of raw.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) headers[key] = value;
  }
  return headers;
}

export function parseResourceAttributes(): Record<string, string> {
  const raw = process.env.OTEL_RESOURCE_ATTRIBUTES?.trim();
  if (!raw) return {};
  const attrs: Record<string, string> = {};
  for (const part of raw.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) attrs[key] = value;
  }
  return attrs;
}

function buildOtlpMetricsUrl(): string | null {
  const explicit =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() ||
    process.env.GRAFANA_CLOUD_OTLP_ENDPOINT?.trim();
  if (explicit) {
    return explicit.endsWith("/v1/metrics")
      ? explicit
      : `${explicit.replace(/\/$/, "")}/v1/metrics`;
  }
  const region = process.env.GRAFANA_CLOUD_OTLP_REGION?.trim();
  if (region) {
    return `https://otlp-gateway-${region}.grafana.net/otlp/v1/metrics`;
  }
  return null;
}

function resolveOtlpAuthHeaders(): Record<string, string> | null {
  const fromEnv = parseOtlpHeaders();
  if (fromEnv.Authorization || fromEnv.authorization) {
    return {
      ...fromEnv,
      "Content-Type": fromEnv["Content-Type"] ?? "application/json",
    };
  }

  const instanceId = process.env.GRAFANA_CLOUD_INSTANCE_ID?.trim();
  const apiKey =
    process.env.GRAFANA_CLOUD_API_KEY?.trim() ||
    process.env.GRAFANA_CLOUD_OTLP_TOKEN?.trim();
  if (instanceId && apiKey) {
    const auth = Buffer.from(`${instanceId}:${apiKey}`).toString("base64");
    return {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    };
  }

  return null;
}

export function isOtlpConfigured(): boolean {
  return Boolean(buildOtlpMetricsUrl() && resolveOtlpAuthHeaders());
}

/**
 * Validates Grafana Cloud / OTLP env vars. Never throws — returns disabled config on failure.
 */
export function loadTelemetryConfig(): TelemetryConfig {
  const serviceName =
    process.env.OTEL_SERVICE_NAME?.trim() ||
    process.env.GRAFANA_SERVICE_NAME?.trim() ||
    "repograph-backend";
  const serviceVersion = process.env.OTEL_SERVICE_VERSION?.trim() || "1.0.0";
  const environment =
    process.env.OTEL_DEPLOYMENT_ENVIRONMENT?.trim() ||
    process.env.NODE_ENV?.trim() ||
    "development";
  const runtimeMode = detectRuntimeMode();
  const dashboardUrl = process.env.GRAFANA_CLOUD_DASHBOARD_URL?.trim() || null;
  const resourceAttributes = parseResourceAttributes();

  const otlpMetricsUrl = buildOtlpMetricsUrl();
  const otelRaw = process.env.OTEL_ENABLED?.trim().toLowerCase();
  const explicitlyDisabled = otelRaw === "false" || otelRaw === "0";
  const explicitlyEnabled = envFlag("OTEL_ENABLED");

  const authHeaders = resolveOtlpAuthHeaders();
  const enabled =
    !explicitlyDisabled &&
    (explicitlyEnabled || Boolean(otlpMetricsUrl && authHeaders));

  let grafanaCloud: TelemetryConfig["grafanaCloud"] = null;
  if (enabled && otlpMetricsUrl && authHeaders) {
    grafanaCloud = {
      otlpMetricsUrl,
      headers: authHeaders,
    };
  }

  const exportIntervalMs =
    runtimeMode === "serverless"
      ? 0
      : Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS ?? 60_000);

  return {
    enabled: enabled && grafanaCloud !== null,
    serviceName,
    serviceVersion,
    environment,
    runtimeMode,
    grafanaCloud,
    dashboardUrl,
    exportIntervalMs: Number.isFinite(exportIntervalMs) ? exportIntervalMs : 60_000,
    resourceAttributes,
  };
}

export function getTelemetryPublicStatus(config: TelemetryConfig): TelemetryPublicStatus {
  const dashboardUid =
    process.env.GRAFANA_CLOUD_DASHBOARD_UID?.trim() || undefined;
  const embedUrl = resolveDashboardEmbedUrl({
    embedUrl: process.env.GRAFANA_CLOUD_EMBED_URL?.trim() || null,
    dashboardUrl: config.dashboardUrl,
    dashboardUid,
  });
  const dashboardViewUrl =
    resolveDashboardViewUrl(config.dashboardUrl) ?? config.dashboardUrl;

  return {
    enabled: config.enabled,
    provider: config.enabled ? "grafana_cloud" : "none",
    serviceName: config.serviceName,
    environment: config.environment,
    runtimeMode: config.runtimeMode,
    dashboardUrl: dashboardViewUrl,
    dashboardEmbedUrl: embedUrl,
    otlpConfigured: config.grafanaCloud !== null,
  };
}
