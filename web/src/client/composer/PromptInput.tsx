// src/client/composer/PromptInput.tsx — the owned input primitive.
//
// An autosizing textarea + submit-on-Enter (Shift+Enter inserts a newline), with
// a left footer slot for actions (Stop/Esc/host pill) and a Send button. This is
// the AI Elements `PromptInput` shape, hand-rolled and OWNED — no AI-SDK runtime
// dep — so `onSubmit` is target-agnostic: the Composer points it at the PTY.

import { useState, type ReactNode, type KeyboardEvent } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "../ds/index.js";

export function PromptInput({
  onSubmit,
  placeholder = "Message the agent…",
  disabled = false,
  autoFocus = false,
  footer,
}: {
  /** called with the trimmed text when the user submits a non-empty message */
  onSubmit: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** focus the textarea on mount — so keystrokes land here, not in the raw terminal */
  autoFocus?: boolean;
  /** extra controls shown to the left of Send (Stop/Esc/host pill) */
  footer?: ReactNode;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border bg-surface p-2">
      <TextareaAutosize
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        minRows={1}
        maxRows={10}
        className="w-full resize-none bg-transparent px-1 py-1 font-sans text-body text-ink-100 outline-none placeholder:text-muted"
      />
      <div className="mt-1 flex items-center gap-2">
        {footer}
        <div className="ml-auto">
          <Button variant="primary" size="sm" onClick={submit} disabled={disabled || value.trim() === ""}>
            Send ⏎
          </Button>
        </div>
      </div>
    </div>
  );
}
