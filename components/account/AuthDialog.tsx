"use client";

// The account pop-up: sign in, create an account, or reset a password, by
// email or with Google. Supabase Auth does the work; this is just the forms.
//
// - Create account sends a confirmation email. With Supabase's default email
//   templates, its link confirms the account on Supabase, which then sends the
//   player to /auth/callback with a one-time code (the same route Google uses);
//   that signs them in. (The code only works in the browser that signed up.)
// - Google goes to Google and back through /auth/callback.
// - Forgot password emails a link that comes back the same way, then on to
//   /account/reset-password.
// - With a custom email server, the templates can link to /auth/confirm
//   instead, which works from any browser (docs/supabase-setup.md, A4).

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "./PasswordField";
import { describeProblems, passwordProblems } from "./passwordRules";
import { browserSupabase } from "@/lib/supabase/client";
import { enabledProviders } from "@/lib/supabase/providers";

type View = "signIn" | "signUp" | "reset";

const TITLE: Record<View, string> = { signIn: "Sign in", signUp: "Create an account", reset: "Reset your password" };

interface Props {
  open: boolean;
  onClose: () => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
}

export function AuthDialog({ open, onClose, returnFocusTo }: Props) {
  const [view, setView] = useState<View>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Only offer Google once it's switched on in Supabase (docs/supabase-setup.md, A5).
  const [googleOn, setGoogleOn] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true;
    enabledProviders().then((p) => live && setGoogleOn(p.google));
    return () => {
      live = false;
    };
  }, [open]);

  const reset = () => {
    setView("signIn");
    setPassword("");
    setConfirm("");
    setBusy(false);
    setError(null);
    setNotice(null);
  };
  // Next.js keeps pages alive in the background; don't show a stale form later.
  useLayoutEffect(() => reset, []);

  const close = () => {
    reset();
    onClose();
  };
  // Switching between Sign in / Create account / Reset removes the link that was
  // clicked, so put the cursor back in the email box rather than nowhere.
  const emailField = useRef<HTMLInputElement>(null);
  const switchTo = (next: View) => {
    setView(next);
    setError(null);
    setNotice(null);
    requestAnimationFrame(() => emailField.current?.focus());
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!looksLikeEmail(email)) {
      setError(EMAIL_HINT + ".");
      emailField.current?.focus();
      return;
    }
    if (view === "signUp") {
      const missing = passwordProblems(password);
      if (missing.length > 0) {
        setError(describeProblems(missing));
        return;
      }
      if (password !== confirm) {
        setError("The two passwords don't match.");
        return;
      }
    }
    setBusy(true);
    const auth = browserSupabase().auth;
    const address = email.trim(); // a stray space from copy-paste shouldn't fail sign-in
    try {
      if (view === "signIn") {
        const { error } = await auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        close(); // CloudSync takes it from here
        return;
      }
      if (view === "signUp") {
        const { data, error } = await auth.signUp({ email: address, password, options: { emailRedirectTo: returnTo("/?auth=confirmed") } });
        if (error) throw error;
        if (data.session) {
          close(); // email confirmation is switched off: signed in already
          return;
        }
        setPassword("");
        setConfirm("");
        setNotice(`Check ${address} for a link to confirm your account, and open it in this browser. It can take a minute to arrive.`);
        return;
      }
      const { error } = await auth.resetPasswordForEmail(address, { redirectTo: returnTo("/account/reset-password") });
      if (error) throw error;
      // Supabase doesn't say whether the account exists (so nobody can check other people's emails).
      setNotice(`If ${address} has an account, a link to reset the password is on its way.`);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const next = window.location.pathname;
    const { error } = await browserSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    // On success the browser is already on its way to Google.
    if (error) setError(friendlyError(error));
  }

  const emailInvalid = email.trim() !== "" && !looksLikeEmail(email);
  const field = "rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:border-accent";

  return (
    <Modal open={open} onClose={close} title={TITLE[view]} returnFocusTo={returnFocusTo} narrow>
      {view !== "reset" && googleOn && (
        <>
          <button
            type="button"
            onClick={google}
            className="flex items-center justify-center gap-3 rounded-full border border-border px-4 py-2.5 font-semibold hover:border-accent"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            or with email
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="auth-email" className="text-muted">
            Email
          </label>
          <input
            ref={emailField}
            id="auth-email"
            data-autofocus
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={emailInvalid}
            aria-describedby={emailInvalid ? "auth-email-hint" : undefined}
            className={`${field} ${emailInvalid ? "border-danger" : ""}`}
          />
          {/* Shown as soon as there's something typed that isn't an email yet. */}
          {emailInvalid && (
            <span id="auth-email-hint" className="text-xs text-danger">
              <span aria-hidden="true">✗ </span>
              {EMAIL_HINT}
            </span>
          )}
        </div>
        {view !== "reset" && (
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete={view === "signUp" ? "new-password" : "current-password"}
            showRules={view === "signUp"}
          />
        )}
        {view === "signUp" && (
          <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        )}
        {/* Outside the label, so the field's name stays just "Password". */}
        {view === "signIn" && (
          <button
            type="button"
            onClick={() => switchTo("reset")}
            className="-mt-1 self-end text-sm text-muted underline underline-offset-4 hover:text-foreground"
          >
            Forgot password?
          </button>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-md border border-accent px-3 py-2 text-sm">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-foreground hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "One moment…" : view === "signIn" ? "Sign in" : view === "signUp" ? "Create account" : "Send reset link"}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        {view === "signIn" ? (
          <>
            New here?{" "}
            <button type="button" onClick={() => switchTo("signUp")} className="font-semibold text-foreground underline underline-offset-4">
              Create an account
            </button>
          </>
        ) : (
          <>
            {view === "signUp" ? "Already have an account? " : "Remembered it? "}
            <button type="button" onClick={() => switchTo("signIn")} className="font-semibold text-foreground underline underline-offset-4">
              Sign in
            </button>
          </>
        )}
      </p>
      <p className="text-center text-xs text-muted">Signed in, your run is saved to your account and follows you to any device.</p>
    </Modal>
  );
}

// Looks like an email address: something@something.something, no spaces.
// (Supabase does the real check; this just catches typos as you type.)
export function looksLikeEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim());
}

export const EMAIL_HINT = "Enter a valid email, like name@example.com";

// Where an email link brings the player back: through /auth/callback, which
// signs them in, then on to `next`.
function returnTo(next: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

// Supabase's messages, in plainer words where they're unclear.
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid login credentials/i.test(message)) return "That email and password don't match an account.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first: check your inbox for the link.";
  if (/user already registered/i.test(message)) return "There's already an account with that email. Try signing in.";
  if (/provider is not enabled/i.test(message)) return "Google sign-in isn't switched on yet. Use email for now.";
  if (/rate limit|too many/i.test(message)) return "Too many tries. Please wait a few minutes and try again.";
  if (/fetch|network/i.test(message)) return "Can't reach the server. Check your connection and try again.";
  return message;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6H1.4a12 12 0 0 0 0 10.8l4-3z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}
