# playground-2 — host-agnostic

Runs **every host with data on this machine** through the **same core** and checks each yields a valid trace. Needs ≥2 hosts to actually demonstrate agnosticity, and narrates the rich (`session→turn→tool`) vs thin (`session→turn`) contrast — the per-host completeness gap, not a core change.

- **Pass:** ≥2 real hosts both produced valid traces from one core.
- **Skip:** fewer than 2 hosts have data here.

Run: `node playground/run.mjs 2`
