import { describe, expect, test } from "vitest";
import {
  resolveGeneratedConceptVisual,
  resolveRenderableGeneratedConceptVisual,
} from "@/lib/generated-concept-visual";
import type { RuntimeAssetManifest, Scene } from "@/lib/types";

const manifest: RuntimeAssetManifest = {
  assetManifestVersion: 1,
  generatedAt: "2026-07-13T00:00:00.000Z",
  sourceMode: "dry-run",
  queryTerms: [],
  evidenceRecords: [],
  sourcePages: [],
  assets: [
    {
      id: "concept-opening",
      type: "ai-generated",
      role: "concept",
      sourceUrl: "shin-video://generated-image/concept-opening",
      localPath: "/tmp/concept-opening.png",
      fileName: "concept-opening.png",
      mimeType: "image/png",
      attribution: "AI-generated concept image",
      usageRisk: "medium",
      metadata: {
        evidenceStatus: "concept-only",
        visualTreatment: "layered-parallax",
        factLabel: "事实口径",
      },
    },
    {
      id: "real-evidence",
      type: "web-screenshot",
      role: "evidence",
      sourceUrl: "https://example.com/source",
      localPath: "/tmp/real-evidence.png",
      fileName: "real-evidence.png",
      mimeType: "image/png",
      attribution: "example.com",
      usageRisk: "low",
    },
  ],
  sceneBindings: [
    {
      sceneId: "scene-0001",
      assetIds: ["concept-opening", "real-evidence"],
      reason: "opening concept",
    },
    {
      sceneId: "scene-0002",
      assetIds: ["real-evidence"],
      reason: "factual evidence",
    },
  ],
  warnings: [],
};

describe("generated concept visual selection", () => {
  test("returns only the concept-only AI asset bound to the requested scene", () => {
    expect(resolveGeneratedConceptVisual("scene-0001", manifest)).toEqual({
      assetId: "concept-opening",
      fileName: "concept-opening.png",
      treatment: "layered-parallax",
      factLabel: "事实口径",
    });
    expect(resolveGeneratedConceptVisual("scene-0002", manifest)).toBeUndefined();
  });

  test("rejects AI assets that lose the concept-only evidence boundary", () => {
    const unsafeManifest: RuntimeAssetManifest = {
      ...manifest,
      assets: manifest.assets.map((asset) =>
        asset.id === "concept-opening"
          ? {
              ...asset,
              metadata: {
                ...asset.metadata,
                evidenceStatus: undefined,
              },
            }
          : asset,
      ),
    };

    expect(resolveGeneratedConceptVisual("scene-0001", unsafeManifest)).toBeUndefined();
  });

  test("returns a renderable concept only when its file exists in scene.images", () => {
    const scene: Scene = {
      id: "scene-0001",
      start: 0,
      end: 4,
      subtitle: "测试概念图运行时回退。",
      images: ["runtime/concept-opening.png"],
      layout: "split-image",
    };

    expect(resolveRenderableGeneratedConceptVisual(scene, manifest)).toEqual({
      assetId: "concept-opening",
      fileName: "concept-opening.png",
      runtimeImage: "runtime/concept-opening.png",
      treatment: "layered-parallax",
      factLabel: "事实口径",
    });
    expect(resolveRenderableGeneratedConceptVisual({ ...scene, images: [] }, manifest)).toBeUndefined();
  });
});
