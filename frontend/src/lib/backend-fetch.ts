import { getBackendUrl } from "@/lib/backend";
import { buildBackendAuthHeaders } from "@/lib/server-auth-context";

/**
 * Server-side fetch to the FastAPI backend with user / internal auth headers.
 */
export async function fetchBackend(
  request: Request,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = getBackendUrl().replace(/\/$/, "");
  if (
    process.env.VERCEL &&
    (!process.env.BACKEND_URL || base.includes("localhost"))
  ) {
    return Response.json(
      { error: "Set BACKEND_URL in Vercel to your hosted API (e.g. Render/Railway URL)." },
      { status: 503 }
    );
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${p}`;
  const forwarded = await buildBackendAuthHeaders(request);
  const headers = new Headers(init?.headers);
  for (const [k, v] of Object.entries(forwarded)) {
    headers.set(k, v);
  }
  return fetch(url, { ...init, headers });
}
