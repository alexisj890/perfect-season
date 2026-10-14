"use client";

// Team name + difficulty, then Start. If a run is already in progress, asks
// for confirmation before replacing it.

import { useState } from "react";
import type { Difficulty } from "@/lib/draft/config";
import { DIFFICULTIES } from "./difficulties";

export const TEAM_NAME_MAX = 24;

interface Props {
  hasRunInProgress: boolean;
  onStart: (choice: { teamName: string; difficulty: Difficulty }) => void;
}

export function NewRunForm({ hasRunInProgress, onStart }: Props) {
  const [teamName, setTeamName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [confirming, setConfirming] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (hasRunInProgress && !confirming) {
      setConfirming(true);
      return;
    }
    onStart({ teamName: teamName.trim() || "Your XI", difficulty });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">New run</h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Team name</span>
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          maxLength={TEAM_NAME_MAX}
          placeholder="Your XI"
          className="rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:border-accent"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-muted">Difficulty</legend>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => (
            <label
              key={d.id}
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm ${
                difficulty === d.id ? "border-accent bg-surface-2" : "border-border hover:border-muted"
              }`}
            >
              <input
                type="radio"
                name="difficulty"
                value={d.id}
                checked={difficulty === d.id}
                onChange={() => setDifficulty(d.id)}
                className="sr-only"
              />
              <span className="font-semibold">{d.label}</span>
              <span className="text-xs text-muted">{d.rivals}</span>
              <span className="mt-auto pt-1 text-xs">
                35–0 odds: <span className="font-semibold text-accent">{d.perfectOdds}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {confirming && (
        <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
          This replaces your current run. Press Start again to confirm.
        </p>
      )}

      <button type="submit" className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-foreground">
        {confirming ? "Yes, start a new run" : "Start draft"}
      </button>
    </form>
  );
}
