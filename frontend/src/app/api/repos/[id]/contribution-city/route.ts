import { fetchBackend } from "@/lib/backend-fetch";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const period = url.searchParams.get("period");
    const qs = period ? `?period=${encodeURIComponent(period)}` : "";
    const res = await fetchBackend(
      request,
      `/api/repos/${id}/contribution-city${qs}`
    );
    const text = await res.text();
    return new Response(text || "{}", {
      status: res.status || 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json({ error: "Backend offline" }, { status: 502 });
  }
}
