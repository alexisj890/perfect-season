"use client";

// A small yes/no pop-up for actions that can't be undone, built on Modal
// (Escape, a click outside or Cancel all back out).

import type { ReactNode, RefObject } from "react";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function ConfirmDialog({ open, title, confirmLabel, onConfirm, onCancel, returnFocusTo, children }: Props) {
  return (
    <Modal open={open} onClose={onCancel} title={title} returnFocusTo={returnFocusTo} narrow>
      <div className="text-muted">{children}</div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full border border-border px-4 py-2 font-semibold hover:border-accent">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onCancel();
          }}
          className="rounded-full bg-accent px-4 py-2 font-semibold text-accent-foreground hover:brightness-110"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
