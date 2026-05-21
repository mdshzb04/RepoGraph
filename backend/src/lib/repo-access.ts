import { timingSafeEqual } from "node:crypto";

export type RepoAccessContext = {
  userSub?: string;
  userEmail?: string | null;
};

export type RepoOwnerFields = {
  indexedBySub?: string;
  indexedByEmail?: string;
};

function normalize(email: string | undefined | null): string | null {
  if (!email) return null;
  const t = email.trim().toLowerCase();
  return t.length ? t : null;
}

export function timingSafeCompare(expected: string, received: string): boolean {
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Unscoped repos (no indexedBy*) stay visible — matches legacy anonymous indexing. */
export function canAccessRepo(
  repo: RepoOwnerFields,
  ctx: RepoAccessContext
): boolean {
  const hasScopedOwner = Boolean(repo.indexedBySub || repo.indexedByEmail);
  if (!hasScopedOwner) return true;

  const sub = ctx.userSub?.trim();
  const emailNorm = normalize(ctx.userEmail);

  if (repo.indexedBySub && sub && repo.indexedBySub === sub) {
    return true;
  }

  const storedEmail = normalize(repo.indexedByEmail ?? null);
  if (storedEmail && emailNorm && storedEmail === emailNorm) {
    return true;
  }

  return false;
}

export function parseRepoAccessFromRequest(req: {
  headers: Record<string, string | string[] | undefined>;
}): RepoAccessContext {
  const h = req.headers["x-user-sub"];
  const e = req.headers["x-user-email"];
  const userSub =
    typeof h === "string" ? h.trim() || undefined : h?.[0]?.trim();
  const userEmail =
    typeof e === "string"
      ? e.trim() || undefined
      : e?.[0]?.trim();

  return { userSub, userEmail };
}
