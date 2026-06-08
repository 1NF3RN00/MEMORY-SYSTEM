import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("apiGet in-flight deduplication", () => {
  let apiGet: typeof import("./api.js").apiGet;
  let apiPost: typeof import("./api.js").apiPost;

  beforeEach(async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    vi.resetModules();
    const mod = await import("./api.js");
    apiGet = mod.apiGet;
    apiPost = mod.apiPost;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("coalesces concurrent identical apiGet calls into one fetch", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "ws-default" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const [first, second, third] = await Promise.all([
      apiGet<{ id: string }>("/workspaces/default"),
      apiGet<{ id: string }>("/workspaces/default"),
      apiGet<{ id: string }>("/workspaces/default"),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/workspaces/default",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(first).toEqual({ id: "ws-default" });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("does not dedupe concurrent apiGet calls with different URLs", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "ws-default" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await Promise.all([
      apiGet<{ id: string }>("/workspaces/default"),
      apiGet<{ status: string }>("/health"),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("issues a fresh fetch after the in-flight request completes", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ n: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ n: 2 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const first = await apiGet<{ n: number }>("/health");
    const second = await apiGet<{ n: number }>("/health");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(first).toEqual({ n: 1 });
    expect(second).toEqual({ n: 2 });
  });

  it("propagates errors to all concurrent waiters", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response("not found", { status: 404 }));

    const results = await Promise.allSettled([
      apiGet("/workspaces/default"),
      apiGet("/workspaces/default"),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
  });

  it("allows a new request after a failed in-flight request settles", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(new Response("server error", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(apiGet("/health")).rejects.toThrow();
    const recovered = await apiGet<{ status: string }>("/health");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(recovered).toEqual({ status: "ok" });
  });

  it("does not dedupe apiPost calls", async () => {
    const mockFetch = vi.mocked(fetch);

    await Promise.all([
      apiPost("/ingest", { text: "a" }),
      apiPost("/ingest", { text: "b" }),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls.every(([, init]) => init?.method === "POST")).toBe(true);
  });
});
