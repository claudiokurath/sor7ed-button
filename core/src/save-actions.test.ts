import { describe, expect, it } from "vitest";
import { saveActionRequestHash } from "./save-actions.js";

describe("save action payload identity", () => {
  const content = { url: "https://partner.example/guide", title: "A useful guide" };

  it("has stable identity regardless of object-property order", () => {
    expect(saveActionRequestHash(content)).toBe(saveActionRequestHash({ title: content.title, url: content.url }));
    expect(saveActionRequestHash(content)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("detects changes to every persisted content field", () => {
    const original = saveActionRequestHash({ ...content, description: "Original", imageUrl: "https://partner.example/a.jpg" });
    for (const change of [
      { url: "https://partner.example/other" },
      { title: "A changed title" },
      { description: "Changed" },
      { imageUrl: "https://partner.example/b.jpg" },
    ]) {
      expect(saveActionRequestHash({ ...content, description: "Original", imageUrl: "https://partner.example/a.jpg", ...change }))
        .not.toBe(original);
    }
  });

  it("keeps missing optional artwork stable across a retry", () => {
    expect(saveActionRequestHash(content)).toBe(saveActionRequestHash({ ...content, description: undefined, imageUrl: undefined }));
  });
});
