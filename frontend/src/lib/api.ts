export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.status === 502 || res.status === 504
        ? "Backend timed out or is offline. Run: cd backend && npm run dev"
        : res.status === 405
          ? "API route error (405). Redeploy the frontend, or set BACKEND_URL on Vercel to your hosted API."
          : `Backend unreachable (${res.status}). Set BACKEND_URL on Vercel to your API URL (not localhost:8000).`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      text.slice(0, 120) || `Invalid server response (${res.status})`
    );
  }
}
