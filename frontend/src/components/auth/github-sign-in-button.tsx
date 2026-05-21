"use client";

import { GithubMark } from "@/components/icons/github-mark";
import { signInWithGithub } from "@/actions/github-oauth";

export function GithubSignInButton() {
  return (
    <form action={signInWithGithub}>
      <button type="submit" className="auth-github-btn">
        <GithubMark className="size-5 shrink-0" />
        Continue with GitHub
      </button>
    </form>
  );
}
