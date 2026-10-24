import { describe, it, expect, vi, afterEach } from "vitest";
import { assertSafeToFetch, safeFetch } from "./ssrf-guard.js";

describe("assertSafeToFetch", () => {
  it("blocks non-http(s) schemes", async () => {
    await expect(assertSafeToFetch("file:///etc/passwd")).rejects.toThrow(/Blocked scheme/);
    await expect(assertSafeToFetch("ftp://example.com/x")).rejects.toThrow(/Blocked scheme/);
  });

  it("blocks the literal hostname 'localhost'", async () => {
    await expect(assertSafeToFetch("http://localhost/x")).rejects.toThrow(/Blocked hostname/);
  });

  it("blocks the cloud metadata hostname", async () => {
    await expect(assertSafeToFetch("http://metadata.google.internal/x")).rejects.toThrow(/Blocked hostname/);
  });

  it("blocks a loopback IP literal (127.0.0.1)", async () => {
    await expect(assertSafeToFetch("http://127.0.0.1/x")).rejects.toThrow(/Blocked IP literal/);
  });

  it("blocks the AWS/GCP metadata IP literal (169.254.169.254)", async () => {
    await expect(assertSafeToFetch("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      /Blocked IP literal/
    );
  });

  it("blocks RFC1918 private IP literals", async () => {
    await expect(assertSafeToFetch("http://10.0.0.5/x")).rejects.toThrow(/Blocked IP literal/);
    await expect(assertSafeToFetch("http://172.16.0.1/x")).rejects.toThrow(/Blocked IP literal/);
    await expect(assertSafeToFetch("http://192.168.1.1/x")).rejects.toThrow(/Blocked IP literal/);
  });

  it("blocks the shared address space (100.64.0.0/10)", async () => {
    await expect(assertSafeToFetch("http://100.64.0.1/x")).rejects.toThrow(/Blocked IP literal/);
  });

  it("blocks IPv6 loopback and link-local literals", async () => {
    await expect(assertSafeToFetch("http://[::1]/x")).rejects.toThrow(/Blocked IP literal/);
    await expect(assertSafeToFetch("http://[fe80::1]/x")).rejects.toThrow(/Blocked IP literal/);
  });

  it("allows a public IP literal", async () => {
    await expect(assertSafeToFetch("http://8.8.8.8/x")).resolves.toBeUndefined();
  });

  it("allows https as well as http", async () => {
    await expect(assertSafeToFetch("https://8.8.8.8/x")).resolves.toBeUndefined();
  });
});

describe("safeFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("re-validates each redirect hop and blocks a redirect into a private IP", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "http://127.0.0.1/internal" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetch("http://8.8.8.8/redirect-me")).rejects.toThrow(/Blocked IP literal/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows a safe redirect chain and returns the final response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://8.8.4.4/final" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await safeFetch("http://8.8.8.8/start");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after exceeding the max redirect count", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://8.8.8.8/loop" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetch("http://8.8.8.8/loop")).rejects.toThrow(/Too many redirects/);
  });
});
