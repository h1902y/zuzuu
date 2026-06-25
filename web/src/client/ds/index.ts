// ds — the design system's public surface. Surfaces compose ONLY from these:
// layout primitives (own spacing/type), the copy-owned kit (Button, …), and cn.
// Near-zero inline styling: everything here is token-bound via recipes.
export * from "./primitives/index.js";
export * from "./kit/index.js";
export { cn } from "./lib/cn.js";
