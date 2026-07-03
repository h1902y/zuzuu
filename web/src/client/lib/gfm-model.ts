// lib/gfm-model.ts — a minimal, SAFE GitHub-flavored-markdown block parser (§H.1).
//
// The detail view renders note bodies as GFM: headings · paragraphs · fenced code ·
// lists (incl. task lists) · blockquotes · tables · hr, with inline bold/italic/
// code/links. PURE text → block tree; the React renderer (Gfm.tsx) emits elements,
// so there is NO raw-HTML path by construction (React escapes everything). Links
// only keep http(s)/# hrefs — anything else renders as plain text.

export type Inline =
  | { t: "text"; text: string }
  | { t: "code"; text: string }
  | { t: "strong"; children: Inline[] }
  | { t: "em"; children: Inline[] }
  | { t: "link"; text: string; href: string };

export type Block =
  | { t: "heading"; depth: number; children: Inline[] }
  | { t: "para"; children: Inline[] }
  | { t: "code"; lang: string; text: string }
  | { t: "list"; ordered: boolean; items: { task: "none" | "todo" | "done"; children: Inline[] }[] }
  | { t: "quote"; children: Inline[][] }
  | { t: "table"; header: Inline[][]; rows: Inline[][][] }
  | { t: "hr" };

const SAFE_HREF = /^(https?:\/\/|#|\/)/i;

/** Inline grammar: `code` · **strong** · *em* / _em_ · [text](href). Single pass,
 *  longest-marker-first; unmatched markers stay literal text. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => { if (text) { out.push({ t: "text", text }); text = ""; } };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^`([^`]+)`/))) {
      flush(); out.push({ t: "code", text: m[1]! }); i += m[0].length; continue;
    }
    if ((m = rest.match(/^\*\*([^*]+)\*\*/))) {
      flush(); out.push({ t: "strong", children: parseInline(m[1]!) }); i += m[0].length; continue;
    }
    if ((m = rest.match(/^(\*|_)([^*_]+)\1/))) {
      flush(); out.push({ t: "em", children: parseInline(m[2]!) }); i += m[0].length; continue;
    }
    if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      flush();
      const href = m[2]!;
      if (SAFE_HREF.test(href)) out.push({ t: "link", text: m[1]!, href });
      else out.push({ t: "text", text: m[1]! }); // unsafe scheme → plain text
      i += m[0].length; continue;
    }
    text += src[i]; i++;
  }
  flush();
  return out;
}

const rowCells = (line: string): string[] =>
  line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
const isDivider = (line: string): boolean =>
  /^\s*\|?\s*:?-{2,}/.test(line) && /^[\s|:-]+$/.test(line);

/** Block grammar, line-oriented. An unclosed trailing fence still renders as code
 *  (bodies stream/truncate honestly). */
export function parseGfm(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  const paraBuf: string[] = [];
  const flushPara = () => {
    const text = paraBuf.join(" ").trim();
    if (text) blocks.push({ t: "para", children: parseInline(text) });
    paraBuf.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i]!;
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      flushPara();
      const lang = fence[1] ?? "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) { buf.push(lines[i]!); i++; }
      i++; // past the closing fence (or EOF)
      blocks.push({ t: "code", lang, text: buf.join("\n") });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); blocks.push({ t: "heading", depth: h[1]!.length, children: parseInline(h[2]!) }); i++; continue; }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { flushPara(); blocks.push({ t: "hr" }); i++; continue; }
    const li = line.match(/^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/);
    if (li) {
      flushPara();
      const ordered = li[1] != null;
      const items: { task: "none" | "todo" | "done"; children: Inline[] }[] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
        if (!m) break;
        let body = m[1]!;
        let task: "none" | "todo" | "done" = "none";
        const t = body.match(/^\[( |x|X)\]\s+(.*)$/);
        if (t) { task = t[1] === " " ? "todo" : "done"; body = t[2]!; }
        items.push({ task, children: parseInline(body) });
        i++;
      }
      blocks.push({ t: "list", ordered, items });
      continue;
    }
    if (/^\s*>/.test(line)) {
      flushPara();
      const quoted: Inline[][] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]!)) {
        const inner = lines[i]!.replace(/^\s*>\s?/, "");
        if (inner.trim()) quoted.push(parseInline(inner));
        i++;
      }
      blocks.push({ t: "quote", children: quoted });
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isDivider(lines[i + 1]!)) {
      flushPara();
      const header = rowCells(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i]!.includes("|") && lines[i]!.trim() !== "") {
        rows.push(rowCells(lines[i]!).map(parseInline));
        i++;
      }
      blocks.push({ t: "table", header, rows });
      continue;
    }
    if (line.trim() === "") { flushPara(); i++; continue; }
    paraBuf.push(line);
    i++;
  }
  flushPara();
  return blocks;
}
