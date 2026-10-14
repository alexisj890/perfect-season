// Shown while the page waits for the browser to load the saved run.
export function Loading({ label = "Loading your season…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-muted" role="status">
      {label}
    </div>
  );
}
