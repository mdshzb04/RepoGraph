"use client";

import { GithubMark } from "@/components/icons/github-mark";
import { signInWithGithub } from "@/actions/github-oauth";

export function GithubSignInButton() {
  return (
    <div className="flex flex-col gap-3">
      <form action={signInWithGithub}>
        <button type="submit" className="auth-github-btn w-full">
          <GithubMark className="size-5 shrink-0" />
          Continue with GitHub
        </button>
      </form>
      <form action={signInWithGithub}>
        <input type="hidden" name="switchAccount" value="1" />
        <button type="submit" className="auth-footer-link w-full text-center text-sm">
          Use a different GitHub account
        </button>
      </form>
    </div>
  );
}
