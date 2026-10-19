"use client";

// Keeps a signed-in player's run in their account. Mounted once, in the layout.
//
// - Signing in (or opening the game already signed in): compare the browser's
//   run with the account's newest and keep the right one (lib/cloud/sync.ts).
//   A guest run is moved into the account; if the account already has a
//   different run, the player chooses.
// - While signed in: every change is saved in the browser at once (as for
//   guests) and sent to the account a couple of seconds after the last change,
//   or straight away when the tab is hidden. A finished run is ~330 KB, so it
//   isn't sent after every single draft pick.
// - Signing out: the browser's copy is cleared (it's safe in the account), so
//   the next person on this computer starts fresh.

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useAuth, type AuthUser } from "@/components/useAuth";
import { useSavedRun } from "@/components/useSavedRun";
import { fetchLatestRun, runIsInAccount, saveRunToAccount } from "@/lib/cloud/runs";
import { reconcile } from "@/lib/cloud/sync";
import { runStatusLine, userTeam, type RunState } from "@/lib/run";
import { browserSupabase } from "@/lib/supabase/client";
import { registerFlush, setSyncStatus } from "./syncStatus";

export const SAVE_DELAY_MS = 2000;

export function CloudSync() {
  const user = useAuth();
  const { run, update, clear } = useSavedRun();
  const [conflict, setConflict] = useState<{ local: RunState; cloud: RunState } | null>(null);
  const [retries, setRetries] = useState(0); // bumped to retry a failed save

  const userId = user?.id ?? null;
  const previousUser = useRef<string | null | undefined>(undefined);
  // The sign-in whose browser and account copies have been compared and agree.
  // useAuth gives each sign-in its own object, so signing out and back in
  // starts unchecked again. State, not a ref: when it's set, the save effect
  // below runs again, so a change made during the comparison is saved at once.
  const [syncedFor, setSyncedFor] = useState<AuthUser | null>(null);
  const ready = !!user && syncedFor === user;
  const lastSent = useRef<RunState | null>(null); // the run object last saved to the account
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  // Signing in and out.
  useEffect(() => {
    if (user === undefined) return; // still checking
    const before = previousUser.current;
    previousUser.current = userId;
    if (before === userId) return;

    if (userId === null) {
      lastSent.current = null;
      setSyncStatus("idle");
      // Signed out (not just "a guest from the start"): clear this computer's copy.
      if (before) clear();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setSyncStatus("saving");
        const client = browserSupabase();
        const local = runRef.current;
        const cloud = await fetchLatestRun(client);
        const localInAccount = !!local && !!cloud && local.id !== cloud.id ? await runIsInAccount(client, local.id) : false;
        if (cancelled) return;
        const decision = reconcile({ local, cloud, localInAccount });
        if (decision.action === "ask") {
          setConflict({ local: decision.local, cloud: decision.cloud });
          setSyncStatus("idle");
          return;
        }
        if (decision.action === "upload") await saveRunToAccount(client, decision.run);
        if (decision.action === "download") update(decision.run);
        lastSent.current = decision.action === "nothing" ? local : decision.run;
        setSyncedFor(user ?? null);
        setSyncStatus("saved");
      } catch (error) {
        console.error("Couldn't reach your account", error);
        if (!cancelled) setSyncStatus("error");
        if (!cancelled) setSyncedFor(user); // keep playing; changes are retried on the next save
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, userId, update, clear]);

  // Saving changes while signed in.
  useEffect(() => {
    if (!userId || !run || !ready || run === lastSent.current) return;
    const toSave = run;
    const timer = setTimeout(() => void send(), SAVE_DELAY_MS);
    async function send() {
      clearTimeout(timer);
      registerFlush(null);
      try {
        setSyncStatus("saving");
        await saveRunToAccount(browserSupabase(), toSave);
        lastSent.current = toSave;
        setSyncStatus("saved");
      } catch (error) {
        console.error("Couldn't save to your account", error);
        setSyncStatus("error");
      }
    }
    registerFlush(send);
    const onHide = () => {
      if (document.visibilityState === "hidden") void send();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearTimeout(timer);
      registerFlush(null);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [run, userId, ready, retries]);

  // Back online after a failed save: try again.
  useEffect(() => {
    const onOnline = () => setRetries((n) => n + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  if (!conflict) return null;
  const choose = async (keep: "local" | "cloud") => {
    const { local, cloud } = conflict;
    setConflict(null);
    try {
      setSyncStatus("saving");
      if (keep === "local") await saveRunToAccount(browserSupabase(), local);
      else update(cloud);
      lastSent.current = keep === "local" ? local : cloud;
      setSyncedFor(user ?? null);
      setSyncStatus("saved");
    } catch (error) {
      console.error("Couldn't save to your account", error);
      setSyncedFor(user ?? null);
      setSyncStatus("error");
    }
  };

  return (
    // No way to dismiss it without choosing: either answer is safe, but one is needed.
    <Modal open onClose={() => {}} title="Which run do you want to keep?" narrow>
      <p className="text-muted">This computer and your account each have a different run in progress.</p>
      <div className="grid grid-cols-2 gap-3">
        <RunChoice label="On this computer" run={conflict.local} note="Moves into your account." onChoose={() => choose("local")} />
        <RunChoice label="In your account" run={conflict.cloud} note="The run on this computer is discarded." onChoose={() => choose("cloud")} />
      </div>
    </Modal>
  );
}

function RunChoice({ label, run, note, onChoose }: { label: string; run: RunState; note: string; onChoose: () => void }) {
  return (
    <button type="button" onClick={onChoose} className="flex flex-col gap-1 rounded-xl border border-border p-4 text-left hover:border-accent">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="font-semibold">{run.draft.teams[userTeam(run)].name}</span>
      <span className="text-sm tabular-nums text-muted">{runStatusLine(run)}</span>
      <span className="mt-1 text-xs text-muted">{note}</span>
    </button>
  );
}
