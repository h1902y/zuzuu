// U6 logic — the record form: build inputs, track dirty, serialize only changed fields.
import { describe, it, expect } from "vitest";
import { buildForm, dirtyFields, toChange } from "../../src/client/shell/wing/form-model.js";

const fields = [
  { name: "title", type: "text" as const },
  { name: "tags", type: "multi" as const },
  { name: "score", type: "number" as const },
];

describe("form-model", () => {
  it("buildForm seeds inputs from the note + marks multiline", () => {
    const form = buildForm([{ name: "body", type: "longtext" }], { } as never);
    expect(form[0]!.multiline).toBe(true);
    const f = buildForm(fields, { title: "Hi", tags: ["a", "b"] } as never);
    expect(f.find((x) => x.name === "title")!.value).toBe("Hi");
    expect(f.find((x) => x.name === "tags")!.value).toBe("a, b"); // multi formats joined
  });

  it("dirtyFields reports only changed inputs", () => {
    const form = buildForm(fields, { title: "Hi", score: 3 } as never);
    expect(dirtyFields(form, { title: "Hi" })).toEqual([]); // unchanged
    expect(dirtyFields(form, { title: "New" })).toEqual(["title"]);
  });

  it("toChange serializes ONLY changed fields, parsed per FieldType", () => {
    const form = buildForm(fields, { title: "Hi", tags: ["a"], score: 1 } as never);
    const change = toChange(form, { title: "New", tags: "x, y", score: "1" });
    expect(change).toEqual({ title: "New", tags: ["x", "y"] }); // score unchanged → omitted; tags parsed to array
  });
});
