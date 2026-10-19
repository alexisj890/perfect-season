// The Supabase client for browser code (client components). It keeps the
// signed-in session in cookies, so the server routes in app/auth/ can read it
// to finish a Google sign-in or an email link, and refreshes it by itself.
// createBrowserClient returns the same instance on every call.

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

export function browserSupabase() {
  if (!supabaseConfigured) throw new Error("Supabase isn't configured (see docs/supabase-setup.md, step A2)");
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
