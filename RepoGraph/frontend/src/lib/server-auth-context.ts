import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import { authCookie, normalizeEmail, verifySessionToken } from "@/lib/auth-session";

function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ??
    process.env.NEXTAUTH_SECRET?.trim() ??
    ""
  );
}

export type ServerAuthContext = {
  /** GitHub OAuth access token — never send to the browser. */
  githubAccessToken?: string;
  /** Auth.js subject (stable per GitHub user). */
  userSub?: string;
  /** Best-effort email (OAuth profile or password session). */
  userEmail?: string;
};

/**
 * Resolves identity for BFF → backend calls: NextAuth JWT first, then legacy httpOnly cookie.
 */
export async function getServerAuthContext(request: Request): Promise<ServerAuthContext> {
  const secret = getAuthSecret();
  let githubAccessToken: string | undefined;
  let userSub: string | undefined;
  let userEmail: string | undefined;

  if (secret.length) {
    try {
      const token = await getToken({ req: request, secret });
      if (token) {
        if (typeof token.accessToken === "string" && token.accessToken.length > 0) {
          githubAccessToken = token.accessToken;
        }
        if (typeof token.sub === "string" && token.sub.length > 0) {
          userSub = token.sub;
        }
        if (typeof token.email === "string" && token.email.length > 0) {
          userEmail = normalizeEmail(token.email);
        }
      }
    } catch {
      // Invalid or missing session cookie — fall through to legacy auth
    }
  }

  const jar = await cookies();
  const legacy = jar.get(authCookie.name)?.value;
  const legacyEmail = legacy ? await verifySessionToken(legacy) : null;

  if (legacyEmail) {
    userEmail = legacyEmail;
    if (!userSub) {
      userSub = `email:${legacyEmail}`;
    }
  }

  return {
    githubAccessToken,
    userSub,
    userEmail,
  };
}

export async function buildBackendAuthHeaders(
  request: Request
): Promise<Record<string, string>> {
  const ctx = await getServerAuthContext(request);
  const h: Record<string, string> = {};
  if (ctx.githubAccessToken) {
    h["x-github-user-token"] = ctx.githubAccessToken;
  }
  if (ctx.userSub) {
    h["x-user-sub"] = ctx.userSub;
  }
  if (ctx.userEmail) {
    h["x-user-email"] = ctx.userEmail;
  }
  const internal = process.env.ENGINTEL_INTERNAL_SECRET?.trim();
  if (internal) {
    h["x-engintel-internal"] = internal;
  }
  return h;
}
