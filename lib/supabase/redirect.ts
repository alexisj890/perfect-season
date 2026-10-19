// Where to send someone after a sign-in link: only a path on this site, so a
// crafted link can't bounce people to another website ("open redirect").

export function safeNext(next: string | null, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
