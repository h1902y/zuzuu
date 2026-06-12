# W2 — workbench v1 (design)

**Date:** 2026-06-12 · **Status:** approved design, ready for implementation plan · **Replaces:** the shipped observe-dashboard spec pair (read-only MVP landed in zuzuu-web `f67fed1`; outcome in `.personal/STATUS.md`).

## Context

DESIGN §13 W2: **zuzuu-web evolves into the visual workbench** — the front door for non-terminal users. The 2026-06-12 audit found the workbench substrate already exists: zuzuu-web (née webcode, `~/Documents/webcode`) is a working local daemon + browser IDE with a virtualized **file tree**, a real **embedded terminal** (xterm.js v6 + WebGL over flow-controlled PTY WebSocket — the §13-decided pane), **Monaco editor + file previews**, ⌘K palette, git panel, `resolveSafe` path security, token+localhost auth, and a read-only **Faculties dashboard** over `.zuzuu/`. So v1 is a **gap-closing release**, not a build-out. The gaps: the graduation loop isn't in the UI (no approve/reject), there's no agent-session UX, the two views don't talk, and there's no distribution story.

**Locked decisions (brainstormed 2026-06-12):**
- **Scope:** full workbench v1 — HITL mutations + agent-session UX + view integration, one release.
- **Distribution:** a **`zz web`** command in the zuzuu CLI (runtime-peer pattern, like `zz code`); requires publishing zuzuu-web.
- **Mutations are CLI-only** — the daemon shells to `zuzuu … --json`, **503 when the binary is absent**; it never reimplements faculty writes (the gate + generation minting stay in zuzuu). Read routes keep their file-read fallback.
- **Architecture C: Home → Workbench** — a funnel-led hybrid. Home (the evolved Faculties view) is the landing + onboarding surface; the IDE workbench gains a zuzuu sidebar tab + agent sessions; one shared review-ceremony component. (B — fully merging the views — stays available later as a deletion, not a rewrite.)

## The product story

`zz web` in any project → browser opens on **Home** → *(uninitialized?)* "Set up zuzuu" runs `zuzuu init` in a visible terminal pane — the W1 narrated output **is** the onboarding → **Start agent session** (picked host runs in the embedded terminal, pre-wired with capture + gate) → work normally → proposals accumulate → **Review** in the browser → a generation is minted → the status chip updates.

## Part 1 — zuzuu repo

- **`zz web`** (`zuzuu/commands/web.mjs`, registered in `bin/zuzuu.mjs`): mirror `commands/code.mjs` exactly — detect the `zuzuu-web` binary; offer on-demand install (`npm i -g @zuzuucodes/web`; runtime peer, never an npm dependency); spawn `zuzuu-web <repo-root>` detached; print the URL. Injectable-deps seam so tests never run npm or the daemon.
- **`--json` gap-fill** on the commands the daemon shells to: `proposals list/show/approve/reject`, `eval`, `act inbox/approve/reject`. Several shapes exist (see `tests/unit/json-outputs.test.mjs`) — implementation adds only what's missing, one hermetic shape-test each, default text output unchanged.
- **Publishing zuzuu-web** (prereq for `zz web` install flow): GitHub repo `h1902y/zuzuu-web` (the local repo has no remote today) + npm **`@zuzuucodes/web`**, bin `zuzuu-web`. The `hosted/` Fly.io layer ships in the package but stays undocumented/unsupported in v1.

## Part 2 — daemon (zuzuu-web repo)

New routes in `packages/daemon/src/zuzuu-api.ts`, behind the existing auth cookie. **Mutations: CLI-only.** A `runZuzuuMut(root, args)` helper spawns `zuzuu <args> --json`; binary absent → **503** `{ error: "zuzuu CLI required" }`; non-zero exit → 502 with stderr text. No file-write fallback, ever.

| Route | Shells to |
|---|---|
| `POST /api/zuzuu/proposals/:id/approve` | `zuzuu proposals approve <id> --json` |
| `POST /api/zuzuu/proposals/:id/reject` (body: `{reason}`) | `zuzuu proposals reject <id> --json` |
| `POST /api/zuzuu/actions/:slug/approve\|reject` | `zuzuu act approve\|reject <slug> --json` |
| `POST /api/zuzuu/generation/:id/rollback` | `zuzuu generation rollback <id> --json` |
| `GET /api/zuzuu/eval` | `zuzuu eval --json` (the ranked review queue) |
| `GET /api/zuzuu/hosts` | `zuzuu status --json` → its detected-hosts field (zuzuu owns host detection via the adapter registry; add the field to the `--json` shape if missing — Part 1) — drives the host picker |

