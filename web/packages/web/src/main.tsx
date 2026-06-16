import React from "react";
import ReactDOM from "react-dom/client";
import { loadTheme } from './state/theme';
loadTheme();
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { isAuthLoss, markAuthLost } from "./state/auth-loss";
import "./index.css";

const queryClient = new QueryClient({
  // Any query that 401s means the daemon stopped accepting this tab's cookie —
  // flip the global auth-loss flag so the app swaps in the ReconnectScreen.
  queryCache: new QueryCache({
    onError: (err) => { if (isAuthLoss(err)) markAuthLost(); },
  }),
  defaultOptions: {
    // Don't retry a 401 — it won't recover without a fresh token exchange.
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !isAuthLoss(err) && count < 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
