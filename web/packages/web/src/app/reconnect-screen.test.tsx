import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReconnectScreen, RECONNECT_COMMAND } from "./ReconnectScreen";

describe("ReconnectScreen", () => {
  const html = renderToStaticMarkup(<ReconnectScreen />);

  it("shows the reconnect heading + expired-session copy", () => {
    expect(html).toContain("Reconnect to your workbench");
    expect(html).toContain("session expired");
    expect(html).toContain("reuses the running daemon");
  });

  it("surfaces the `zz web` recovery command in a mono code chip", () => {
    expect(RECONNECT_COMMAND).toBe("zz web");
    // rendered inside a <code> with the wc-mono class
    expect(html).toMatch(/<code class="wc-mono[^"]*">\s*zz web\s*<\/code>/);
  });

  it("renders a Retry button", () => {
    expect(html).toContain("<button");
    expect(html).toContain("Retry");
  });
});
