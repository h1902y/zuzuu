// src/client/preview/CastView.tsx — play a saved terminal recording.
//
// A session can save its asciicast (the headless mirror's `.cast`, with OSC-133
// per-command chapter markers); opening that file in the right panel plays it
// back here via asciinema-player. Lazy-loaded — the player + its CSS stay out of
// the main bundle.

import { useEffect, useRef } from "react";
import * as AsciinemaPlayer from "asciinema-player";
import "asciinema-player/dist/bundle/asciinema-player.css";
import { PanelHeader, IconButton } from "../panel/kit.js";

export default function CastView({ path, onClose }: { path: string; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const name = path.split("/").pop() ?? path;

  useEffect(() => {
    if (!host.current) return;
    const url = `/api/fs/download?path=${encodeURIComponent(path)}&inline=1`;
    // the .cast carries its own OSC-133 `m` chapter markers, so the player picks
    // them up automatically — no `markers` option needed.
    const player = AsciinemaPlayer.create(url, host.current, {
      fit: "width",
      terminalFontSize: "13px",
      theme: "asciinema",
    });
    return () => player.dispose();
  }, [path]);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={<span className="truncate font-mono text-ui text-subtle" title={path}>▶ {name}</span>}
        right={<IconButton label="close" onClick={onClose}>✕</IconButton>}
      />
      <div ref={host} className="min-h-0 flex-1 overflow-auto p-2" />
    </div>
  );
}
