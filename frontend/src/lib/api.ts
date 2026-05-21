export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.status === 502 || res.status === 504
        ? "Backend timed out or is offline. Run: cd backend && npm run dev"
        : `Empty response from server (${res.status}). Is the backend running on port 8000?`
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
