// What a new password needs. Match these in Supabase too (Authentication →
// Providers → Email → minimum length 8, "Lowercase, uppercase letters, digits
// and symbols"), so the rule also holds if someone skips this form.

export const MIN_PASSWORD = 8;

export const PASSWORD_RULES: { label: string; test: (password: string) => boolean }[] = [
  { label: `At least ${MIN_PASSWORD} characters`, test: (p) => p.length >= MIN_PASSWORD },
  { label: "A capital letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "A lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { label: "A number (0–9)", test: (p) => /[0-9]/.test(p) },
  { label: "A symbol, such as ! ? # or @", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export function passwordProblems(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.label);
}

// "Your password still needs: a capital letter (A–Z), a number (0–9)."
export function describeProblems(missing: string[]): string {
  return `Your password still needs: ${missing.map((m) => m[0].toLowerCase() + m.slice(1)).join(", ")}.`;
}
