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
