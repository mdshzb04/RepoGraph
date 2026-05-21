import { fetchBackend } from "@/lib/backend-fetch";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.text();
  try {
    const res = await fetchBackend(request, `/api/repos/${id}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json({ error: "Backend offline" }, { status: 502 });
  }
}
