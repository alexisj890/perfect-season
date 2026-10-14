// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Modal } from "./Modal";

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Penalty practice" returnFocusTo={trigger}>
        <button>Inside</button>
      </Modal>
    </>
  );
}

const open = () => fireEvent.click(screen.getByRole("button", { name: "Open" }));

describe("Modal", () => {
  it("is a labelled, modal dialog", () => {
    render(<Harness />);
    open();
    const dialog = screen.getByRole("dialog", { name: "Penalty practice" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("moves focus in on open and back to the trigger on close", () => {
    render(<Harness />);
    open();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open" }));
  });

  it("closes with Escape", () => {
    render(<Harness />);
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open" }));
  });

  it("closes on a click outside, but not on a click inside", () => {
    render(<Harness />);
    open();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Inside" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps Tab inside the dialog", () => {
    render(<Harness />);
    open();
    const close = screen.getByRole("button", { name: "Close" });
    const inside = screen.getByRole("button", { name: "Inside" });
    inside.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(inside);
  });
});
