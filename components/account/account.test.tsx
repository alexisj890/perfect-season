// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthDialog, friendlyError } from "./AuthDialog";

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

  it("creates an account and asks the player to confirm their email", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: "u1" } }, error: null });
    render(<AuthDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("dialog", { name: "Create an account" })).toBeTruthy();
    fill("Email", "new@example.com");
    fill("Password", "short");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/at least 8 characters/);
    expect(auth.signUp).not.toHaveBeenCalled();

    fill("Password", "long enough pass");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/Check new@example.com/);
    expect(auth.signUp.mock.calls[0][0]).toMatchObject({
      email: "new@example.com",
      password: "long enough pass",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2F%3Fauth%3Dconfirmed" },
    });
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

describe("friendlyError", () => {
  it("passes unknown messages through", () => {
    expect(friendlyError(new Error("Something odd"))).toBe("Something odd");
  });
});
