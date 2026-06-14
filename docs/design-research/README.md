# zuzuu Design Research — Mobbin

This directory holds the design research that briefs zuzuu's visual redesign of the web **workbench** — moving it from a VS-Code-terminal feel toward a consumer-SaaS-grade surface: **Notion-calm × Duolingo-progression × game-like, welcoming, uncomplicated — but serious and premium, never toy-like.**

## The exercise

Fourteen research lanes, each studying dozens of real product screens on [Mobbin](https://mobbin.com), then one synthesis pass. Every lane's observations come from examining the **actual screenshots**, not app reputation. The synthesis (`00` + `tokens-candidates`) reads across all 14 to find the cross-cutting design language and resolve conflicts between lanes.

> **Note:** the `mobbin.com/screens/…` links throughout require a **Mobbin login** to view.

## Start here (synthesis)

| File | What it is |
| --- | --- |
| **[`00-design-directions.md`](00-design-directions.md)** | **The north star.** Vision, 9 named principles, the workbench-wide language, a Current→Target table for every surface, and the 5–7 biggest moves. |
| **[`tokens-candidates.md`](tokens-candidates.md)** | Concrete token candidates: color (neutrals, the 5 module hues, semantic status, the rationing rule), type (duotype + serif accent), spacing/radius/elevation, motion vocabulary, and progression/gamification patterns. |

## The 14 lanes

| # | Lane file | One-line | zuzuu surface it informs |
| --- | --- | --- | --- |
| 01 | [`01-file-tree-workspace-nav.md`](01-file-tree-workspace-nav.md) | Calm nested trees & workspace switchers without the IDE feel | Left sidebar (faculty/file explorer) + vault picker |
| 02 | [`02-session-conversation-composer.md`](02-session-conversation-composer.md) | Agent session as a calm conversation, not a terminal; host-picker composer | Center session pane + composer |
| 03 | [`03-entity-cards-overview-dashboard.md`](03-entity-cards-overview-dashboard.md) | Entity cards & a "pulse" stat header for a small fixed set | The 5-faculty module grid + dashboard pulse |
| 04 | [`04-hierarchy-relationships-graph.md`](04-hierarchy-relationships-graph.md) | How items connect — backlinks over graphs; calm properties | Knowledge item detail + relations/"how it connects" |
| 05 | [`05-versioning-lineage-time-travel.md`](05-versioning-lineage-time-travel.md) | Versioning as a calm timeline / progression, not a git log | Per-module generations, checkpoints, rollback |
| 06 | [`06-progression-gamification.md`](06-progression-gamification.md) | Borrow the progression *mechanic*, drop the childish *costume* | The "agent gets smarter" loop (cross-cutting) |
| 07 | [`07-review-approval-triage.md`](07-review-approval-triage.md) | The approve/reject ceremony as finishable, not a chore | ReviewFlow + the NEEDS-YOU surface |
| 08 | [`08-onboarding-provisioning.md`](08-onboarding-provisioning.md) | Install→working faculty home; future cloud spin-up | Local first-run onboarding + hosted provisioning |
| 09 | [`09-status-observability-trace.md`](09-status-observability-trace.md) | Observability structure in activity-feed clothing | Sessions list + trace/session-inspect detail |
| 10 | [`10-settings-rules-policy.md`](10-settings-rules-policy.md) | Policy/rules legible without a JSON config feel | Guardrails view + schema viewer + Instructions editor |
| 11 | [`11-command-palette-quick-actions.md`](11-command-palette-quick-actions.md) | One blended Cmd-K palette that teaches power use | The workbench command palette / quick-switcher |
| 12 | [`12-cloud-billing-credits-usage.md`](12-cloud-billing-credits-usage.md) | Usage/billing as reassurance, not anxiety | Cloud instance status + credit wallet/usage |
| 13 | [`13-aesthetic-design-language.md`](13-aesthetic-design-language.md) | The cross-cutting aesthetic — feeds the token system | Color, type, spacing, radius/elevation, motion, icons |
| 14 | [`14-empty-states-educative.md`](14-empty-states-educative.md) | Teach-as-you-use; empty as invitation, not void | Every empty/first-run surface + inline coaching |

## How to use this for the design build

1. **Read `00-design-directions.md` end to end** — it sets the vision, the nine principles, and the workbench-wide grammar every surface inherits. Internalize the principles (Color only for state · Receipts not logs · Real XP not fake currency · Preview the filled state · mono = machine data only · Detail in a rail · Calm by default · Levels not commits · Finishable ceremonies).
2. **Then `tokens-candidates.md`** — stand up the token system first (neutrals ramp, the 5 demoted hues, semantic status, the duotype boundary, motion names). Most surfaces depend on these existing.
3. **Per surface, open its lane file** for the deep dive. Use the Current→Target table in `00` to find the surface, note its **best references**, then read that lane's "For zuzuu" + "Standouts" sections — those carry the specific adopt/avoid calls and the strongest exemplars to revisit (login required).
4. **Build in the dependency order from `00`'s "biggest moves"**: session-as-receipts and the token discipline first (they touch everything), then the faculty grid, versioning, review ceremony, Cmd-K, and the empty/educative layer.
5. **When lanes disagree** (e.g. density), `00`'s workbench-wide language has already resolved it — calm-tier for human-facing surfaces, dev-tier only inside data tables. Follow the synthesis, not the individual lane.
