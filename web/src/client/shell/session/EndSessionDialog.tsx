// shell/session/EndSessionDialog.tsx — the ONE end-session confirm, shared by both
// entry points (the stage-header "End session" button + the nav ✕). It states the
// stakes (an agent squash-merges its branch + mines proposals; a shell just closes),
// runs the end while AWAITING the daemon's merge (a locked busy state — the row can't
// be stranded mid-merge), then surfaces the "what this session taught" card from the
// result. Mounted once in WorkbenchShell. Thin; the copy is the tested model.
import { Dialog, Button } from "../../ds/index.js";
import { Text } from "../../ds/primitives/index.js";
import { useEndSession } from "../../state/end-session.js";
import { useWorkbench } from "../../state/store.js";
import { toast } from "../../state/toast.js";
import { useWorld } from "../world-state.js";
import { showCloseCardFromResult } from "../review/use-session-close.js";
import { endSessionCopy } from "./end-session-copy.js";

export function EndSessionDialog() {
  const target = useEndSession((s) => s.target);
  const busy = useEndSession((s) => s.busy);
  const setBusy = useEndSession((s) => s.setBusy);
  const cancel = useEndSession((s) => s.cancel);
  const done = useEndSession((s) => s.done);
  const close = useWorkbench((s) => s.close);

  if (!target) return null;
  const copy = endSessionCopy(target.type);

  const confirm = async () => {
    setBusy(true);
    // leave the dying session's stage before it unmounts — back to the overview.
    const sel = useWorld.getState().selected;
    if (sel?.kind === "session" && sel.id === target.id) useWorld.getState().select({ kind: "overview" });
    const result = await close(target.id); // resolves only after the daemon's merge
    done(); // clears target + busy regardless
    await showCloseCardFromResult(target.id, result);
    if (result && "ok" in result && !result.ok) toast("Couldn't end the session cleanly", "error");
  };

  return (
    <Dialog
      open
      title={copy.title}
      onClose={busy ? undefined : cancel}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>Keep working</Button>
          {/* primary, NOT danger — ending an agent session squash-merges your work back
              (constructive + reversible); danger-red is reserved for actual destruction. */}
          <Button variant="primary" size="sm" onClick={() => void confirm()} disabled={busy}>
            {busy ? copy.progress : copy.confirm}
          </Button>
        </>
      }
    >
      <Text size="ui" tone="muted">{copy.body}</Text>
    </Dialog>
  );
}
