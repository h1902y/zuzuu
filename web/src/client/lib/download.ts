// lib/download.ts — the one browser-side "save this text as a file" trigger
// (§H.3.4's export-selection verb). A DOM side effect, kept thin and untested on
// purpose — selection-csv.ts owns the actual (pure, tested) text-building.
export function downloadText(filename: string, text: string, mime = "text/csv"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
