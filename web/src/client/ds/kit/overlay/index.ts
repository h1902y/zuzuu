// ds/kit/overlay/index.ts — the overlay-dismissal module's public surface (U1).
export {
  EMPTY_OVERLAY_STACK, pushOverlay, popOverlay, topOf, isTopmost, overlayStackReducer,
} from "./overlay-stack.js";
export type { OverlayId, OverlayStack, OverlayStackAction } from "./overlay-stack.js";
export { shouldCloseOnEscape, shouldCloseOnOutside } from "./dismiss-model.js";
export type { Containable } from "./dismiss-model.js";
export { OverlayStackProvider, useOverlayStack } from "./overlay-stack-context.js";
export type { OverlayStackContextValue } from "./overlay-stack-context.js";
export { useDismiss } from "./use-dismiss.js";
export type { UseDismissOptions } from "./use-dismiss.js";
