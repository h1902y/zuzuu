// ds/kit/Toaster.tsx — renders the toast queue (bottom-right, above the ribbon).
// Each toast is dismissible; errors carry the danger tone, everything else is calm.
// Composes ds primitives; the positioning frame uses static utilities (no inline
// styles / arbitrary values — the ds-no-inline guard).
import { useToasts } from "../../state/toast.js";
import { Box, Inline, Text } from "../primitives/index.js";

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-10 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <Box key={t.id} bg="elevated" border="hairline" radius="ui" pad="sm">
          <Inline gap="md">
            <Text size="ui" tone={t.tone === "error" ? "danger" : "default"}>{t.message}</Text>
            <Text as="button" interactive size="meta" tone="muted" onClick={() => dismiss(t.id)}>✕</Text>
          </Inline>
        </Box>
      ))}
    </div>
  );
}
