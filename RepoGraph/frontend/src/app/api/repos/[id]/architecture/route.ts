import { fetchBackend } from "@/lib/backend-fetch";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await fetchBackend(request, `/api/repos/${id}/architecture`);
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    if (
      text.trimStart().toLowerCase().startsWith("<!doctype") ||
      text.trimStart().toLowerCase().startsWith("<html")
    ) {
      return Response.json(
        { error: "Backend returned HTML instead of JSON", code: "HTML_RESPONSE" },
        { status: 502 }
      );
    }
    if (contentType && !contentType.includes("application/json")) {
      return Response.json(
        { error: "Invalid response content type", code: "INVALID_CONTENT_TYPE" },
        { status: 502 }
      );
    }
    return new Response(text || "{}", {
      status: res.status || 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json({ error: "Backend offline", code: "BACKEND_OFFLINE" }, { status: 502 });
  }
}
