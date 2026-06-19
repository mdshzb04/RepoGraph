/** Production GitHub OAuth callback — must match GitHub App settings exactly. */
export const GITHUB_OAUTH_CALLBACK_PATH = "/api/auth/callback/github";

export const PRODUCTION_SITE_URL = "https://repograph.shazeb.site";

function trim(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

function vercelOrigin(): string | undefined {
  const host = trim(process.env.VERCEL_URL);
  return host ? `https://${host}` : undefined;
}

export function resolveAuthEnv() {
  const isProd = process.env.NODE_ENV === "production";
  const secret = trim(process.env.AUTH_SECRET) ?? trim(process.env.NEXTAUTH_SECRET);
  const siteUrl =
    trim(process.env.AUTH_URL) ??
    trim(process.env.NEXTAUTH_URL) ??
    vercelOrigin() ??
    (isProd ? undefined : "http://localhost:3000");
  const githubId =
    trim(process.env.AUTH_GITHUB_ID) ?? trim(process.env.GITHUB_ID);
  const githubSecret =
    trim(process.env.AUTH_GITHUB_SECRET) ?? trim(process.env.GITHUB_SECRET);
  const callbackUrl = siteUrl
    ? `${siteUrl.replace(/\/$/, "")}${GITHUB_OAUTH_CALLBACK_PATH}`
    : undefined;

  return { secret, siteUrl, githubId, githubSecret, callbackUrl };
}

export function getAuthConfigStatus() {
  const env = resolveAuthEnv();
  const warnings: string[] = [];
  const isProd = process.env.NODE_ENV === "production";

  if (!env.secret) {
    warnings.push("Set AUTH_SECRET (or NEXTAUTH_SECRET) in Vercel.");
  }
  if (!env.siteUrl && isProd) {
    warnings.push(
      `Set AUTH_URL (or NEXTAUTH_URL) to ${PRODUCTION_SITE_URL} in Vercel.`
    );
  } else if (isProd && env.siteUrl && !env.siteUrl.includes("repograph.shazeb.site")) {
    warnings.push(
      `AUTH_URL is ${env.siteUrl}; expected ${PRODUCTION_SITE_URL} for production OAuth.`
    );
  }
  if (!env.githubId || !env.githubSecret) {
    warnings.push("Set AUTH_GITHUB_ID and AUTH_GITHUB_SECRET (or GITHUB_ID / GITHUB_SECRET).");
  }
  if (isProd && env.callbackUrl !== `${PRODUCTION_SITE_URL}${GITHUB_OAUTH_CALLBACK_PATH}`) {
    warnings.push(
      `GitHub callback should be ${PRODUCTION_SITE_URL}${GITHUB_OAUTH_CALLBACK_PATH} (got ${env.callbackUrl ?? "none"}).`
    );
  }

  if (warnings.length && isProd) {
    console.error("[auth] config issues:", warnings);
  }

  return {
    ...env,
    githubOauthEnabled: Boolean(env.githubId && env.githubSecret),
    warnings,
    ready: Boolean(
      env.secret && env.siteUrl && env.githubId && env.githubSecret
    ),
  };
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    "Auth is misconfigured. In Vercel set AUTH_SECRET, AUTH_URL=https://repograph.shazeb.site, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET. GitHub OAuth callback must be https://repograph.shazeb.site/api/auth/callback/github",
  AccessDenied: "GitHub authorization was cancelled.",
  Verification: "Sign-in link expired. Try again.",
  OAuthSignin: "Could not start GitHub sign-in. Check OAuth app credentials.",
  OAuthCallback: "GitHub callback failed. Confirm callback URL and secrets match Vercel.",
  OAuthCreateAccount: "Could not create session from GitHub account.",
  CallbackRouteError: "Auth callback error. Check Vercel logs for [auth].",
  Default: "Sign-in failed. Try again with GitHub.",
};

export function getAuthErrorMessage(code: string | undefined): string {
  if (!code) return AUTH_ERROR_MESSAGES.Default;
  return AUTH_ERROR_MESSAGES[code] ?? AUTH_ERROR_MESSAGES.Default;
}

export function shouldLogAuthPath(pathname: string): boolean {
  return (
    pathname.includes("/callback/") ||
    pathname.includes("/signin/") ||
    pathname.includes("/error") ||
    pathname.endsWith("/session")
  );
}
