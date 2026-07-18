import { beforeEach, describe, expect, test, vi } from "vitest";

const remotionMocks = vi.hoisted(() => ({
  bundle: vi.fn(),
}));

vi.mock("@remotion/bundler", () => ({
  bundle: remotionMocks.bundle,
}));

describe("Remotion bundle cache", () => {
  beforeEach(() => {
    vi.resetModules();
    remotionMocks.bundle.mockReset();
  });

  test("shares one bundle across concurrent renders and releases it afterward", async () => {
    remotionMocks.bundle.mockResolvedValue("serve-url");
    const { getRemotionServeUrl } = await import("@/lib/remotion-render");

    await expect(
      Promise.all([
        getRemotionServeUrl(),
        getRemotionServeUrl(),
        getRemotionServeUrl(),
      ]),
    ).resolves.toEqual(["serve-url", "serve-url", "serve-url"]);
    await expect(getRemotionServeUrl()).resolves.toBe("serve-url");

    expect(remotionMocks.bundle).toHaveBeenCalledTimes(2);
  });

  test("clears a failed bundle so the next render can retry", async () => {
    remotionMocks.bundle
      .mockRejectedValueOnce(new Error("bundle failed"))
      .mockResolvedValueOnce("serve-url");
    const { getRemotionServeUrl } = await import("@/lib/remotion-render");

    await expect(getRemotionServeUrl()).rejects.toThrow("bundle failed");
    await expect(getRemotionServeUrl()).resolves.toBe("serve-url");

    expect(remotionMocks.bundle).toHaveBeenCalledTimes(2);
  });
});
