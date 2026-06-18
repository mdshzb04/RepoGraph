"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DefiLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { performSignOut } from "@/lib/perform-sign-out";
import { cn } from "@/lib/utils";

type LogoutModalProps = {
  open: boolean;
  onClose: () => void;
};

export function LogoutModal({ open, onClose }: LogoutModalProps) {
  const [pending, setPending] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, pending]);

  async function confirm() {
    setPending(true);
    try {
      await performSignOut();
    } catch {
      setPending(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/70 backdrop-blur-md"
        aria-label="Cancel"
        disabled={pending}
        onClick={onClose}
      />
      <div
        className={cn(
          "copilot-glass engintel-logout-panel relative z-[1] w-full max-w-sm rounded-2xl p-6 shadow-2xl",
          "border border-border/50"
        )}
      >
        <div className="flex flex-col items-center text-center">
          <DefiLogo size={44} className="mb-4" />
          <h2
            id="logout-title"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Sign out of EngIntel?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You will leave this workspace. Unsaved chat in this tab will be cleared.
          </p>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
