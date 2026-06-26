// ds/lib/cn.ts — class-name composition for the kit. Plain clsx (NOT tailwind-merge):
// our recipes already encode each visual choice as a token-bound variant, and
// tailwind-merge mis-groups our custom font-size tokens (text-meta/ui/body) against
// text-* colors. Concatenation is correct for a system where nothing overrides.
import { clsx, type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]): string => clsx(inputs);
