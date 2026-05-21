import { getBackendUrl } from "@/lib/backend";
import { getStatus } from "@/lib/telemetry";

export async function GET() {
  const frontend = getStatus();

  try {
    const res = await fetch(`${getBackendUrl()}/api/telemetry/status`, {
      cache: "no-store",
    });
    if (res.ok) {
      const backend = await res.json();
      return Response.json({
        frontend,
        backend,
        grafanaCloud: Boolean(backend.enabled),
        dashboardUrl: backend.dashboardUrl ?? frontend.dashboardUrl,
        dashboardEmbedUrl: backend.dashboardEmbedUrl ?? frontend.dashboardEmbedUrl,
      });
    }
  } catch {
    /* backend optional in dev */
  }

  return Response.json({
    frontend,
    backend: null,
    grafanaCloud: frontend.enabled,
    dashboardUrl: frontend.dashboardUrl,
    dashboardEmbedUrl: frontend.dashboardEmbedUrl,
  });
}
