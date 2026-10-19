// Which sign-in methods are switched on in the Supabase project, from its
// public settings (Authentication → Providers). Used to hide "Continue with
// Google" until Google is set up, rather than sending players to an error page.

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

export interface Providers {
  email: boolean;
  google: boolean;
}

let cached: Promise<Providers> | null = null;

export function enabledProviders(): Promise<Providers> {
  if (!supabaseConfigured) return Promise.resolve({ email: false, google: false });
  cached ??= fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`settings ${response.status}`))))
    .then((settings) => ({ email: settings?.external?.email === true, google: settings?.external?.google === true }))
    .catch(() => {
      cached = null; // try again next time
      return { email: true, google: false };
    });
  return cached;
}
