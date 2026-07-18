import { describe, expect, test } from "vitest";
import { resolveScenePrimaryVisual } from "@/lib/scene-primary-visual";
import type { RuntimeAssetManifest, Scene } from "@/lib/types";

const scene: Scene = {
  id: "scene-1",
  start: 0,
  end: 4,
  subtitle: "这是测试字幕。",
  images: ["runtime/evidence.png", "runtime/concept.png"],
  layout: "split-image",
};

const manifest: RuntimeAssetManifest = {
  assetManifestVersion: 1,
  generatedAt: "2026-07-14T00:00:00.000Z",
  sourceMode: "browser-evidence",
  queryTerms: [],
  sourcePages: [],
  assets: [
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
    {
      id: "concept",
      type: "ai-generated",
      role: "concept",
      sourceUrl: "shin-video://generated-image/concept",
      sourceDomain: "ai-generation",
      localPath: "/tmp/concept.png",
      fileName: "concept.png",
      mimeType: "image/png",
      attribution: "AI-generated concept",
      usageRisk: "medium",
      metadata: {
        evidenceStatus: "concept-only",
        visualTreatment: "layered-parallax",
      },
    },
  ],
  sceneBindings: [
    {
      sceneId: "scene-1",
      assetIds: ["evidence", "concept"],
      reason: "测试主视觉选择",
    },
  ],
  warnings: [],
};

describe("scene primary visual", () => {
  test("uses a valid generated concept before ordinary evidence when both are available", () => {
    expect(resolveScenePrimaryVisual(scene, manifest)).toEqual(
      expect.objectContaining({
        sourceKind: "generated-concept",
        assetId: "concept",
        runtimeImage: "runtime/concept.png",
        treatment: "layered-parallax",
      }),
    );
  });

  test("falls back to ordinary evidence when no renderable concept is available", () => {
    expect(
      resolveScenePrimaryVisual(
        { ...scene, images: ["runtime/evidence.png"] },
        manifest,
      ),
    ).toEqual(
      expect.objectContaining({
        sourceKind: "ordinary",
        assetId: "evidence",
        kind: "evidence",
        runtimeImage: "runtime/evidence.png",
      }),
    );
  });
});
