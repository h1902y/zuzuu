// ds/kit/EmojiPicker.tsx — a full emoji selector. The trigger button shows the current
// glyph; opening mounts the vanilla emoji-mart picker (search · categories · skin tones
// · recents) into a popover. We use the framework-agnostic core (not @emoji-mart/react,
// whose peer range stops at React 18) and load it + its data LAZILY via dynamic import,
// so the ~1.5MB emoji set is a separate chunk fetched only on first open. The picker is
// themed to the app's resolved light/dark. Trigger/popover use static, token-bound
// utilities; the picker owns its own (shadow-DOM) styling.
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../state/theme.js";

export function EmojiPicker({ value, onPick, label = "Change emoji" }: {
  value: string;
  onPick: (emoji: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const theme = useTheme((s) => s.resolved);
  // keep onPick fresh without re-mounting the picker every render
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!open) return;
    let el: HTMLElement | null = null;
    let cancelled = false;
    void Promise.all([import("emoji-mart"), import("@emoji-mart/data")]).then(([mart, dataMod]) => {
      if (cancelled || !host.current) return;
      // emoji-mart's Picker is a custom element at runtime (its type isn't declared as
      // HTMLElement) — cast the instance for appendChild.
      const inst = new mart.Picker({
        data: (dataMod as { default: unknown }).default,
        theme,
        previewPosition: "none",
        skinTonePosition: "search",
        autoFocus: true,
        onEmojiSelect: (e: { native: string }) => { onPickRef.current(e.native); setOpen(false); },
      });
      el = inst as unknown as HTMLElement;
      host.current.appendChild(el);
    });
    return () => { cancelled = true; el?.parentNode?.removeChild(el); };
  }, [open, theme]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-ui text-lg leading-none transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus"
      >
        {value}
      </button>
      {open && (
        <>
          <button type="button" aria-label="close" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div ref={host} className="absolute left-0 top-full z-20 mt-1" />
        </>
      )}
    </div>
  );
}
