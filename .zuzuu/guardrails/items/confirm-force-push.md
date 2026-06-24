---
type: rule
title: Confirm before force-push
action: ask
tool: Bash
pattern: "git\\b.*\\bpush\\b.*--force"
reason: force-push rewrites shared history
---
Asks (never blocks) on any force-push, including `git -C /path push --force-with-lease`.
