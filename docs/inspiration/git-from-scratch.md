# Git from scratch — a deep dive

> Most people learn git as a list of commands to memorize. That's backwards. Git is one small idea with a lot of consequences. Learn the idea, and every command becomes obvious — including the ones you've feared. This piece builds git from the bottom up, then shows why its data structure is the inspiration for zuzuu's git-native design.

---

## The one idea

> **Git is a content-addressed key-value store, with a history graph layered on top.**

That's the whole thing. You put content in; you get back a key (a hash). You ask for the key; you get back the content. The "version control" you think of — branches, merges, history — is a thin layer of pointers over that store.

Hold two sentences:

1. **The key is the hash of the content.** Identity is derived from the bytes themselves.
2. **History is a graph of snapshots, and a branch is just a movable pointer into it.**

Everything below is consequence.

---

## Part 1 — Content addressing

Take a string. Hash it with SHA-1¹. The hash *is* the address.

```
"hello\n"  ──SHA-1──▶  ce013625030ba8dba906f756967f9e9ca394464a
```

Git stores `"hello\n"` in a file named after that hash. To get it back, you ask for the hash. This is a **content-addressed store**: the address is computed from the content, not assigned.

You can do this by hand. Git's "plumbing" commands expose the raw store:

```bash
$ echo "hello" | git hash-object -w --stdin
ce013625030ba8dba906f756967f9e9ca394464a      # wrote it, got the key

$ git cat-file -p ce013625          # ask for the key, get the content
hello
```

Three properties fall out for free, and they are why git is trustworthy:

- **Deduplication.** Identical content hashes to the same key, so it's stored once. A file unchanged across 1,000 commits is one object.
- **Integrity.** If a byte rots on disk, its hash no longer matches its name — git detects corruption automatically.
- **Immutability.** You cannot change an object. Change the content and you get a *different* hash — a different object. Nothing is ever edited in place.

That last point is the foundation of everything. **Git objects are write-once.** History isn't a log of edits; it's an accumulation of immutable snapshots.

---

## Part 2 — The four objects

Everything in git is one of four object types. All four are content-addressed the same way.

### blob — content, nothing else

A **blob** is a file's *bytes*. No name. No timestamp. No permissions. Just content. The filename `hello.txt` lives elsewhere (in a tree); the blob only knows the bytes.

This is why renaming a file is cheap and why git "detects" renames rather than recording them — the blob is unchanged; only the name pointing at it moved.

### tree — a directory

A **tree** is a directory listing. It maps names to hashes, with a mode (file? executable? subdirectory?):

```bash
$ git cat-file -p HEAD^{tree}
100644 blob a906f7…   README.md
100755 blob 03ba8d…   build.sh        # 755 = executable
040000 tree e01362…   src             # a subtree = a subdirectory
```

A tree points at blobs (files) and other trees (subdirectories). So a tree is the root of a little Merkle tree¹ describing an entire directory hierarchy at one instant. **One tree hash = one complete snapshot of a folder.**

And because it's content-addressed: two directories with identical contents have the same tree hash. Two commits that didn't touch `src/` share the exact same `src` tree object — no copying.

### commit — a snapshot in time

A **commit** is the object you actually think of as "a version." It is tiny — it points at *one tree* (the whole project snapshot) plus metadata:

```bash
$ git cat-file -p HEAD
tree   a1b2c3…                         # THE snapshot — the whole project state
parent f9e8d7…                         # the commit before this one
author  Hari <h@x> 1718700000 +0530
committer Hari <h@x> 1718700000 +0530

Fix the checkout race condition         # the message
```

Read that carefully, because it dismantles the single most common misconception:

> **A commit does not store a diff. It stores a pointer to a complete snapshot (a tree).**

