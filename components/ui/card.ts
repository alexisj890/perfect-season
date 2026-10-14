// Shared look for the landing page cards: a panel that lifts slightly, casts a
// soft shadow and lights its border when hovered (or when you're typing inside
// it). No movement for people who ask their system for reduced motion.
export const card =
  // Only the hover effects animate, so switching day/night stays instant.
  "rounded-xl border border-border bg-surface p-5 transition-[translate,box-shadow,border-color] duration-200 ease-out " +
  "hover:-translate-y-1 hover:border-accent/60 hover:shadow-xl hover:shadow-black/25 " +
  "focus-within:-translate-y-1 focus-within:border-accent/60 focus-within:shadow-xl focus-within:shadow-black/25 " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-within:translate-y-0";
