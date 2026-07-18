import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

describe("paths", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("node:os");
    vi.resetModules();
  });

  test("derives the default output root from the project directory", async () => {
    const { getRuntimeConfig } = await import("@/lib/paths");

    expect(getRuntimeConfig()).toEqual({
      defaultOutputRoot: path.join(process.cwd(), "outputs"),
    });
  });

  test("reads local runtime paths from environment", async () => {
    vi.stubEnv("DEFAULT_OUTPUT_ROOT", "/output");

    const { getRuntimeConfig } = await import("@/lib/paths");

    expect(getRuntimeConfig()).toEqual({
      defaultOutputRoot: "/output",
    });
  });

  test("creates stable run paths under the output root", async () => {
    const { createRunPaths } = await import("@/lib/paths");
    const projectRoot = process.cwd();

    expect(createRunPaths("/root", "My Pack", "/materials/My Pack", "2026-07-02T01-02-03-000Z")).toEqual({
      runId: "2026-07-02T01-02-03-000Z-my-pack",
      runDir: "/root/2026-07-02/My Pack/_runtime/2026-07-02T01-02-03-000Z-my-pack",
      videoBriefPath: "/root/2026-07-02/My Pack/_runtime/2026-07-02T01-02-03-000Z-my-pack/video-brief.json",
      scenesPath: "/root/2026-07-02/My Pack/_runtime/2026-07-02T01-02-03-000Z-my-pack/scenes.json",
      visualManifestPath: "/root/2026-07-02/My Pack/_runtime/2026-07-02T01-02-03-000Z-my-pack/visual-manifest.json",
      subtitleTimelinePath: "/root/2026-07-02/My Pack/_runtime/2026-07-02T01-02-03-000Z-my-pack/subtitle-timeline.json",
      assetManifestPath: "/root/2026-07-02/My Pack/_runtime/2026-07-02T01-02-03-000Z-my-pack/asset-manifest.json",
      directorPlanPath: "/root/2026-07-02/My Pack/_runtime/2026-07-02T01-02-03-000Z-my-pack/director-plan.json",
      styleProfilePath: "/root/2026-07-02/My Pack/_runtime/2026-07-02T01-02-03-000Z-my-pack/style-profile.json",
      publishingPackPath: "/root/2026-07-02/My Pack/publishing-pack.md",
      finalPath: "/root/2026-07-02/My Pack/My Pack.mp4",
      finalDir: "/root/2026-07-02/My Pack",
      publicRuntimeDir: `${projectRoot}/public/runtime/2026-07-02T01-02-03-000Z-my-pack`,
      publicRuntimeBase: "runtime/2026-07-02T01-02-03-000Z-my-pack",
    });
  });

  test("keeps audio-only final output inside the project directory", async () => {
    const { createRunPaths } = await import("@/lib/paths");

    expect(createRunPaths("/root", "音频视频", undefined, "2026-07-03T01-02-03-000Z")).toMatchObject({
      runId: "2026-07-03T01-02-03-000Z-音频视频",
      runDir: "/root/2026-07-03/音频视频/_runtime/2026-07-03T01-02-03-000Z-音频视频",
      finalDir: "/root/2026-07-03/音频视频",
      finalPath: "/root/2026-07-03/音频视频/音频视频.mp4",
    });
  });
});
