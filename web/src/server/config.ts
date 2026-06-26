import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DIR = path.join(os.homedir(), ".webcode");
const FILE = path.join(DIR, "config.json");
const RECENT_MAX = 10;

export interface WebcodeConfig {
  recent: string[];
  /** per-project emoji overrides, keyed by absolute path (absent = the default). */
  emojis: Record<string, string>;
}

/** Load persisted config, tolerating a missing/corrupt file. */
export async function load(): Promise<WebcodeConfig> {
  try {
    const raw = await fsp.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<WebcodeConfig>;
    return {
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter((p) => typeof p === "string") : [],
      emojis: parsed.emojis && typeof parsed.emojis === "object" && !Array.isArray(parsed.emojis)
        ? Object.fromEntries(Object.entries(parsed.emojis).filter(([, v]) => typeof v === "string"))
        : {},
    };
  } catch {
    return { recent: [], emojis: {} };
  }
}

async function save(cfg: WebcodeConfig): Promise<void> {
  await fsp.mkdir(DIR, { recursive: true });
  await fsp.writeFile(FILE, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

/** Prepend a workspace to the recent list (deduped, most-recent-first, capped). */
export async function addRecent(root: string): Promise<WebcodeConfig> {
  const cfg = await load();
  cfg.recent = [root, ...cfg.recent.filter((p) => p !== root)].slice(0, RECENT_MAX);
  await save(cfg);
  return cfg;
}

/** Set (or clear, when emoji is empty) a project's emoji override. */
export async function setEmoji(projectPath: string, emoji: string): Promise<WebcodeConfig> {
  const cfg = await load();
  if (emoji && emoji.trim()) cfg.emojis[projectPath] = emoji;
  else delete cfg.emojis[projectPath];
  await save(cfg);
  return cfg;
}
