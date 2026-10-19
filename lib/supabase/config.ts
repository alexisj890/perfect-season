// The Supabase project the app talks to, from .env.local (see .env.example and
// docs/supabase-setup.md). NEXT_PUBLIC_ values are built into the browser code,
// which is fine: the publishable key can only do what Row Level Security allows.
//
// Without them the game still works, guest-only: accounts are simply hidden.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseConfigured = SUPABASE_URL !== "" && SUPABASE_PUBLISHABLE_KEY !== "";
