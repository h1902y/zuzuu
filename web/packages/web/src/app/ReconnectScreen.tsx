// Friendly auth-loss screen.
//
// Shown when the daemon answers 401 (the browser's auth cookie is missing or no
// longer matches the daemon's token). Instead of a broken/empty app, we offer a
// clear next step: re-run `zz web`, which re-exchanges the token and reopens an
// authenticated tab.
//
// SECURITY — why there is NO token-less "one-click reconnect" here:
// granting a cookie without presenting the token would have to happen at a
// token-less endpoint reachable as a top-level navigation (Origin: undefined,
// so the Origin gate can't stop it). That would let ANY local process/user
// open the workbench — the exact threat the token defends against. So reconnect
// MUST route back through `zz web`'s token exchange. The Retry button only
// reloads: it succeeds once the cookie has been restored out-of-band (a fresh
// `zz web` opened a tokened tab), and otherwise lands right back here.

import { Button } from "../components/ui";

export const RECONNECT_COMMAND = "zz web";

export function ReconnectScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md rounded-[var(--radius-ui)] border border-[var(--border)] bg-background p-6 text-center shadow-sm">
        <div className="mb-3 text-2xl text-accent">❯_</div>
        <h1 className="text-base font-medium text-foreground">Reconnect to your workbench</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This tab&rsquo;s session expired. Run{" "}
          <code className="wc-mono rounded-[var(--radius-sm)] border border-[var(--border)] px-1.5 py-0.5 text-foreground">
            {RECONNECT_COMMAND}
          </code>{" "}
          in your terminal to reopen it &mdash; it reuses the running daemon and opens an
          authenticated tab.
        </p>
        <div className="mt-5 flex justify-center">
          <Button variant="primary" onClick={() => location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
