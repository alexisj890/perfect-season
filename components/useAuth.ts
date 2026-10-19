"use client";

// Who's signed in, shared by every component (like useSavedRun). Supabase tells
// us about every change (sign-in, sign-out, a token refresh, another tab), and
// this keeps one copy of the answer.
//
//   undefined  still checking (first moments after the page loads)
//   null       a guest
//   AuthUser   signed in

import { useSyncExternalStore } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

export interface AuthUser {
  id: string;
  email: string | null;
}

let current: AuthUser | null | undefined = undefined;
let started = false;
const listeners = new Set<() => void>();

function set(user: AuthUser | null) {
  if (current?.id === user?.id && current !== undefined) return;
  current = user;
  for (const listener of listeners) listener();
}

function start() {
  if (started) return;
  started = true;
  if (!supabaseConfigured) {
    set(null);
    return;
  }
  // Fires once straight away with the current session, then on every change.
  browserSupabase().auth.onAuthStateChange((_event, session) => {
    set(session ? { id: session.user.id, email: session.user.email ?? null } : null);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

export function useAuth(): AuthUser | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => undefined,
  );
}
