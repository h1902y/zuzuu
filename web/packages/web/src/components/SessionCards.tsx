import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { zuzuuApi, describeZuzuuError } from "../lib/zuzuu-api";
import { mergeSessionWithFallback, refreshSessionGit } from "../lib/session-git-actions";
import { startUtilityRun } from "../lib/agent-launch";
import { type EndCard, recoveryBannerCopy } from "../lib/session-cards";
import { Button, Spinner, confirm } from "./ui";

/**
 * The session-surface center cards: setup (no zuzuu home), recovery
 * (leftover session branch) and end-of-session (agent exit outcome) — the
 * same centered card shell over the terminal area. Starting sessions lives
 * in the bottom SessionComposer, not here.
 */
function Card({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div
      className="relative w-full max-w-sm rounded-ui border border-[var(--border)] bg-popover p-5"
      style={{ boxShadow: "var(--shadow-menu)" }}
    >
      {onDismiss && (
        <button
          onClick={onDismiss}
          title="Dismiss"
          className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-[var(--accent)] hover:text-foreground"
        >
          ✕
        </button>
      )}
      {children}
    </div>
  );
}

/** No zuzuu home yet — onboarding takes the start card's slot in the center
 *  pane. Both CTAs run the zuzuu CLI as a utility session (init / enable);
 *  without the CLI on PATH the install banner replaces dead buttons. */
export function SetupZuzuuCard({ zuzuuBin, onDismiss }: { zuzuuBin: boolean; onDismiss?: () => void }) {
  return (
    <Card {...(onDismiss ? { onDismiss } : {})}>
      <div className="text-base font-medium text-foreground">Set up zuzuu</div>
      <p className="mt-1 text-ui leading-relaxed text-ink-400">
        zuzuu sets up a hidden <code className="text-accent-dim">.zuzuu/</code> home in this project
        (like <code className="text-accent-dim">.git</code>) where your agent&apos;s modules —
        knowledge, memory, actions, instructions, guardrails — live and grow from real sessions.
      </p>
      {zuzuuBin ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <Button variant="primary" onClick={() => void startUtilityRun(["init"])}>
            Set up zuzuu
          </Button>
          <div className="text-meta text-muted-foreground">
            then{" "}
            <button
              className="text-accent-dim underline decoration-dotted underline-offset-2 hover:text-accent"
              onClick={() => void startUtilityRun(["enable"])}
            >
              Enable live capture
            </button>{" "}
            to observe sessions as they happen
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-warn/40 bg-[color-mix(in_oklab,var(--color-warn)_10%,transparent)] px-3 py-2 text-ui text-warn">
          zuzuu CLI required — <code>npm i -g @zuzuucodes/cli</code>
        </div>
      )}
    </Card>
  );
}

/**
 * "You left work here" — a leftover session branch found on load. ONE inline
 * banner in the single-focus center (T4), NOT a modal and NOT a duplicate band.
 * It sits quietly above the picker/tree; Continue re-checkouts the branch (the
 * host picker then shows so you relaunch), Merge squashes & starts fresh.
 * `onDismiss` lets the center show it once and let it be dismissed.
 */
export function RecoveryBanner({
  branch,
  checkpoints,
  onDismiss,
}: {
  branch: string;
  checkpoints: number;
  onDismiss?: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const act = (fn: () => Promise<unknown>) => {
    setBusy(true);
    void fn()
      .catch((err: unknown) => window.alert(describeZuzuuError(err)))
      .finally(() => {
        setBusy(false);
        refreshSessionGit(queryClient);
      });
  };

  const copy = recoveryBannerCopy(branch, checkpoints);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--color-accent)_8%,var(--surface))] px-3 py-2">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-accent-dim" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M8 2.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11M8 5v3.2l2.2 1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="wc-sans min-w-0 text-ui text-foreground">
        {copy.lead}{" "}
        <span className="wc-mono text-accent-dim">{copy.branchLabel}</span>{" "}
        — {copy.stepCount}.
      </span>
      <div className="ml-auto flex items-center gap-2">
        {busy && <Spinner />}
        <Button variant="primary" size="sm" disabled={busy} onClick={() => act(zuzuuApi.sessionContinue)}>
          {copy.resumeLabel}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => act(mergeSessionWithFallback)}>
          {copy.saveLabel}
        </Button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            title="Dismiss"
            className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-[var(--accent)] hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/** End-of-session card over a dead agent terminal (TermView renders it). */
