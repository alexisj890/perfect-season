"use client";

// A dialog over a dimmed page. Closes with the X button, the Escape key, or a
// click outside. Focus moves into the dialog when it opens, stays inside it
// while it's open (Tab wraps around), and returns to `returnFocusTo` on close.

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  headerExtra?: ReactNode; // shown beside the title (e.g. stats)
  returnFocusTo?: RefObject<HTMLElement | null>;
  wide?: boolean; // for content like a full pitch
  narrow?: boolean; // for small forms
  children: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, headerExtra, returnFocusTo, wide = false, narrow = false, children }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const returnTarget = returnFocusTo?.current;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      // Keep Tab inside the dialog.
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnTarget?.focus();
    };
  }, [open, onClose, returnFocusTo]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        // Only a click on the dimmed area itself closes, not one inside the dialog.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[calc(100dvh-4rem)] w-full flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-surface p-6 text-left shadow-2xl ${
          wide ? "max-w-5xl" : narrow ? "max-w-xl" : "max-w-3xl"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <div className="flex items-center gap-4">
            {headerExtra}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
