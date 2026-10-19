"use client";

// A one-line message after an email link or Google sign-in brings the player
// back: /?auth=confirmed ("you're signed in") or /?auth=error. Uses the URL,
// so it renders inside <Suspense> (see app/layout.tsx).

import { useRouter, useSearchParams } from "next/navigation";

const MESSAGES = {
  confirmed: { text: "Your email is confirmed and you're signed in. Your runs now save to your account.", error: false },
  error: {
    text: "That sign-in link didn't work. It may have expired or been used already, or been opened in a different browser from the one you signed up in. Please try again.",
    error: true,
  },
} as const;

export function AuthNotice() {
  const router = useRouter();
  const params = useSearchParams();
  const key = params.get("auth");
  if (key !== "confirmed" && key !== "error") return null;
  const message = MESSAGES[key];

  const dismiss = () => {
    const next = new URLSearchParams(params);
    next.delete("auth");
    const query = next.toString();
    router.replace(query ? `?${query}` : window.location.pathname, { scroll: false });
  };

  return (
    <div
      role={message.error ? "alert" : "status"}
      className={`mx-auto mb-4 flex w-full max-w-6xl items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
        message.error ? "border-danger text-danger" : "border-accent"
      }`}
    >
      <span>{message.text}</span>
      <button type="button" onClick={dismiss} className="font-semibold underline underline-offset-4">
        Dismiss
      </button>
    </div>
  );
}
