/**
 * Lightweight telemetry facade for the Next.js frontend.
 * OTLP export runs on the Express backend — no OpenTelemetry SDK on Vercel.
 */

import { resolveDashboardEmbedUrl, resolveDashboardViewUrl } from "@engintel/telemetry/grafana-public";

export type TelemetryPublicStatus = {
  enabled: boolean;
  provider: "grafana_cloud" | "none";
  serviceName: string;
  environment: string;
  runtimeMode: "long_running" | "serverless";
  dashboardUrl: string | null;
  dashboardEmbedUrl: string | null;
  otlpConfigured: boolean;
};

export function initTelemetry(): TelemetryPublicStatus {
  return getStatus();
}

export function getStatus(): TelemetryPublicStatus {
  const instanceId = process.env.GRAFANA_CLOUD_INSTANCE_ID?.trim();
  const apiKey =
    process.env.GRAFANA_CLOUD_API_KEY?.trim() ||
    process.env.GRAFANA_CLOUD_OTLP_TOKEN?.trim();
  const otlp =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() ||
    process.env.GRAFANA_CLOUD_OTLP_ENDPOINT?.trim();
  const enabled =
    process.env.OTEL_ENABLED === "true" ||
    Boolean(instanceId && apiKey && otlp);

  const dashboardUrlRaw =
    process.env.GRAFANA_CLOUD_DASHBOARD_URL?.trim() ||
    process.env.NEXT_PUBLIC_GRAFANA_DASHBOARD_URL?.trim() ||
    null;
  const dashboardUid =
    process.env.GRAFANA_CLOUD_DASHBOARD_UID?.trim() ||
    process.env.NEXT_PUBLIC_GRAFANA_DASHBOARD_UID?.trim() ||
    undefined;
  const embedUrl = resolveDashboardEmbedUrl({
    embedUrl:
      process.env.GRAFANA_CLOUD_EMBED_URL?.trim() ||
      process.env.NEXT_PUBLIC_GRAFANA_EMBED_URL?.trim() ||
      null,
    dashboardUrl: dashboardUrlRaw,
    dashboardUid,
  });
  const dashboardViewUrl = resolveDashboardViewUrl(dashboardUrlRaw) ?? dashboardUrlRaw;

  return {
    enabled,
    provider: enabled ? "grafana_cloud" : "none",
    serviceName: process.env.OTEL_SERVICE_NAME?.trim() || "engintel-web",
    environment:
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT?.trim() ||
      process.env.NODE_ENV ||
      "development",
    runtimeMode: "serverless",
    dashboardUrl: dashboardViewUrl,
    dashboardEmbedUrl: embedUrl,
    otlpConfigured: Boolean(otlp && instanceId && apiKey),
  };
}

export function isTelemetryEnabled(): boolean {
  return getStatus().enabled;
}

export function recordApiRequest(): void {}
export function recordBackgroundJob(): void {}
export async function flushTelemetry(): Promise<void> {}
