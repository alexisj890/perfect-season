// Google sign-in comes back here with a one-time ?code=. Swapping it for a
// session sets the sign-in cookies, then we send the player back into the game.

import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/supabase/redirect";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await serverSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/?auth=error`);
}
