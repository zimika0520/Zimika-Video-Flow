import { describe, expect, test } from "vitest";
import { resolveRenderablePrimaryVisual } from "@/lib/primary-visual";
import type { RuntimeAssetManifest, Scene } from "@/lib/types";

const scene: Scene = {
  id: "scene-0001",
  start: 0,
  end: 4,
  subtitle: "据报道，项目仍处于早期阶段。",
  images: [
    "runtime/images/context.png",
    "runtime/images/evidence.png",
  ],
  layout: "split-image",
  primaryVisualAsset: "evidence.png",
};

const manifest: RuntimeAssetManifest = {
  assetManifestVersion: 1,
  generatedAt: "2026-07-14T00:00:00.000Z",
  sourceMode: "browser-evidence",
  queryTerms: [],
  sourcePages: [],
  assets: [
    {
      id: "context",
      type: "image",
      role: "context",
      sourceUrl: "https://example.com/context",
      localPath: "/tmp/context.png",
      fileName: "context.png",
      mimeType: "image/png",
      attribution: "example.com",
      usageRisk: "low",
    },
    {
      id: "evidence",
      type: "web-screenshot",
      role: "evidence",
      sourceUrl: "https://example.com/evidence",
      localPath: "/tmp/evidence.png",
      fileName: "evidence.png",
      mimeType: "image/png",
      attribution: "example.com",
      usageRisk: "low",
    },
  ],
  sceneBindings: [
    {
      sceneId: "scene-0001",
      assetIds: ["context", "evidence"],
      reason: "事实证据",
    },
  ],
  warnings: [],
};

describe("primary visual selection", () => {
  test("uses an explicitly declared ordinary evidence asset as the main visual", () => {
    expect(resolveRenderablePrimaryVisual(scene, manifest)).toEqual({
      assetId: "evidence",
      fileName: "evidence.png",
      runtimeImage: "runtime/images/evidence.png",
      kind: "evidence",
      role: "evidence",
    });
  });

  test("does not claim that a bound asset is renderable when it is absent from scene.images", () => {
    expect(
      resolveRenderablePrimaryVisual(
        { ...scene, images: ["runtime/images/context.png"] },
        manifest,
      ),
    ).toBeUndefined();
  });

  test("prefers evidence over context when no explicit primary asset is declared", () => {
    expect(
      resolveRenderablePrimaryVisual(
        {
          ...scene,
          primaryVisualAsset: undefined,
          primaryAsset: undefined,
          evidenceAsset: undefined,
        },
        manifest,
      ),
    ).toEqual(
      expect.objectContaining({
        assetId: "evidence",
        kind: "evidence",
      }),
    );
  });
});
