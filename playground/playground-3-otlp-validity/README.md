# playground-3 — OTLP validity

Captures a real session, wraps it as an `ExportTraceServiceRequest`, and asserts OTLP/JSON conformance: hex ids (32/16), uint64-nano string timestamps, AnyValue-typed attributes, resolvable parent spans, valid status codes. Formalizes the inline check from Experiment 1.

- **Pass:** the captured trace is structurally conformant OTLP/JSON.
- **Skip:** no host data on this machine to capture.

Run: `node playground/run.mjs 3`
