// Account status in the header. Everyone is a guest until Google sign-in is
// built (with database saves, end of Milestone 6).

export function HeaderAccount() {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted">Guest</span>
      <span className="text-border" aria-hidden="true">
        ·
      </span>
      <button
        type="button"
        aria-disabled="true"
        title="Google sign-in is coming soon"
        className="cursor-not-allowed text-muted underline-offset-4 hover:underline"
      >
        Sign in
      </button>
    </div>
  );
}
