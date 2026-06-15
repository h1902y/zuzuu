// WS-D — the ＋New module GUIDED wizard.
//
// A user describes what they want (plain-language GOALS) → names it → reviews a
// plain-language DRAFT → approves → "voilà, the module is created" — composed
// deterministically from the capability catalogue (the Part I engine), ZERO
// bespoke code. v1 is a guided wizard, NOT a free LLM chat (the daemon has no
// model access; the conversational variant needs host-agent wiring — deferred).
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zuzuuApi, describeZuzuuError } from "../lib/zuzuu-api";
import { useRightPanel } from "../state/right-panel";
import { Button } from "../components/ui-shadcn/button";
import { Switch } from "../components/ui-shadcn/switch";
import { Badge } from "../components/ui-shadcn/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui-shadcn/dialog";
import { GOALS, capabilitiesFor, slugify, draftSummary } from "./new-module";

const STEPS = ["What should this module do?", "Name it", "Review"] as const;

export function NewModuleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const openModule = useRightPanel((s) => s.openModule);
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("note");

  const id = useMemo(() => slugify(title), [title]);
  const draft = useMemo(() => draftSummary({ title, goals, kind }), [title, goals, kind]);

  const reset = () => {
    setStep(0);
    setGoals([]);
    setTitle("");
    setKind("note");
    create.reset();
  };
  const close = (next: boolean) => {
    // don't dismiss/reset mid-flight — a closing dialog would tear down the
    // create before its onSuccess sequencing runs.
    if (!next && create.isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const create = useMutation({
    mutationFn: () =>
      zuzuuApi.createModule({
        id,
        title: title.trim(),
        tagline: "",
        capabilities: capabilitiesFor(goals),
        kinds: [kind.trim() || "note"],
        required: ["body"],
      }),
    onSuccess: async () => {
      // invalidate FIRST so the list + the selection land consistent: the new
      // module is in the overview before we open it and close the dialog.
      await queryClient.invalidateQueries({ queryKey: ["zuzuu", "overview"] });
      openModule(id as Parameters<typeof openModule>[0]);
      close(false);
    },
  });

  const toggleGoal = (gid: string) =>
    setGoals((prev) => (prev.includes(gid) ? prev.filter((g) => g !== gid) : [...prev, gid]));

  const canNext = step === 0 ? goals.length > 0 : step === 1 ? id.length > 0 : true;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="border-[var(--border)] bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>New module</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — pick the goals */}
        {step === 0 && (
          <div className="flex flex-col gap-2">
            {GOALS.map((g) => {
              const on = goals.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGoal(g.id)}
                  className={[
                    "flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                    on
                      ? "border-[var(--border)] bg-[var(--accent)]"
                      : "border-[var(--border)] hover:bg-[var(--accent)]",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-ui font-medium text-foreground">{g.label}</span>
                    <span className="text-meta text-muted-foreground">{g.blurb}</span>
                  </span>
                  <Switch checked={on} className="pointer-events-none shrink-0" aria-hidden />
                </button>
              );
            })}
          </div>
        )}

        {/* STEP 2 — name + the stored kind */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-meta font-medium text-muted-foreground">Title</span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My recipes"
                className="rounded-md border border-[var(--border)] bg-background px-3 py-2 text-ui text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-meta text-muted-foreground">
                id: <code className="text-foreground">{id || "—"}</code>
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-meta font-medium text-muted-foreground">What does it store?</span>
              <input
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                placeholder="note"
                className="rounded-md border border-[var(--border)] bg-background px-3 py-2 text-ui text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-meta text-muted-foreground">one word — the kind of item this module holds</span>
            </label>
          </div>
        )}

        {/* STEP 3 — the plain-language draft to approve */}
        {step === 2 && (
          <div className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-card p-4">
            <div>
              <span className="text-meta text-muted-foreground">Module: </span>
              <span className="text-ui font-medium text-foreground">{draft.title}</span>
            </div>
            <div>
              <div className="text-meta text-muted-foreground">It can:</div>
              <ul className="mt-1 flex flex-col gap-1">
                {draft.can.map((phrase) => (
                  <li key={phrase} className="text-ui text-foreground">
                    · {phrase}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="text-meta text-muted-foreground">Stores: </span>
              <span className="text-ui text-foreground">{draft.kind} items</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-meta text-muted-foreground">id:</span>
              <Badge variant="secondary" className="font-mono text-meta">
                {draft.id}
              </Badge>
            </div>
          </div>
        )}

        {create.isError && (
          <p className="text-meta text-warn">{describeZuzuuError(create.error)}</p>
        )}

        {/* footer nav */}
        <div className="mt-1 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)} disabled={create.isPending}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Next
            </Button>
          ) : (
            <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !id}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
