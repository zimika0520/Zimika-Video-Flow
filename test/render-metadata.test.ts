import { describe, expect, test } from "vitest";
import {
  finalizeGeneratedScenesForRender,
  resolveRenderDimensions,
} from "@/lib/render-metadata";
import type { GeneratedScenes } from "@/lib/scene-generator";
import type { RuntimeAssetManifest } from "@/lib/types";

const generatedScenes: GeneratedScenes = {
  scenes: [
    {
      id: "scene-0001",
      start: 0.171,
      end: 6.815,
      subtitle: "脑筋急转弯，你知道小草和鸡蛋谁个子高吗？",
      images: [],
      layout: "title",
    },
    {
      id: "scene-0002",
      start: 6.815,
      end: 10.297,
      subtitle: "是鸡蛋，因为草莓蛋糕哈哈哈哈",
      images: [],
      layout: "ending",
    },
  ],
  captions: [
    {
      text: "脑筋急转弯，你知道小草和鸡蛋谁个子高吗？",
      start: 0.171,
      end: 6.815,
    },
    {
      text: "是鸡蛋，因为草莓蛋糕哈哈哈哈",
      start: 6.815,
      end: 10.297,
    },
  ],
  duration: 10.297,
  fps: 30,
  width: 1920,
  height: 1080,
  warnings: [],
};

const generatedImageManifest: RuntimeAssetManifest = {
  assetManifestVersion: 1,
  generatedAt: "2026-07-15T00:00:00.000Z",
  sourceMode: "web-research",
  queryTerms: [],
  evidenceRecords: [],
  sourcePages: [],
  assets: [
    {
      id: "strawberry-cake-joke-concept",
      type: "ai-generated",
      role: "concept",
      sourceUrl: "shin-video://generated-image/strawberry-cake-joke-concept",
      localPath: "/tmp/image.png",
      fileName: "image.png",
      mimeType: "image/png",
      attribution: "AI-generated",
      usageRisk: "medium",
      metadata: {
        actualSize: { width: 1024, height: 1536 },
      },
    },
  ],
  sceneBindings: [],
  warnings: [],
};

describe("render metadata", () => {
  test("uses the generated image dimensions as the render canvas", () => {
    expect(resolveRenderDimensions({
      assetManifest: generatedImageManifest,
      fallbackAspectRatio: "16:9",
    })).toEqual({
      width: 1024,
      height: 1536,
      aspectRatio: "2:3",
      source: "generated-image",
    });
  });

  test("uses the final audio duration while preserving speech-timed captions", () => {
    const finalized = finalizeGeneratedScenesForRender(generatedScenes, {
      durationSeconds: 11.168813,
      width: 1024,
      height: 1536,
    });

    expect(finalized.duration).toBe(11.169);
    expect(finalized.width).toBe(1024);
    expect(finalized.height).toBe(1536);
    expect(finalized.scenes.at(-1)?.end).toBe(11.169);
    expect(finalized.captions).toEqual(generatedScenes.captions);
    expect(generatedScenes.scenes.at(-1)?.end).toBe(10.297);
  });
});
