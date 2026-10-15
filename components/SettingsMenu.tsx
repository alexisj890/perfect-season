"use client";

// The gear button in the header, and the Settings pop-up it opens.

import { useLayoutEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { changeSettings, useSettings } from "@/components/useSettings";

export function SettingsMenu() {
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // Next.js keeps pages alive in the background; don't reopen a stale pop-up.
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Settings"
        title="Settings"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted hover:border-accent hover:text-foreground"
      >
        <GearIcon />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Settings" returnFocusTo={button} narrow>
        <ul className="flex flex-col divide-y divide-border">
          <li>
            <Switch
              label="Draft timer"
              description="60 seconds for each of your picks. When time runs out, the best available player is picked for you."
              checked={settings.draftTimer}
              onChange={(draftTimer) => changeSettings({ draftTimer })}
            />
          </li>
        </ul>
      </Modal>
    </>
  );
}

function Switch({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-6 py-3 text-left"
    >
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-muted">{description}</span>
      </span>
      {/* The track: gold with the knob on the right when on, plain when off. "On"/"Off" is written too, not just shown by colour. */}
      <span className="flex shrink-0 items-center gap-2 text-sm font-semibold" aria-hidden="true">
        <span className={checked ? "text-foreground" : "text-muted"}>{checked ? "On" : "Off"}</span>
        <span className={`flex h-6 w-11 items-center rounded-full border-2 p-0.5 ${checked ? "border-accent bg-accent" : "border-muted bg-surface-2"}`}>
          <span className={`h-4 w-4 rounded-full ${checked ? "translate-x-5 bg-accent-foreground" : "bg-muted"} transition-transform motion-reduce:transition-none`} />
        </span>
      </span>
    </button>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
