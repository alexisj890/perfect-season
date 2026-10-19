"use client";

// Account status in the header: "Guest · Sign in", or the signed-in email, how
// the account save is going, and Sign out. Without Supabase set up (no keys in
// .env.local) accounts are hidden behind a disabled "Sign in".

import { useLayoutEffect, useRef, useState } from "react";
import { AuthDialog } from "@/components/account/AuthDialog";
import { flushCloudSave, useSyncStatus, type SyncStatus } from "@/components/cloud/syncStatus";
import { useAuth } from "@/components/useAuth";
import { browserSupabase } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

const STATUS: Record<SyncStatus, string | null> = {
  idle: null,
  saving: "Saving…",
  saved: "Saved to your account",
  error: "Not saved to your account yet (saved on this computer)",
};

export function HeaderAccount() {
  const user = useAuth();
  const status = useSyncStatus();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => () => setOpen(false), []);

  if (!supabaseConfigured) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">Guest</span>
        <button type="button" aria-disabled="true" title="Accounts aren't set up on this copy of the game" className="cursor-not-allowed text-muted">
          Sign in
        </button>
      </div>
    );
  }

  // Hold the space while the session is checked, so the header doesn't jump.
  if (user === undefined) return <div className="h-5 w-32" aria-hidden="true" />;

  if (user === null) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">Guest</span>
        <span className="text-muted" aria-hidden="true">
          ·
        </span>
        <button ref={button} type="button" onClick={() => setOpen(true)} className="font-semibold underline-offset-4 hover:underline">
          Sign in
        </button>
        <AuthDialog open={open} onClose={() => setOpen(false)} returnFocusTo={button} />
      </div>
    );
  }

  async function signOut() {
    setSigningOut(true);
    await flushCloudSave(); // send any last change first
    await browserSupabase().auth.signOut();
    setSigningOut(false);
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex flex-col items-end leading-tight">
        <span className="max-w-56 truncate font-semibold" title={user.email ?? undefined}>
          {user.email ?? "Signed in"}
        </span>
        {STATUS[status] && (
          <span role="status" className={`text-xs ${status === "error" ? "text-danger" : "text-muted"}`}>
            {STATUS[status]}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="whitespace-nowrap rounded-full border border-border px-3 py-1 font-semibold hover:border-accent disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