`:id`/`:slug` validated against safe-slug patterns before reaching argv (no shell-string interpolation; spawn with an args array, as today). `zuzuu init` and agent launches are **not** REST mutations — they run as visible PTY sessions via the existing sessions API (extend `POST /api/sessions` with an optional initial `command` if the workflows path doesn't already provide it).

## Part 3 — frontend (zuzuu-web repo)

**Home** (evolve `faculties/FacultiesView.tsx` into the landing view):
- Keeps: status header, faculty cards + drill-in, generations timeline, sessions, digest panel.
- Adds a CTA row: **Start agent session** (host picker fed by `/hosts`; greyed-out for absent hosts) · **Review N proposals** (badge from `/eval`) · **Open workbench**.
- Uninitialized project (`/health` → `home:false`): Home becomes the onboarding card — "Set up zuzuu" opens a terminal pane running `zuzuu init`, then offers `zuzuu enable`. zuzuu binary absent → guidance banner with install command (no dead buttons).

**Review ceremony** (`faculties/ReviewFlow.tsx`, one shared component opened from Home, the sidebar tab, or the status chip):
- Queue = `/eval` ranked proposals. Per item: payload, evidence, eval score + rationale; **Approve / Reject (reason) / Skip**. Mutations via the Part-2 routes; refetch (not optimistic) after each — `/ws/fs` invalidation also fires.
- End screen: the minted generation + link to its diff; nothing pending → "all caught up".
- `FacultyDetail` proposal rows gain inline Approve/Reject using the same mutation hooks.

**Workbench integration** (IDE view):
- Fourth sidebar tab **Agent**: pending badge, digest peek, faculty quick-links that open `.zuzuu/…` files in Monaco (they're plain markdown/JSON — zero new viewers).
- **Start agent session** in the terminal tab bar: spawns a PTY running the picked host (`claude` · `gemini` · `codex` · `pi` · `zuzuu code` for the bundled-OpenCode path). No pre-flight beyond the picker: it's a real terminal — a host error is its own message.
- Status-bar chip: active generation + pending count; click → ReviewFlow.

## Error handling

- CLI absent: reads degrade (existing fallback); **mutations 503** → persistent banner with the install command. CLI non-zero: toast with stderr; UI state refetched, never patched.
- **Flagged risk:** the `/ws/fs` chokidar watcher previously watched `agent/`; verify it does not ignore dot-directories now the home is `.zuzuu/` (live refresh of the dashboard depends on it).
- Path security unchanged: every FS read stays behind `resolveSafe`; mutation ids/slugs are argv-array values, validated, never shell strings.

## Testing

- **Daemon (vitest):** each mutation route against a stubbed `zuzuu` on PATH (success / non-zero → 502 / absent → 503); `/eval` + `/hosts`; id/slug validation rejects traversal & shell-meta input.
- **Web:** ReviewFlow component test (queue advance, approve/reject calls, end state) at the repo's existing test depth.
- **zuzuu repo (node:test, hermetic):** new `--json` shapes; `zz web` via the injectable-deps seam (install-prompt path, launch args, no real spawn).
- **Manual E2E on this repo:** `zz web` → Home renders → start a `claude` session in the terminal → `zuzuu distill --all` → Review in the browser → approve → generation minted (timeline updates live) → rollback from the timeline.

## Out of scope (explicit)

Hosted/Fly mode (ships dark) · multi-project switching beyond the existing vault picker · marketplace templates (W4) · faculty-health analytics beyond pending badges (W3) · any chat UI (the embedded terminal is the decided pane) · wiki/docs updates land with ship, documenting only verified behavior.

## Build sequence

**① zuzuu repo:** `--json` gaps + `zz web` → **② publish:** zuzuu-web GitHub repo + `@zuzuucodes/web` on npm → **③ daemon:** mutation/eval/hosts routes → **④ ReviewFlow** → **⑤ Home + onboarding** → **⑥ workbench integration** (Agent tab, agent sessions, status chip) → **⑦ E2E + wiki**. ① and ③ are the contract; ② can run in parallel with ③–⑥ and must land before ⑦.
