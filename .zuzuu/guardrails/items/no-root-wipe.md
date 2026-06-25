---
type: rule
title: No destructive delete at filesystem root
action: deny
tool: Bash
pattern: "rm\\s[-\\w\\s]*\\s['\"]?/['\"]?(?=\\s|$|[;&|'\"])"
reason: destructive delete at filesystem root
---
Blocks `rm -rf /` (bare root) plus long-flag (`--recursive --force`), quoted (`"/"`), tab-separated, and chained variants; allows deletes under a path like `/tmp/x`.
