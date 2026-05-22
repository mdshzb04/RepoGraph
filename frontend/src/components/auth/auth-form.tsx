import { DefiLogo } from "@/components/brand/logo";
import { GithubSignInButton } from "@/components/auth/github-sign-in-button";
import { PRODUCTION_SITE_URL, GITHUB_OAUTH_CALLBACK_PATH } from "@/lib/auth-config";

type AuthFormProps = {
  githubOauthEnabled?: boolean;
  authError?: string;
  configWarnings?: string[];
};

export function AuthForm({
  githubOauthEnabled = false,
  authError,
  configWarnings = [],
}: AuthFormProps) {
  return (
    <div className="auth-page">
      <div className="auth-brand" aria-hidden>
        <DefiLogo size={52} />
      </div>

      <div className="auth-glow auth-glow--primary" aria-hidden />
      <div className="auth-glow auth-glow--secondary" aria-hidden />
      <div className="auth-grid" aria-hidden />

      <div className="auth-content">
        <div className="auth-card">
          <header className="auth-header">
            <p className="auth-eyebrow">AI GitHub Engineering Copilot</p>
            <h1 className="auth-title">Copilot for developers</h1>
            <p className="auth-description">
              Chat with repos, map architecture, and search code semantically.
            </p>
          </header>

          {authError && (
            <p className="auth-error" role="alert">
              {authError}
            </p>
          )}

          {configWarnings.length > 0 && (
            <p className="auth-error text-sm" role="status">
              {configWarnings[0]}
            </p>
          )}

          {githubOauthEnabled ? (
            <GithubSignInButton />
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
