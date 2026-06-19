import { isPriorityManifest } from "./repo-scanner";
import {
  assertTextNotHtml,
  GithubApiError,
  readGithubJson,
} from "./github-response";

const CODE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
  ".md", ".json", ".yaml", ".yml", ".sql", ".css", ".scss",
]);

const EXTENSIONLESS_CONFIG = new Set([
  "Dockerfile",
  "Makefile",
  "Procfile",
  ".dockerignore",
  ".gitignore",
]);

const SKIP_DIRS = new Set([
  "node_modules", "dist", "build", ".git", ".next", "coverage",
  "vendor", "__pycache__", ".turbo", "out",
]);

export type RepoFile = { path: string; content: string };

export type FetchRepoResult = {
  fullName: string;
  defaultBranch: string;
  files: RepoFile[];
  allPaths: string[];
};

function headers(userGithubToken?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "engineering-intelligence-platform",
  };
  const token =
    userGithubToken?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    "";
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

export function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\.git$/i, "").replace(/\/$/, "");
  const urlMatch = trimmed.match(/github\.com\/([^/\s?#]+)\/([^/\s?#]+)/i);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
  const slash = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slash) return { owner: slash[1], repo: slash[2] };
  return null;
}

function githubError(
  status: number,
  owner: string,
  repo: string,
  auth: "user" | "env" | "none"
): string {
  const slug = `${owner}/${repo}`;
  if (status === 404) {
    if (auth === "none") {
      return `Cannot access ${slug}. Sign in with GitHub to index private repositories, or verify the repo URL is correct.`;
    }
    if (auth === "user") {
      return `Repository ${slug} not found or your GitHub account cannot access it. Verify the URL, confirm the repo exists, and sign out then sign in again if you recently granted private repo access.`;
    }
    return `Repository ${slug} not found. Your server GITHUB_TOKEN may not have access to this private repo — sign in with GitHub or update the token scopes.`;
  }
  if (status === 403) {
    if (auth !== "none") {
      return `GitHub returned 403 for ${slug} (rate limit, permissions, or secondary limit). Verify ${
        auth === "user"
          ? "OAuth scopes (needs private repo access)"
          : "GITHUB_TOKEN scopes"
      } and retry after a short wait.`;
    }
    return `GitHub rate limit exceeded (anonymous API is very tight). Sign in with GitHub, or add GITHUB_TOKEN to backend/.env — see https://github.com/settings/personal-access-tokens — restart the backend, then re-index.`;
  }
  if (status === 401) {
    return auth === "user"
      ? `GitHub rejected the signed-in OAuth token. Sign out and sign in again, or re-authorize the GitHub app.`
      : `Invalid GITHUB_TOKEN in backend/.env. Create a token at github.com/settings/tokens`;
  }
  return `GitHub API error (${status}) for ${slug}`;
}

function shouldIndexPath(path: string): boolean {
  const parts = path.split("/");
  if (parts.some((p) => SKIP_DIRS.has(p))) return false;
  const base = parts[parts.length - 1] ?? path;
  if (EXTENSIONLESS_CONFIG.has(base)) return true;
  if (isPriorityManifest(path)) return true;
  if (path.includes(".github/workflows/")) return true;
  const ext = path.slice(path.lastIndexOf("."));
  return CODE_EXT.has(ext);
}

async function fetchFileContent(
  owner: string,
  repo: string,
  filePath: string,
  branch: string,
  githubUserToken?: string | null
): Promise<RepoFile | null> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}?ref=${branch}`,
    { headers: headers(githubUserToken) }
  );
  if (!res.ok) return null;
  let data: { content?: string; encoding?: string; message?: string };
  try {
    data = await readGithubJson<{ content?: string; encoding?: string; message?: string }>(res);
  } catch {
    return null;
  }
  if (data.encoding !== "base64" || !data.content) return null;
  const content = Buffer.from(data.content, "base64").toString("utf8");
  if (!content.length) return null;
  try {
    assertTextNotHtml(content, filePath);
  } catch {
    return null;
  }
  return { path: filePath, content };
}

export async function fetchRepoFiles(
  owner: string,
  repo: string,
  maxFiles = 80,
  githubUserToken?: string | null
): Promise<FetchRepoResult> {
  const authKind: "user" | "env" | "none" = githubUserToken?.trim()
    ? "user"
    : process.env.GITHUB_TOKEN?.trim()
      ? "env"
      : "none";

  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: headers(githubUserToken),
  });
  if (!metaRes.ok) {
    throw new Error(githubError(metaRes.status, owner, repo, authKind));
  }
  const meta = await readGithubJson<{ full_name: string; default_branch: string }>(metaRes);

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${meta.default_branch}?recursive=1`,
    { headers: headers(githubUserToken) }
  );
  if (!treeRes.ok) {
    throw new GithubApiError(
      githubError(treeRes.status, owner, repo, authKind),
      treeRes.status,
      treeRes.status === 404 ? "GITHUB_NOT_FOUND" : "GITHUB_TREE_FAILED"
    );
  }

  const tree = await readGithubJson<{
    tree: { path: string; type: string; size?: number }[];
  }>(treeRes);

  const allPaths = tree.tree
    .filter((item) => {
      if (item.type !== "blob" || !item.path) return false;
      if ((item.size ?? 0) > 120_000) return false;
      const parts = item.path.split("/");
      return !parts.some((p) => SKIP_DIRS.has(p));
    })
    .map((item) => item.path);

  const indexable = allPaths.filter(shouldIndexPath);

  const priorityPaths = indexable.filter((p) => isPriorityManifest(p) || p === "Dockerfile");
  const codePaths = indexable.filter((p) => !priorityPaths.includes(p));

  const toFetch = [
    ...priorityPaths,
    ...codePaths.slice(0, Math.max(0, maxFiles - priorityPaths.length)),
  ];

  const files: RepoFile[] = [];
  const seen = new Set<string>();

  for (const filePath of toFetch) {
    if (seen.has(filePath)) continue;
    seen.add(filePath);
    const file = await fetchFileContent(owner, repo, filePath, meta.default_branch, githubUserToken);
    if (file) files.push(file);
  }

  if (files.length === 0 && allPaths.length > 0) {
    throw new GithubApiError(
      `Could not read source files from ${owner}/${repo}. For private repos, sign in with GitHub or set GITHUB_TOKEN.`,
      403,
      "GITHUB_NO_FILES"
    );
  }

  return {
    fullName: meta.full_name,
    defaultBranch: meta.default_branch,
    files,
    allPaths,
  };
}
