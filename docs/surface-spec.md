# Surface language — the human skin over the engine

The engine's primitives are good and stay exactly as they are. This is the map
from **engine vocabulary** (what the code calls things) to **surface vocabulary**
(what a user reads/says). The rule: the user should never have to learn the
engine's words to use the product.

**The spine (one sentence):** a *note* → grouped into a *collection* → an agent
that *suggests* and *does* → and *you own the files*.
Everything below the spine (versions, the gate, links, the graph, the wake
source) is depth, never the pitch.

## Keep (word is already human)
`note` · `view` · `field`/`column` · `journal` · `project` · `person` · `secret` · `skill` · `link`

## Rename (same primitive, human word)
| engine | surface |
|---|---|
| module | **collection** |
| generation · `gen log/diff/rollback` | **version / history** · history · compare · restore |
| stage (a proposal) | **suggestion** — "the agent suggests a change" |
| review (the queue) | **approvals** — "changes waiting for your OK" |
| workflow · run · trigger · wake source | **automation** (+ its **runs**) |
| `note fold` · `retype` | **merge** · **change type** |
| `module add-column` | **add a field** |
| observe / observe-runs | **learn from your work → suggestions** |
| target | **contact / account** |
| define / porcelain | **explain** |

## Hide (never surfaced — it's *how*, not *what*)
the **moat** / **two lanes** / **gate** as nouns → say *"the agent asks before it
changes anything"* · generation-as-git-commit · root-mode · `project.md`/`module.md`
manifests · the envelope / TOON / frontmatter · blast-radius · §-references ·
durable run · pointer-flip · step-0 materialize · run-lock · watermark ·
gate_actor · fail-closed · exec-deny · ACP · edge metadata / typed-link graph /
backlinks (→ "links / related") · "git-native / plain files" → one line only,
*"your data is just files you own"*.

## Slices
1. **CLI help strings** — reword every `summary:` to the surface language (no verb
   renames; strings only). ← this commit.
2. Verb aliases with back-compat (`suggest`→stage, `approvals`→review, `collection`→module, `history`→gen).
3. Workbench labels (World→Map, Everything→All, …) + render each note *type* as the thing it is.
4. Docs + README re-skin; lead with the one-sentence spine, bury the substrate.
