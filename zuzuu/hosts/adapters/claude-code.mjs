// zuzuu/hosts/adapters/claude-code.mjs — observe a Claude Code session.
//
// what: read a real Claude transcript (~/.claude/projects/<encoded-cwd>/<id>.jsonl)
//       and extract deterministic mining SIGNALS — recurring commands, hot files,
//       failing tools, command 2-grams, corrective turns, destructive failures.
// why:  observe solves the cold-start (the loop has nothing to enhance from until
//       it has watched real work). Design B: we re-parse the transcript the host
//       already wrote — we never build spans or drive the host.
// how:  pure file parsing, zero-dep, tolerant (a malformed line is skipped, never
//       fatal). Harvested verbatim-in-spirit from v1's proven mineTranscript
//       (real-wire-data rule: built against transcripts Claude actually produced).
//       The richest host: tool_use blocks (stable toolu_… ids) pair to tool_result
//       (is_error), so we get OK/ERROR per call.

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');
// Claude encodes the project cwd into the dir name: non-alphanumerics → '-'.
const encodeCwd = (cwd) => cwd.replace(/[^A-Za-z0-9]/g, '-');

const norm = (cmd) => String(cmd).trim().replace(/\s+/g, ' ').slice(0, 200);
const SEQ_SEP = ' && ';
const CORRECTION_LEXICON = ["no, don't", "don't ", 'actually use', 'always ', 'never ', 'stop ', 'instead'];
const DESTRUCTIVE_SHAPES = [/\brm\s+-[a-z]*r/, /git\s+push\s+.*--force/, /DROP\s+TABLE/i, /chmod\s+-R/];
const isCorrection = (text) => { const t = String(text).toLowerCase(); return CORRECTION_LEXICON.some((p) => t.includes(p)); };
const isDestructive = (cmd) => DESTRUCTIVE_SHAPES.some((re) => re.test(cmd));
const safeParse = (s) => { try { return JSON.parse(s); } catch { return {}; } };

const FILE_TOOLS = new Set(['Read', 'Write', 'Edit', 'NotebookEdit']);

/** Plain text from a user message content (string | block array). */
function userText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join(' ');
  return '';
}
const isToolResultEcho = (content) => Array.isArray(content) && content.some((b) => b && b.type === 'tool_result');

export const claudeCode = {
  name: 'claude-code',

  detect() { return existsSync(PROJECTS_DIR); },

  /** Transcripts for `cwd` (this project's dir), newest-first; falls back to all. */
  listSessions({ cwd = process.cwd() } = {}) {
    const own = encodeCwd(cwd);
    const roots = existsSync(join(PROJECTS_DIR, own)) ? [own] : (existsSync(PROJECTS_DIR) ? readdirSync(PROJECTS_DIR) : []);
    const out = [];
    for (const d of roots) {
      const dir = join(PROJECTS_DIR, d);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.jsonl')) continue;
        const ref = join(dir, f);
        out.push({ sessionId: f.replace(/\.jsonl$/, ''), label: d, ref, mtime: statSync(ref).mtimeMs });
      }
    }
    return out.sort((a, b) => b.mtime - a.mtime);
  },

  /**
   * Extract mining signals from one transcript. Tolerant; never throws.
   * @returns {{ sessionId, commands:[{cmd,failed}], files:string[], failures:string[],
   *            sequences:string[], correctionTurns:[{text}], destructiveFailures:[{cmd,tool}] }}
   */
  mineSignals(ref) {
    const file = typeof ref === 'string' ? ref : ref?.ref;
    const out = { commands: [], files: [], failures: [], sequences: [], correctionTurns: [], destructiveFailures: [] };
    let sessionId = '';
    const results = new Map();   // tool_use_id → is_error
    const uses = [];             // {id, name, input}
    const bashOrder = [];        // normalized Bash commands, in order
    const userTurns = [];        // {text, afterToolAction}
    let sawToolAction = false;

    let text;
    try { text = readFileSync(file, 'utf8'); } catch { return { sessionId: '', ...out }; }
    for (const line of text.split('\n')) {
      if (!line) continue;
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (e.sessionId) sessionId ||= e.sessionId;
      const content = e.message?.content;
      if (e.type === 'user' && content != null && !isToolResultEcho(content)) {
        const t = userText(content).trim();
        if (t) userTurns.push({ text: t, afterToolAction: sawToolAction });
      }
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (b.type === 'tool_use') {
          const input = typeof b.input === 'string' ? safeParse(b.input) : b.input ?? {};
          uses.push({ id: b.id, name: b.name, input });
          sawToolAction = true;
          if (b.name === 'Bash' && input?.command) bashOrder.push(norm(input.command));
        } else if (b.type === 'tool_result') {
          results.set(b.tool_use_id, !!b.is_error);
        }
      }
    }
    for (const u of uses) {
      const failed = results.get(u.id) === true;
      if (u.name === 'Bash' && u.input?.command) out.commands.push({ cmd: norm(u.input.command), failed });
      const fp = u.input?.file_path || u.input?.path;
      if (fp && FILE_TOOLS.has(u.name)) out.files.push(String(fp));
      if (failed) out.failures.push(u.name);
      if (failed && u.name === 'Bash' && u.input?.command) {
        const cmd = norm(u.input.command);
        if (isDestructive(cmd)) out.destructiveFailures.push({ cmd, tool: u.name });
      }
    }
    for (let i = 0; i + 1 < bashOrder.length; i++) out.sequences.push(bashOrder[i] + SEQ_SEP + bashOrder[i + 1]);
    for (const t of userTurns) if (t.afterToolAction && isCorrection(t.text)) out.correctionTurns.push({ text: t.text.slice(0, 500) });
    return { sessionId: sessionId || (file ? String(file).split('/').pop().replace(/\.jsonl$/, '') : ''), ...out };
  },
};
