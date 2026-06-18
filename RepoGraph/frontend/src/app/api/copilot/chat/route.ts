import { fetchBackend } from "@/lib/backend-fetch";

export async function POST(request: Request) {
  const body = await request.text();
  try {
    const res = await fetchBackend(request, "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return new Response(res.body, {
      status: res.status,
      headers: res.headers,
    });
  } catch {
    return Response.json({ error: "Backend offline" }, { status: 502 });
  }
}