Git is a **snapshot model**, not a delta model. Each commit captures the entire project as it was. The diffs you see (`git diff`, `git show`) are *computed on demand* by comparing two snapshots — they are never stored. (Packfiles compress snapshots using deltas on disk — see Part 8 — but that's a storage trick under the logical snapshot model, invisible to you.)

The `parent` line is the other half: a commit points back to the commit(s) it came from.

### tag — a named, annotated pointer

An annotated **tag** is an object that points at another object (usually a commit) with a name, a message, and a signature. It's how you mark `v1.0.0` permanently. (Lightweight tags are simpler — just a ref; see Part 4.)

---

## Part 3 — The graph

Each commit names its parent. Follow the parents and you walk backward through history. This makes the set of all commits a **directed acyclic graph** (a DAG): directed (each commit points to its past), acyclic (you can't be your own ancestor).

```
A ◀── B ◀── C ◀── D          a straight line of history
            ▲
            └── E ◀── F        a branch: E's parent is C
```

- **A linear history** is a chain: each commit has one parent.
- **A branch point** is a commit with two children (C above has D and E).
- **A merge** is a commit with *two parents* — it ties two lines back together:

```
A ◀── B ◀── C ◀── D ◀── M
            ▲           │
            └── E ◀── F ◀┘     M has two parents: D and F
```

**The history graph is the whole repository.** There is nothing else. "The state of the project at any point" is just "the tree hanging off some commit." Time travel is following parent pointers.

---

## Part 4 — Refs: the pointers that make it usable

Walking raw hashes would be miserable. **Refs** are human-friendly names for hashes. And here is the revelation that makes git stop being scary:

> **A branch is a file containing a 40-character hash. That's it.**

```bash
$ cat .git/refs/heads/main
d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3      # main IS this commit
```

Forty bytes. A branch named `main` is a pointer to one commit. When you commit on `main`, git writes the new commit object and **rewrites that file** to point at it. That's the entire mechanism.

This single fact demystifies a dozen commands:

- **Creating a branch** = writing a new 41-byte file. Instant, regardless of repo size. (`git branch feature` → write `.git/refs/heads/feature` with the current hash.)
- **Switching branches** = pointing **HEAD** at a different ref, then loading that commit's tree into your working directory.
- **A commit** = write the objects, then move the current branch's pointer forward one.
- **`git reset --hard <commit>`** = overwrite the branch pointer to aim at `<commit>`, and reset the working dir to match. The "lost" commits aren't deleted — they're just no longer pointed at (see Part 7).
- **Rollback** = move a pointer backward. **No content is destroyed; a pointer moves.**

That last line is the one to carry into the zuzuu tie-in. **In git, you almost never delete — you move pointers.** Rollback is a pointer flip, not an excavation.

### HEAD — "where am I?"

**HEAD** is a special ref meaning "the commit I'm currently on." Usually it points at a branch (`HEAD → refs/heads/main → d4e5f6…`), which is why committing moves the branch. Point HEAD straight at a commit instead and you're in "detached HEAD" — committing there moves nothing but HEAD, so the commits become unreachable when you leave (the classic "I lost my work" — except you didn't; see the reflog).

```
HEAD ──▶ refs/heads/main ──▶ commit d4e5f6 ──▶ tree a1b2c3 ──▶ blobs…
 │            │                   │                 │
"current"  "the branch"      "the snapshot"   "the files"
```

That chain — HEAD → branch → commit → tree → blobs — is the entire model in one line.

---

## Part 5 — `init`: staking the boundary

Everything above is what git *becomes*. `git init` is where it *starts* — and the surprising thing is how little it does. It snapshots nothing, tracks nothing, commits to nothing about your content. It stakes an empty boundary and walks away.

Here is a fresh repo, in full — every file `git init` creates:

```
.git/
├── HEAD              → "ref: refs/heads/main"   (points at a branch that doesn't exist yet)
├── refs/
│   ├── heads/        (empty — no branch until the first commit)
│   └── tags/         (empty)
├── objects/          (empty — zero objects; the store is bare)
├── config            repo-local config
├── info/exclude      repo-local ignore (uncommitted, unlike .gitignore)
├── hooks/*.sample    inert lifecycle-hook templates
└── description       used only by GitWeb; ignore it
```

Two details carry the whole character of init:

**1. HEAD points at a branch that doesn't exist.** `HEAD` says `refs/heads/main`, but `refs/heads/` is *empty*. There is no `main` yet — this is the "unborn branch" state. The branch file is created **lazily, on the first commit**: git writes the commit object, then creates `refs/heads/main` pointing at it. A branch isn't declared; it springs into existence the moment something needs it. (This is why a fresh repo says "No commits yet.")

**2. `index` and `logs/` aren't there yet.** No staging area (`.git/index` — created on first `git add`), no reflog (`.git/logs/` — created on first ref movement). Git makes state **lazily, only when an operation needs it.** Init is the minimum viable boundary, nothing more.

So `git init` is three tiny acts: **make the empty store** (`objects/`), **make the empty ref space** and aim HEAD at the default branch name, **drop in config + boilerplate.** It is idempotent (re-running it on an existing repo re-asserts boilerplate, never touches your objects) and wholly non-destructive.

### The part that matters most: how git finds the root *later*

When you run a git command in any subdirectory, git **walks up the directory tree until it finds a `.git/`.** That found `.git/` *is* the repository; its parent *is* the working-tree root. Reach the filesystem root without finding one → "not a git repository."

So `.git/` plays three roles at once with one hidden directory:

- the **store** (where the objects live),
- the **boundary** (everything inside the parent, recursively, is what's tracked),
- the **discovery beacon** (walk up to find it = "what repo am I in?").

That is the design move to remember: *one hidden directory answers where's-my-data, what's-tracked, and am-I-in-a-repo.*

---

## Part 6 — Build a commit by hand

Nothing makes the model click like assembling a commit from raw objects, with no `git add` or `git commit` in sight. Every layer is one plumbing command.

```bash
# 1. Store file content → get a blob hash
$ echo "print('hi')" | git hash-object -w --stdin
83baae…

# 2. Build a tree that names that blob
$ git update-index --add --cacheinfo 100644 83baae… app.py
$ git write-tree
4d5e6f…                                  # a tree hash = a snapshot of one file

# 3. Wrap the tree in a commit (no parent = first commit)
$ echo "initial commit" | git commit-tree 4d5e6f…
a7b8c9…                                  # a commit hash

# 4. Point a branch at it
$ git update-ref refs/heads/main a7b8c9…
```

You just built a commit from first principles: **blob → tree → commit → ref.** That is *exactly* what `git commit` does for you — it's a convenience wrapper over these four writes. Once you've done it by hand, "what is a commit" is no longer abstract: it's four content-addressed writes and a pointer move.

---

## Part 7 — Nothing is lost: the reflog and reachability

Because objects are immutable and content-addressed, git is a **pack rat**. When you "delete" a branch or `reset` away commits, the *objects* remain in the store — only the *pointer* to them is gone. An object with no ref pointing at it (directly or transitively) is **unreachable**, not deleted.

Two consequences:

- **The reflog** records every movement of every ref — every commit, reset, checkout, merge, rebase. So "I `reset --hard` and lost three commits" is almost never true:

  ```bash
  $ git reflog
  d4e5f6 HEAD@{0}: reset: moving to HEAD~3
  a1b2c3 HEAD@{1}: commit: the work I thought I lost   ← still right there
  ```
  `git reset --hard a1b2c3` and it's back. The commits were never gone — the branch pointer had just moved off them.

- **Garbage collection** is what *eventually* removes unreachable objects (`git gc`, or automatically), after a grace period (default ~2 weeks). Until then, unreachable ≠ deleted.

This is why git feels safe once you understand it: **destructive-looking operations move pointers; the content lingers, recoverable, until GC.** The scary commands are scary only if you think git stores edits. It stores immutable snapshots and moves pointers between them.

---

## Part 8 — The parts you can now understand for free

With the model in hand, the rest is short.

**The three areas.** Your files exist in three places: the **working directory** (what you edit), the **index / staging area** (a *tree-in-progress* — `git add` writes blobs and stages them into the next tree), and the **repository** (the object store). `git add` = working dir → index; `git commit` = index → a new commit. The index is just a draft tree.

**Merge.** To merge `feature` into `main`: find the **common ancestor** of the two commits, do a three-way compare (ancestor vs each side), and write a new commit with *two parents*. Conflicts are simply the spots where both sides changed the same lines — git can't pick, so it asks you.

**Rebase.** "Replay my commits onto a different base." Git takes each of your commits, computes its diff, and re-applies it on top of the new base — creating *new* commits (new hashes — same content, different parent). This is why rebasing rewrites history: the commits are genuinely new objects.

**Cherry-pick.** Take one commit's diff and apply it elsewhere as a new commit. Same machinery as rebase, one commit at a time.

**Packfiles.** Storing every snapshot as a full object would bloat. So git periodically packs many objects into a single compressed **packfile**, where similar objects are stored as **deltas** against each other. Crucially: this is *physical storage only*. Logically, every commit is still a full snapshot. The delta compression is invisible — `git cat-file` always hands you the whole object. (This is the detail that confuses people into thinking git stores diffs. It doesn't *model* diffs; it *compresses with* them.)

**Distribution.** "Distributed" means every clone has the full object graph and its own refs. `push`/`pull`/`fetch` reconcile object stores and move refs between repos. Because objects are content-addressed, syncing is "do you have these hashes? no? here they are" — collision-free by construction.

---

## The model, in one picture

```
                     content-addressed object store
                     (write-once, dedup, integrity)
   ┌──────────────────────────────────────────────────────────┐
   │  blob ── bytes of a file                                  │
   │  tree ── names → blobs/trees  (a directory snapshot)      │
   │  commit ── one tree + parent(s) + message  (a version)    │
   │  tag ── a named pointer to an object                      │
   └──────────────────────────────────────────────────────────┘
                              ▲
            refs (40-byte pointer files) name the hashes
                              ▲
   HEAD ──▶ branch ──▶ commit ──▶ tree ──▶ blobs
  "current"  "label"  "snapshot"  "dir"    "files"

   history = the DAG of commits (parent pointers)
   rollback = move a pointer  ·  nothing is deleted until GC
```

If you can read that picture and explain it, you understand git better than most people who use it daily. The commands are all just ergonomic wrappers over: *write immutable objects, move pointers.*

---

## Why this is zuzuu's inspiration

We didn't choose git-nativeness for convenience. We chose it because git's data structure is *exactly* the substrate a local-first, human-gated, evolving system needs — and reinventing it would be foolish. The mapping is direct:

| git's idea | what zuzuu gets from it |
|---|---|
| **content-addressed, write-once objects** | zus and snapshots addressed by content hash — dedup, integrity, immutability, all free |
| **commit = a snapshot, not a diff** | a zuzuu snapshot pins *whole state*; rollback restores it exactly |
| **a branch is a movable pointer** | a **session is a branch** (`zz/session-<id>`); a **turn is a commit** |
| **history is the event log** | reconciliation after a crash = `git log` the session branch to the last turn — git is already a write-ahead log |
| **rollback = move a pointer** | rolling back a module's generation flips a pointer; nothing is excavated or `git revert`-ed |
| **the reflog never forgets** | a crashed session's work survives in the branch, recoverable, exactly as git intends |
| **"what changed" = diff two snapshots** | "what did this session/episode change" = `git diff` the branch range — already a feature |
| **`init` stakes an empty boundary, snapshots nothing** | `zz init` scaffolds an empty project (manifest + structure), mines nothing |
| **`.git/` is store + boundary + discovery beacon** | `.zuzuu/` is exactly this; **walk up to find `.zuzuu/`** answers "what project am I in" |
| **the unborn branch — created lazily on first need** | a fresh project has no modules; modules are **born emergently** as work happens, never pre-declared |
| **`index`/`logs` made lazily, only when needed** | event logs and generations created on first mutation, not at init |

And one consequence that runs the other way: **zuzuu is not its own git repo — it's a git-friendly citizen of the user's repo.** `.zuzuu/` lives *inside* the host project's git working tree, so the brain (zus, manifests, the tracked `log.jsonl`) is versioned by the host's git for free, while `runs.jsonl` and `.live/` sit in `.gitignore`. `zz init` therefore does *not* `git init`; it detects the host repo and scaffolds inside it. And zuzuu's own sessions branch off the *host's* git. Two layers of git, one repository.

The deeper lesson git teaches — **don't store edits; store immutable snapshots and move pointers** — is the same discipline zuzuu applies to the brain itself: zus are immutable definitions, the event log is append-only, generations are pinned snapshots, and growth happens by adding objects and moving pointers, never by mutating in place. Git proved the pattern at planetary scale. We borrow the pattern, and where we can, we borrow git itself.

---

¹ *SHA-1 and Merkle trees.* Git historically used SHA-1; it is migrating to SHA-256 for collision resistance, but the model is identical — only the hash function changes. A **Merkle tree** is a tree where every node is named by the hash of its children's hashes; git's tree-of-trees-of-blobs is exactly this, which is what gives a single commit hash the power to verify an entire project's integrity in one comparison.
