import { fetchBackend } from "@/lib/backend-fetch";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const backendRes = await fetchBackend(
      request,
      `/api/repos/${id}/observability/stream`,
      { headers: { Accept: "text/event-stream" } }
    );

    if (!backendRes.ok || !backendRes.body) {
      return new Response("Stream unavailable", {
        status: backendRes.status || 502,
      });
    }

    return new Response(backendRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response("Backend offline", { status: 502 });
  }
}
