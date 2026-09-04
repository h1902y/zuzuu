// src/client/main.tsx — the React entry: mount App under a Query provider.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app/App.js";
import { OverlayStackProvider } from "./ds/kit/overlay/index.js";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* U1 (curried-plotting-coral.md) — ONE overlay stack for the whole app, so
          every Dialog/Popover/etc. (consuming useDismiss) shares the same LIFO
          z-order regardless of where in the tree it mounts. */}
      <OverlayStackProvider>
        <App />
      </OverlayStackProvider>
    </QueryClientProvider>
  </StrictMode>,
);
