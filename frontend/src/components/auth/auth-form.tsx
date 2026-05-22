import { DefiLogo } from "@/components/brand/logo";
import { GithubSignInButton } from "@/components/auth/github-sign-in-button";

export function AuthForm({ githubOauthEnabled = false }: { githubOauthEnabled?: boolean }) {
  return (
    <div className="auth-page">
      <button
        type="button"
        className="auth-brand"
        onClick={() => window.location.reload()}
        aria-label="Reload page"
      >
        <DefiLogo size={52} />
      </button>

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

          {githubOauthEnabled ? (
            <GithubSignInButton />
          ) : (
            <p className="auth-error" role="alert">
              GitHub sign-in is not configured. Set AUTH_GITHUB_ID and AUTH_GITHUB_SECRET.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
