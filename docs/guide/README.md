# `docs/guide/` — the user guide (source of truth for the GitHub wiki)

These pages **are** the project's GitHub wiki. The `<repo>.wiki.git` repo is a
**generated mirror** — never edit it directly.

- **Edit here**, in a PR. Changes are reviewed and land atomically with the code
  they document, so the wiki can't drift the way a hand-maintained wiki does.
- On merge to `main`, `.github/workflows/publish-wiki.yml` mirrors this folder
  into the wiki repo (current pages copied, removed pages deleted). The rendered
  `/wiki` tab updates automatically.
- This `README.md` is the only file here that is **not** published as a wiki page
  (the workflow excludes it).

**Conventions** (this is the *wiki* surface, not the architecture docs):
- One file = one wiki page; the filename is the page title (`Getting-Started.md` →
  "Getting Started"). `_Sidebar.md` is the wiki sidebar. `Home.md` is the landing page.
- Cross-page links use wiki syntax: `[[Page Name]]`. Links into the repo use full
  `https://github.com/h1902y/zuzuu/blob/main/...` URLs (relative links don't resolve
  on the rendered wiki).
- Document **shipped + verified behavior only** — the wiki's standing rule. Design,
  rationale, and unbuilt ideas live in the repo's architecture docs (`docs/learn/`,
  `docs/DESIGN.md`, `docs/LOG.md`), not here. The **Decision Log** and **Inspiration
  Log** are the one exception: they're rationale, but they record *real* decisions
  and influences (with unbuilt items flagged).

## The page list (canonical — keep `_Sidebar.md` and `Home.md`'s Pages section equal to this)

`_Sidebar.md`'s list and `Home.md`'s `## Pages` list are two independently-rendered
copies of the same set of pages (the sidebar for every wiki page, the landing page as
a curated front door) — that's exactly how `Secrets.md` went fully unreachable for a
release: added to neither, and nothing caught the drift. This block is the single
source both are required to mirror. **Adding, removing, or renaming a page: update
this list first, then `_Sidebar.md`, then `Home.md`'s `## Pages` section, in the same
commit.** (This repo's docs-only scope has no build step that could generate the two
files from this list — see `docs/audits/2026-07-03-docs-audit.md` §4 item 3 for why a
hand-mirrored, explicitly-pinned list was chosen over silent drift.)

| Group | Pages |
|---|---|
| Start here | Getting Started · Module Standard · Module Home |
| Your data | Modules as Tables · Two Lanes · Knowledge · Guardrails |
| Automation & execution | Tools · Secrets · Workflows |
| The visual surface | The World · Flow View · The Omnibar · Observability · Workbench · Daemon & API |
| Hosts | Claude Code · Codex · Gemini CLI · OpenCode · pi |
| Recipes | Personal Vault |
| Reference | Glossary · Troubleshooting · Roadmap |
| Project | Decision Log · Inspiration Log |
