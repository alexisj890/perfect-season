// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthDialog, friendlyError, looksLikeEmail } from "./AuthDialog";

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithOAuth: vi.fn(),
};
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ auth }) }));
const providers = { email: true, google: true };
vi.mock("@/lib/supabase/providers", () => ({ enabledProviders: async () => providers }));

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset().mockResolvedValue({ data: {}, error: null });
  providers.google = true;
});
afterEach(cleanup);

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("AuthDialog", () => {
  it("signs in with email and password, then closes", async () => {
    const onClose = vi.fn();
    render(<AuthDialog open onClose={onClose} />);
    fill("Email", "alexis@example.com");
    fill("Password", "correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "alexis@example.com", password: "correct horse" });
  });

  it("explains a wrong password in plain words", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: new Error("Invalid login credentials") });
    render(<AuthDialog open onClose={() => {}} />);
    fill("Email", "alexis@example.com");
    fill("Password", "nope");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toBe("That email and password don't match an account.");
  });

  it("creates an account once the password meets every rule and is typed twice", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: "u1" } }, error: null });
    render(<AuthDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("dialog", { name: "Create an account" })).toBeTruthy();
    fill("Email", "new@example.com");

    // Too weak: the error says exactly what's missing.
    fill("Password", "lowercase");
    fill("Confirm password", "lowercase");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Your password still needs: a capital letter (A–Z), a number (0–9), a symbol, such as ! ? # or @.",
    );
    expect(auth.signUp).not.toHaveBeenCalled();

    // Strong, but the two don't match.
    fill("Password", "Strong#Pass1");
    fill("Confirm password", "Strong#Pass2");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The two passwords don't match.");
    expect(auth.signUp).not.toHaveBeenCalled();

    fill("Confirm password", "Strong#Pass1");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/Check new@example.com/);
    expect(auth.signUp.mock.calls[0][0]).toMatchObject({
      email: "new@example.com",
      password: "Strong#Pass1",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2F%3Fauth%3Dconfirmed" },
    });
  });

  it("ticks off each password rule as it's met", () => {
    render(<AuthDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    const rules = () => screen.getByRole("list", { name: "Password needs" }).textContent!;
    expect(rules()).toContain("✗ A capital letter");
    fill("Password", "Abc");
    expect(rules()).toContain("✓ A capital letter");
    expect(rules()).toContain("✗ At least 8 characters");
  });

  it("shows and hides what's typed in a password box", () => {
    render(<AuthDialog open onClose={() => {}} />);
    const field = screen.getByLabelText("Password") as HTMLInputElement;
    expect(field.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field.type).toBe("password");
  });

  it("puts the cursor back in Email after switching to Create account", async () => {
    render(<AuthDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Email")));
  });

  it("asks for the password only once when signing in", () => {
    render(<AuthDialog open onClose={() => {}} />);
    expect(screen.queryByLabelText("Confirm password")).toBeNull();
    expect(screen.queryByRole("list", { name: "Password needs" })).toBeNull();
  });

  it("sends a reset link without saying whether the account exists", async () => {
    render(<AuthDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fill("Email", "who@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/If who@example.com has an account/);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("who@example.com", {
      redirectTo: "http://localhost:3000/auth/callback?next=%2Faccount%2Freset-password",
    });
  });

  it("only offers Google once it's switched on in Supabase", async () => {
    providers.google = false;
    render(<AuthDialog open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();
  });

  it("starts Google sign-in, coming back through /auth/callback to the same page", async () => {
    render(<AuthDialog open onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalled());
    expect(auth.signInWithOAuth.mock.calls[0][0]).toEqual({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/auth/callback?next=%2F" },
    });
  });

  it("says when Google isn't switched on yet", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: new Error("Unsupported provider: provider is not enabled") });
    render(<AuthDialog open onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Google sign-in isn't switched on/);
  });
});

describe("email check", () => {
  it("says the email isn't valid while typing, until it looks like one", () => {
    render(<AuthDialog open onClose={() => {}} />);
    const field = screen.getByLabelText("Email");
    expect(screen.queryByText(/Enter a valid email/)).toBeNull(); // nothing typed yet
    for (const partial of ["a", "alexis", "alexis@", "alexis@gmail", "alexis@gmail."]) {
      fill("Email", partial);
      expect(screen.getByText(/Enter a valid email/), partial).toBeTruthy();
      expect(field.getAttribute("aria-invalid")).toBe("true");
    }
    fill("Email", "alexis@gmail.com");
    expect(screen.queryByText(/Enter a valid email/)).toBeNull();
    expect(field.getAttribute("aria-invalid")).toBe("false");
  });

  it("won't send a request for an email that isn't valid", async () => {
    render(<AuthDialog open onClose={() => {}} />);
    fill("Email", "alexis@gmail");
    fill("Password", "whatever");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Enter a valid email, like name@example.com.");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("accepts ordinary addresses and rejects typos", () => {
    for (const ok of ["a@b.co", "first.last+tag@sub.example.org", " padded@example.com "]) expect(looksLikeEmail(ok), ok).toBe(true);
    for (const bad of ["", "plain", "no@dot", "two@@example.com", "space in@example.com", "trailing@dot."]) expect(looksLikeEmail(bad), bad).toBe(false);
  });
});

describe("friendlyError", () => {
  it("passes unknown messages through", () => {
    expect(friendlyError(new Error("Something odd"))).toBe("Something odd");
  });
});
