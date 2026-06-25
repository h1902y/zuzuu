// T1.4 — the toast queue logic (pure). The .tsx Toaster + the store wrap these.
import { describe, it, expect } from "vitest";
import { appendCapped, removeById, type ToastItem } from "../../src/client/state/toast.js";

const t = (id: string): ToastItem => ({ id, message: id, tone: "default" });

describe("appendCapped", () => {
  it("appends newest-last", () => {
    expect(appendCapped([t("a")], t("b")).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("caps to the max, dropping the oldest", () => {
    const full = [t("a"), t("b"), t("c"), t("d")];
    expect(appendCapped(full, t("e"), 4).map((x) => x.id)).toEqual(["b", "c", "d", "e"]);
  });
});

describe("removeById", () => {
  it("drops the matching toast, leaves the rest", () => {
    expect(removeById([t("a"), t("b")], "a").map((x) => x.id)).toEqual(["b"]);
  });
  it("no-op for an unknown id", () => {
    expect(removeById([t("a")], "zzz").map((x) => x.id)).toEqual(["a"]);
  });
});
