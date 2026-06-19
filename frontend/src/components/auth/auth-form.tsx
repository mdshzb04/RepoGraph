import { DefiLogo } from "@/components/brand/logo";
import { AuthBackground } from "@/components/auth/auth-background";
import { GithubSignInButton } from "@/components/auth/github-sign-in-button";
import { PRODUCTION_SITE_URL, GITHUB_OAUTH_CALLBACK_PATH } from "@/lib/auth-config";

type AuthFormProps = {
  githubOauthEnabled?: boolean;
  authError?: string;
  configWarnings?: string[];
  callbackUrl?: string;
};

export function AuthForm({
  githubOauthEnabled = false,
  authError,
  configWarnings = [],
  callbackUrl,
}: AuthFormProps) {
  return (
    <div className="auth-page">
      <div className="auth-brand" aria-hidden>
        <DefiLogo size={52} />
      </div>

      <AuthBackground />

      <div className="auth-content">
        <div className="auth-card">
          <header className="auth-header">
            <p className="auth-eyebrow">AI GitHub Engineering Copilot</p>
            <h1 className="auth-title">Copilot for developers</h1>
            <p className="auth-description">
              Chat with repos, map architecture, and search code semantically.
              Private repositories are supported when you sign in with GitHub.
            </p>
          </header>

          {authError && (
            <p className="auth-error" role="alert">
              {authError}
            </p>
          )}

          {process.env.NODE_ENV === "production" && configWarnings.length > 0 && (
            <p className="auth-error text-sm" role="status">
              {configWarnings[0]}
            </p>
          )}

          {githubOauthEnabled ? (
            <>
              <GithubSignInButton />
              {process.env.NODE_ENV !== "production" && callbackUrl && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  GitHub app → add callback URL:{" "}
                  <code className="rounded bg-muted/50 px-1 font-mono text-[10px]">
                    {callbackUrl}
                  </code>
                </p>
              )}
            </>
          ) : (
            <p className="auth-error" role="alert">
              GitHub sign-in is not configured. In Vercel set AUTH_GITHUB_ID,
              AUTH_GITHUB_SECRET, AUTH_SECRET, and AUTH_URL={PRODUCTION_SITE_URL}.
              GitHub callback: {PRODUCTION_SITE_URL}
              {GITHUB_OAUTH_CALLBACK_PATH}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
