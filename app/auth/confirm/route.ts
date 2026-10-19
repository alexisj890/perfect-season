// Links in Supabase's emails come here (see the email templates in
// docs/supabase-setup.md): ?token_hash=…&type=email confirms a new account,
// &type=recovery starts a password reset. Checking the token signs the player
// in, then we send them on (?next=, e.g. the reset-password page).

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/supabase/redirect";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), type === "recovery" ? "/account/reset-password" : "/?auth=confirmed");

  if (tokenHash && type) {
    const supabase = await serverSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/?auth=error`);
}
