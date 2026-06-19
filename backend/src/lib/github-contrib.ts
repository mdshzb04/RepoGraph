import { readGithubJson } from "./github-response";

export type GithubRepoMeta = {
  stars: number;
  forks: number;
  openIssues: number;
};

export type GithubContributor = {
  login: string;
  avatarUrl: string;
  totalContributions: number;
  weekCommits: number;
  monthCommits: number;
};

export type GithubContribSnapshot = {
  meta: GithubRepoMeta;
  contributors: GithubContributor[];
  openPrs: number;
  mergedPrsByLogin: Record<string, number>;
  reviewsByLogin: Record<string, number>;
};

function githubHeaders(token?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "engineering-intelligence-platform",
  };
  const t = token?.trim() || process.env.GITHUB_TOKEN?.trim() || "";
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

function parseOwnerRepo(fullName: string): { owner: string; repo: string } | null {
  const parts = fullName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

function weekIndex(now = Date.now()): number {
  return Math.floor(now / (7 * 24 * 60 * 60 * 1000));
}

export async function fetchGithubContribSnapshot(
  fullName: string,
  githubUserToken?: string | null
): Promise<GithubContribSnapshot | null> {
  const parsed = parseOwnerRepo(fullName);
  if (!parsed) return null;
  const { owner, repo } = parsed;
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = githubHeaders(githubUserToken);

  try {
    const metaRes = await fetch(base, { headers });
    if (!metaRes.ok) return null;
    const metaJson = await readGithubJson<{
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
    }>(metaRes);

    const contribRes = await fetch(`${base}/contributors?per_page=24&anon=0`, { headers });
    const contribList = contribRes.ok
      ? await readGithubJson<{ login?: string; avatar_url?: string; contributions: number }[]>(
          contribRes
        )
      : [];

    const statsRes = await fetch(`${base}/stats/contributors`, { headers });
    let statsAuthors: {
      author?: { login?: string };
      weeks?: { w: number; c: number }[];
    }[] = [];
    if (statsRes.ok) {
      statsAuthors = await readGithubJson<typeof statsAuthors>(statsRes);
    }

    const currentWeek = weekIndex();
    const commitsByLogin = new Map<string, { week: number; month: number; total: number }>();

    for (const row of statsAuthors) {
      const login = row.author?.login;
      if (!login) continue;
      let week = 0;
      let month = 0;
      let total = 0;
      for (const wk of row.weeks ?? []) {
        const commits = wk.c ?? 0;
        total += commits;
        const age = currentWeek - wk.w;
        if (age <= 0) week += commits;
        if (age <= 3) month += commits;
      }
      commitsByLogin.set(login, { week, month, total });
    }

    const contributors: GithubContributor[] = contribList
      .filter((c) => c.login)
      .map((c) => {
        const login = c.login!;
        const stats = commitsByLogin.get(login);
        return {
          login,
          avatarUrl: c.avatar_url ?? "",
          totalContributions: c.contributions ?? 0,
          weekCommits: stats?.week ?? 0,
          monthCommits: stats?.month ?? Math.min(c.contributions ?? 0, stats?.total ?? 0),
        };
      })
      .sort((a, b) => b.totalContributions - a.totalContributions)
      .slice(0, 16);

    const openPrRes = await fetch(`${base}/pulls?state=open&per_page=1`, { headers });
    let openPrs = 0;
    if (openPrRes.ok) {
      const link = openPrRes.headers.get("link");
      const lastMatch = link?.match(/page=(\d+)>; rel="last"/);
      if (lastMatch) openPrs = Number(lastMatch[1]);
      else {
        const arr = await readGithubJson<unknown[]>(openPrRes);
        openPrs = arr.length;
      }
    }

    const mergedPrsByLogin: Record<string, number> = {};
    const reviewsByLogin: Record<string, number> = {};
    const searchRes = await fetch(
      `https://api.github.com/search/issues?q=repo:${owner}/${repo}+type:pr+is:merged&per_page=30&sort=updated`,
      { headers }
    );
    if (searchRes.ok) {
      const search = await readGithubJson<{
        items?: { user?: { login?: string }; pull_request?: { merged_at?: string | null } }[];
      }>(searchRes);
      for (const item of search.items ?? []) {
        if (!item.pull_request?.merged_at || !item.user?.login) continue;
        const login = item.user.login;
        mergedPrsByLogin[login] = (mergedPrsByLogin[login] ?? 0) + 1;
      }
    }

    for (const c of contributors.slice(0, 8)) {
      reviewsByLogin[c.login] = Math.floor(
        (mergedPrsByLogin[c.login] ?? 0) * 0.35 + c.monthCommits * 0.05
      );
    }

    return {
      meta: {
        stars: metaJson.stargazers_count ?? 0,
        forks: metaJson.forks_count ?? 0,
        openIssues: metaJson.open_issues_count ?? 0,
      },
      contributors,
      openPrs,
      mergedPrsByLogin,
      reviewsByLogin,
    };
  } catch {
    return null;
  }
}