export function SessionEndCard({
  state,
  onStartNew,
  onCloseTab,
  onDismiss,
}: {
  state: Exclude<EndCard, { kind: "banner" }>;
  onStartNew: () => void;
  onCloseTab: () => void;
  /** fall back to the plain exit banner (e.g. "Keep" on no-net-changes) */
  onDismiss: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const discard = async () => {
    const ok = await confirm({
      title: "Discard exploration checkpoints",
      message: "Delete the session branch and its checkpoints? main is untouched either way.",
      okLabel: "Discard checkpoints",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await zuzuuApi.sessionDiscard();
    } catch (err) {
      window.alert(describeZuzuuError(err));
    }
    setBusy(false);
    refreshSessionGit(queryClient);
    onDismiss();
  };

  const startClose = (
    <div className="mt-4 flex items-center gap-2">
      <Button variant="primary" onClick={onStartNew}>Start new session</Button>
      <Button onClick={onCloseTab}>Close tab</Button>
    </div>
  );

  switch (state.kind) {
    case "utility":
      // zuzuu utility runs (init / enable) — no checkpoints, no merge story
      return (
        <Card>
          <div className="text-base font-medium text-foreground">Session finished</div>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={onCloseTab}>Close</Button>
          </div>
        </Card>
      );
    case "merged":
      return (
        <Card>
          <div className="text-base font-medium text-foreground">Session ended — merged to main ✓</div>
          <p className="mt-1 text-ui text-ink-400">
            {state.commits} checkpoint{state.commits === 1 ? "" : "s"} → 1 commit
          </p>
          {startClose}
        </Card>
      );
    case "no-changes":
      return (
        <Card>
          <div className="text-base font-medium text-foreground">Session ended</div>
          <p className="mt-1 text-ui text-ink-400">No changes to merge — main is untouched.</p>
          {startClose}
        </Card>
      );
    case "cli-absent":
      return (
        <Card onDismiss={onDismiss}>
          <div className="text-base font-medium text-foreground">Session ended</div>
          <div className="mt-3 rounded-[var(--radius-sm)] border border-warn/40 bg-[color-mix(in_oklab,var(--color-warn)_10%,transparent)] px-3 py-2 text-ui text-warn">
            zuzuu CLI required to merge session checkpoints —{" "}
            <code>npm i -g @zuzuucodes/cli</code>
          </div>
          {startClose}
        </Card>
      );
    case "no-net-changes":
      return (
        <Card>
          <div className="text-base font-medium text-foreground">No net changes</div>
          <p className="mt-1 text-ui leading-relaxed text-ink-400">
            {state.checkpoints !== null
              ? `${state.checkpoints} exploration checkpoint${state.checkpoints === 1 ? "" : "s"} retained`
              : "Exploration checkpoints retained"}{" "}
            — the tree ended identical to main.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="danger" disabled={busy} onClick={() => void discard()}>
              Discard checkpoints
            </Button>
            <Button disabled={busy} onClick={onDismiss}>Keep</Button>
            {busy && <Spinner />}
          </div>
        </Card>
      );
    case "conflict":
      return (
        <Card onDismiss={onDismiss}>
          <div className="text-base font-medium text-foreground">Merge hit a conflict</div>
          <p className="mt-1 text-ui leading-relaxed text-ink-400">
            Your checkpoints are safe on the session branch. Resolve in a terminal:{" "}
            <code className="text-accent-dim">zuzuu session merge</code>.
          </p>
          {startClose}
        </Card>
      );
    case "failed":
      return (
        <Card onDismiss={onDismiss}>
          <div className="text-base font-medium text-foreground">Session merge failed</div>
          <p className="mt-1 break-words text-ui leading-relaxed text-ink-400">{state.message}</p>
          <p className="mt-2 text-meta text-muted-foreground">
            Checkpoints stay on the session branch — resolve in a terminal.
          </p>
          {startClose}
        </Card>
      );
  }
}
