"use client";

import { useState } from "react";
import { LogoutModal } from "@/components/auth/logout-modal";

/** Replaces NextAuth default sign-out page with EngIntel UI. */
export default function SignOutPage() {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <LogoutModal
        open={open}
        onClose={() => {
          setOpen(false);
          window.location.href = "/";
        }}
      />
    </div>
  );
}
