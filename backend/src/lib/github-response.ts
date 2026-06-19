export class GithubApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "GithubApiError";
  }
}

export function isHtmlPayload(text: string): boolean {
  const head = text.trimStart().slice(0, 512).toLowerCase();
  return (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.includes("<!doctype html") ||
    head.includes("<html lang=")
  );
}

export function isJsonContentType(contentType: string | null): boolean {
  const ct = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  return ct === "application/json" || ct === "application/vnd.github+json";
}

export async function readGithubJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type");
  const text = await res.text();

  if (isHtmlPayload(text)) {
    throw new GithubApiError(
      "GitHub returned an HTML page instead of JSON — sign in with GitHub or check GITHUB_TOKEN",
      res.status || 502,
      "GITHUB_HTML_RESPONSE"
    );
  }

  const trimmed = text.trimStart();
  const looksLikeJson =
    trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed === "null";

  if (contentType && !isJsonContentType(contentType) && !looksLikeJson) {
    throw new GithubApiError(
      `GitHub response must be JSON (got ${contentType.split(";")[0]})`,
      res.status || 502,
      "GITHUB_INVALID_CONTENT_TYPE"
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GithubApiError(
      "GitHub returned invalid JSON",
      res.status || 502,
      "GITHUB_INVALID_JSON"
    );
  }
}

export function assertTextNotHtml(content: string, context: string): void {
  if (isHtmlPayload(content)) {
    throw new GithubApiError(
      `${context}: received HTML instead of source (check repository access)`,
      403,
      "GITHUB_HTML_CONTENT"
    );
  }
}
