import { fetchBackend } from "@/lib/backend-fetch";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await fetchBackend(request, `/api/repos/${id}/deployments`);
    const text = await res.text();
    return new Response(text || "{}", {
      status: res.status || 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json({ error: "Backend offline" }, { status: 502 });
  }
}
