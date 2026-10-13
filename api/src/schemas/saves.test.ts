import { describe, it, expect } from "vitest";
import { saveBodySchema } from "./saves.js";

describe("saveBodySchema", () => {
  it('accepts a stable action key and omits missing artwork from old widgets', () => {
    const result = saveBodySchema.parse({
      partnerApiKey: 'pk_public', url: 'https://example.com/page', title: 'Page',
      idempotencyKey: 'action_0123456789012345', imageUrl: '',
    });
    expect(result.idempotencyKey).toBe('action_0123456789012345');
    expect(result.imageUrl).toBeUndefined();
  });

  it('rejects malformed action keys rather than silently disabling deduplication', () => {
    expect(saveBodySchema.safeParse({
      partnerApiKey: 'pk_public', url: 'https://example.com/page', title: 'Page',
      idempotencyKey: 'short',
    }).success).toBe(false);
  });
  it("accepts a minimal valid body", () => {
    const result = saveBodySchema.safeParse({
      partnerApiKey: "pk_live_abc123",
      url: "https://example.com/product/1",
      title: "Cool product",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full body with optional fields", () => {
    const result = saveBodySchema.safeParse({
      partnerApiKey: "pk_live_abc123",
      url: "https://example.com/product/1",
      title: "Cool product",
      description: "A great product description",
      imageUrl: "https://example.com/img.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing partnerApiKey", () => {
    const result = saveBodySchema.safeParse({
      url: "https://example.com/product/1",
      title: "Cool product",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid url", () => {
    const result = saveBodySchema.safeParse({
      partnerApiKey: "pk_live_abc123",
      url: "not-a-url",
      title: "Cool product",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty title (min length 1, after trim)", () => {
    const result = saveBodySchema.safeParse({
      partnerApiKey: "pk_live_abc123",
      url: "https://example.com/product/1",
      title: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title over the 500-char cap", () => {
    const result = saveBodySchema.safeParse({
      partnerApiKey: "pk_live_abc123",
      url: "https://example.com/product/1",
      title: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a partnerApiKey over the 200-char cap (abuse guard)", () => {
    const result = saveBodySchema.safeParse({
      partnerApiKey: "x".repeat(201),
      url: "https://example.com/product/1",
      title: "Cool product",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid optional imageUrl", () => {
    const result = saveBodySchema.safeParse({
      partnerApiKey: "pk_live_abc123",
      url: "https://example.com/product/1",
      title: "Cool product",
      imageUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from title and description", () => {
    const result = saveBodySchema.safeParse({
      partnerApiKey: "pk_live_abc123",
      url: "https://example.com/product/1",
      title: "  Cool product  ",
      description: "  A description  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Cool product");
      expect(result.data.description).toBe("A description");
    }
  });
});
