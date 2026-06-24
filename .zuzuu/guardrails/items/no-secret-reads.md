---
type: rule
title: No reading secret material
action: deny
tool: *
pattern: "\\.env(\\.|\\b)|id_rsa|id_dsa|id_ecdsa|id_ed25519|\\.pem\\b|\\.p12\\b|\\.pfx\\b|\\bcredentials\\b"
reason: secret material should not enter the context
---
Keys and env files must not enter the model context — across every tool, not just Bash.
