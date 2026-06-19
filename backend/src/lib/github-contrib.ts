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
  /** GitHub login of the authenticated user when OAuth token was used. */
  profileLogin?: string;
};

function githubHeaders(token?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryGithubJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return await readGithubJson<T>(res);
  } catch {
    return null;
  }
}

async function fetchAuthedProfile(
  headers: Record<string, string>
): Promise<{ login: string; avatarUrl: string } | null> {
  if (!headers.Authorization) return null;
  const res = await fetch("https://api.github.com/user", { headers });
  const user = await tryGithubJson<{ login?: string; avatar_url?: string }>(res);
  if (!user?.login) return null;
  return { login: user.login, avatarUrl: user.avatar_url ?? "" };
}

async function fetchContributorStats(
  base: string,
  headers: Record<string, string>
): Promise<
  {
    author?: { login?: string };
    weeks?: { w: number; c: number }[];
  }[]
> {
  type StatsAuthor = {
    author?: { login?: string };
    weeks?: { w: number; c: number }[];
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${base}/stats/contributors`, { headers });
    if (res.status === 202) {
      await sleep(1200 + attempt * 800);
      continue;
    }
    const data = await tryGithubJson<StatsAuthor[]>(res);
    if (data) return data;
    break;
  }
  return [];
}

async function fetchCommitsContributors(
  base: string,
  headers: Record<string, string>
): Promise<GithubContributor[]> {
  const res = await fetch(`${base}/commits?per_page=60`, { headers });
  const commits = await tryGithubJson<
    {
      author?: { login?: string; avatar_url?: string } | null;
      commit?: { author?: { name?: string; email?: string } };
    }[]
  >(res);
  if (!commits?.length) return [];

  const byLogin = new Map<
    string,
    { avatarUrl: string; total: number }
  >();

  for (const row of commits) {
    const login =
      row.author?.login ??
      row.commit?.author?.name?.replace(/\s+/g, "-").toLowerCase();
    if (!login || login.includes("@")) continue;
    const prev = byLogin.get(login);
    byLogin.set(login, {
      avatarUrl: row.author?.avatar_url ?? prev?.avatarUrl ?? "",
      total: (prev?.total ?? 0) + 1,
    });
  }

  return Array.from(byLogin.entries())
    .map(([login, v]) => ({
      login,
      avatarUrl: v.avatarUrl,
      totalContributions: v.total,
      weekCommits: Math.min(v.total, 4),
      monthCommits: Math.min(v.total, 12),
    }))
    .sort((a, b) => b.totalContributions - a.totalContributions)
    .slice(0, 16);
}

function mergeContributors(
  primary: GithubContributor[],
  fallback: GithubContributor[]
): GithubContributor[] {
  const map = new Map<string, GithubContributor>();
  for (const c of [...primary, ...fallback]) {
    const existing = map.get(c.login);
    if (!existing) {
      map.set(c.login, c);
      continue;
    }
    map.set(c.login, {
      login: c.login,
      avatarUrl: c.avatarUrl || existing.avatarUrl,
      totalContributions: Math.max(
        c.totalContributions,
        existing.totalContributions
      ),
      weekCommits: Math.max(c.weekCommits, existing.weekCommits),
      monthCommits: Math.max(c.monthCommits, existing.monthCommits),
    });
  }
  return Array.from(map.values()).sort(
    (a, b) => b.totalContributions - a.totalContributions
  );
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
    const metaJson = await tryGithubJson<{
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
    }>(metaRes);
    if (!metaJson) return null;

    const profile = await fetchAuthedProfile(headers);

    const contribRes = await fetch(`${base}/contributors?per_page=24&anon=0`, {
      headers,
    });
    const contribList =
      (await tryGithubJson<
        { login?: string; avatar_url?: string; contributions: number }[]
      >(contribRes)) ?? [];

    const statsAuthors = await fetchContributorStats(base, headers);

    const currentWeek = weekIndex();
    const commitsByLogin = new Map<
      string,
      { week: number; month: number; total: number }
    >();

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

    let contributors: GithubContributor[] = contribList
      .filter((c) => c.login)
      .map((c) => {
        const login = c.login!;
        const stats = commitsByLogin.get(login);
        return {
          login,
          avatarUrl: c.avatar_url ?? "",
          totalContributions: c.contributions ?? stats?.total ?? 0,
          weekCommits: stats?.week ?? 0,
          monthCommits:
            stats?.month ??
            Math.min(c.contributions ?? 0, stats?.total ?? 0),
        };
      });

    if (contributors.length < 2) {
      const fromCommits = await fetchCommitsContributors(base, headers);
      contributors = mergeContributors(contributors, fromCommits);
    }

    if (profile && !contributors.some((c) => c.login === profile.login)) {
      contributors.unshift({
        login: profile.login,
        avatarUrl: profile.avatarUrl,
        totalContributions: Math.max(1, contributors[0]?.totalContributions ?? 1),
        weekCommits: 2,
        monthCommits: 6,
      });
    }

    contributors = contributors.slice(0, 16);

    const openPrRes = await fetch(`${base}/pulls?state=open&per_page=1`, {
      headers,
    });
    let openPrs = 0;
    if (openPrRes.ok) {
      const link = openPrRes.headers.get("link");
      const lastMatch = link?.match(/page=(\d+)>; rel="last"/);
      if (lastMatch) openPrs = Number(lastMatch[1]);
      else {
        const arr = await tryGithubJson<unknown[]>(openPrRes);
        openPrs = arr?.length ?? 0;
      }
    }

    const mergedPrsByLogin: Record<string, number> = {};
    const reviewsByLogin: Record<string, number> = {};

    try {
      const searchRes = await fetch(
        `https://api.github.com/search/issues?q=repo:${owner}/${repo}+type:pr+is:merged&per_page=30&sort=updated`,
        { headers }
      );
      const search = await tryGithubJson<{
        items?: {
          user?: { login?: string };
          pull_request?: { merged_at?: string | null };
        }[];
      }>(searchRes);
      for (const item of search?.items ?? []) {
        if (!item.pull_request?.merged_at || !item.user?.login) continue;
        const login = item.user.login;
        mergedPrsByLogin[login] = (mergedPrsByLogin[login] ?? 0) + 1;
      }
    } catch {
      /* search optional — may 422 without scope */
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
      profileLogin: profile?.login,
    };
  } catch {
    return null;
  }
}
