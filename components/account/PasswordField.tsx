"use client";

// A password box with a Show / Hide button, and (for new passwords) a live
// checklist of the rules. Each rule shows ✓ or ✗ as well as its colour.

import { useId, useState } from "react";
import { PASSWORD_RULES } from "./passwordRules";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  showRules?: boolean;
}

export function PasswordField({ label, value, onChange, autoComplete, showRules = false }: Props) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const rulesId = `${id}-rules`;
  const field = "w-full rounded-md border border-border bg-background py-2 pl-3 pr-11 text-base outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={field}
          aria-describedby={showRules ? rulesId : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          title={visible ? "Hide" : "Show"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted hover:text-foreground"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {showRules && (
        <ul id={rulesId} className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs" aria-label="Password needs">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(value);
            return (
              <li key={rule.label} className={met ? "text-emerald-700 dark:text-emerald-400" : "text-muted"}>
                <span aria-hidden="true">{met ? "✓" : "✗"} </span>
                {rule.label}
                <span className="sr-only">{met ? " (done)" : " (still needed)"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </svg>
  );
}
