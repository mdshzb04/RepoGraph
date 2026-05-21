"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { DefiLogo } from "@/components/brand/logo";
import { GithubSignInButton } from "@/components/auth/github-sign-in-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthMode = "signup" | "signin";

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function isValidEmailClient(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized);
}

export function AuthForm({
  githubOauthEnabled = false,
}: {
  githubOauthEnabled?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isValidEmailClient(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const endpoint =
        mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

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
              Chat with repos, map architecture, and search code semantically —
              RAG, embeddings, and streaming AI in one place.
            </p>
            <p className="auth-form-hint">
              {mode === "signup"
                ? "Create an account to get started."
                : "Sign in to your account."}
            </p>
          </header>

          <div
            className="auth-segment"
            data-active={mode}
            role="tablist"
            aria-label="Authentication mode"
          >
            <span className="auth-segment__pill" aria-hidden />
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => switchMode("signup")}
              className={cn("auth-segment__btn", mode === "signup" && "is-active")}
            >
              Create Account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => switchMode("signin")}
              className={cn("auth-segment__btn", mode === "signin" && "is-active")}
            >
              Sign In
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email" className="auth-label">
                Email address
              </label>
              <div className="auth-input-wrap">
                <Mail className="auth-input-icon" aria-hidden />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="auth-input"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-label">
                Password
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" aria-hidden />
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="auth-input"
                />
              </div>
            </div>

            <div
              className={cn(
                "auth-field--confirm",
                mode === "signup" && "is-visible"
              )}
            >
              <div className="auth-field">
                <label htmlFor="confirmPassword" className="auth-label">
                  Confirm password
                </label>
                <div className="auth-input-wrap">
                <Lock className="auth-input-icon" aria-hidden />
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={mode === "signup"}
                  minLength={8}
                  className="auth-input"
                  tabIndex={mode === "signup" ? 0 : -1}
                />
                </div>
              </div>
            </div>

            {error && (
              <p role="alert" className="auth-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="auth-submit group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {mode === "signup" ? "Creating account…" : "Signing in…"}
                </>
              ) : (
                <>
                  {mode === "signup" ? "Create Account" : "Sign In"}
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          {githubOauthEnabled && (
            <>
              <div className="auth-oauth-divider" aria-hidden>
                <span>or</span>
              </div>

              <GithubSignInButton />
            </>
          )}

          <p className="auth-footer">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="auth-footer-link"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="auth-footer-link"
                >
                  Create an account
                </button>
              </>
            )}
          </p>
        </div>

      </div>
    </div>
  );
}
