import { fetchBackend } from "@/lib/backend-fetch";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const res = await fetchBackend(request, "/api/repos/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await res.text();
    return new Response(text || "{}", {
      status: res.status || 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json({ error: "Backend offline" }, { status: 502 });
  }
}
