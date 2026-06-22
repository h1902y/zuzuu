// src/client/panel/RightPanel.tsx — the one right-hand surface, two modes.
//
// FILES → the Monaco editor over the open file (lazy-loaded so Monaco stays out
// of the main bundle). MODULES → the brain dashboard. The mode is driven by
// usePanel (open a file → files; close it / click the brain → modules).

import { lazy, Suspense } from "react";
import { usePanel } from "../state/panel.js";
import { ModulesDashboard } from "./ModulesDashboard.js";
import { Centered } from "./kit.js";

const EditorPane = lazy(() => import("../editor/EditorPane.js"));
const CastView = lazy(() => import("../preview/CastView.js"));

export function RightPanel() {
  const { mode, openPath, closeFile } = usePanel();

  if (mode === "files" && openPath) {
    // a saved recording plays; everything else opens in the editor
    const View = openPath.endsWith(".cast") ? CastView : EditorPane;
    return (
      <Suspense fallback={<Centered>loading…</Centered>}>
        <View path={openPath} onClose={closeFile} />
      </Suspense>
    );
  }
  return <ModulesDashboard />;
}
