"use client";

// Choosing a new password. The reset email's link goes through /auth/confirm,
// which signs the player in, then brings them here.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { friendlyError } from "@/components/account/AuthDialog";
import { PasswordField } from "@/components/account/PasswordField";
import { describeProblems, passwordProblems } from "@/components/account/passwordRules";
import { useAuth } from "@/components/useAuth";
import { browserSupabase } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const user = useAuth();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user === undefined) return <p className="text-muted">Checking your link…</p>;
  if (user === null && !done) {
    return (
      <p className="text-muted">
        This reset link has expired or was already used. Use <b className="text-foreground">Sign in → Forgot password?</b> to get a
        new one.
      </p>
    );
  }
  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status">Your password is updated, and you&apos;re signed in.</p>
        <Link href="/" className="self-start rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-foreground hover:brightness-110">
          Back to the game
        </Link>
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const missing = passwordProblems(password);
    if (missing.length > 0) return setError(describeProblems(missing));
    if (password !== again) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await browserSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else setDone(true);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-muted">For {user?.email}</p>
      <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" showRules />
      <PasswordField label="Confirm new password" value={again} onChange={setAgain} autoComplete="new-password" />
      {error && (
        <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-foreground hover:brightness-110 disabled:opacity-60">
        {busy ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
