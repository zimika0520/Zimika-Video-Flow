import { describe, expect, test } from "vitest";
import path from "node:path";
import {
  assertDeliverableQualityReport,
  computeGrayscaleSimilarity,
  evaluatePostRenderQa,
  planSceneFrameCaptures,
} from "@/lib/post-render-qa";
import type { Scene } from "@/lib/types";

const captureScenes: Scene[] = [
  { id: "scene-1", start: 0, end: 4, subtitle: "一", images: [], layout: "title" },
  { id: "scene-2", start: 4, end: 10, subtitle: "二", images: [], layout: "quote" },
];

describe("post-render QA", () => {
  test("plans one midpoint representative frame for every scene", () => {
    expect(planSceneFrameCaptures(captureScenes, "/tmp/quality")).toEqual([
      {
        sceneId: "scene-1",
        timestampSeconds: 2,
        framePath: path.join("/tmp/quality", "scenes", "scene-1.jpg"),
      },
      {
        sceneId: "scene-2",
        timestampSeconds: 7,
        framePath: path.join("/tmp/quality", "scenes", "scene-2.jpg"),
      },
    ]);
  });

  test("compares normalized grayscale frame buffers", () => {
    const identical = Uint8Array.from([0, 64, 128, 255]);
    const opposite = Uint8Array.from([255, 191, 127, 0]);

    expect(computeGrayscaleSimilarity(identical, identical)).toBeCloseTo(1);
    expect(computeGrayscaleSimilarity(identical, opposite)).toBeLessThan(0.3);
  });

  test("passes a valid render and keeps representative frames", () => {
    const report = evaluatePostRenderQa({
      videoPath: "/tmp/preview.mp4",
      expectedDurationSeconds: 12,
      expectedWidth: 1080,
      expectedHeight: 1920,
      probe: { durationSeconds: 12.1, width: 1080, height: 1920, sizeBytes: 1024 },
      framePaths: ["/tmp/frame-01.jpg", "/tmp/frame-02.jpg", "/tmp/frame-03.jpg"],
      blackSegments: [],
    });

    expect(report.passed).toBe(true);
    expect(report.render?.framePaths).toHaveLength(3);
    expect(report.issues).toEqual([]);
  });

  test("blocks wrong dimensions, duration drift and long black frames", () => {
    const report = evaluatePostRenderQa({
      videoPath: "/tmp/preview.mp4",
      expectedDurationSeconds: 12,
      expectedWidth: 1080,
      expectedHeight: 1920,
      probe: { durationSeconds: 7, width: 1920, height: 1080, sizeBytes: 1024 },
      framePaths: [],
      blackSegments: [{ start: 2, end: 4.5, duration: 2.5 }],
    });

    expect(report.passed).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["render.duration-mismatch", "render.dimension-mismatch", "render.long-black-frame", "render.frames-missing"]),
    );
  });

  test("blocks three consecutive scenes with almost identical final composition", () => {
    const report = evaluatePostRenderQa({
      videoPath: "/tmp/preview.mp4",
      expectedDurationSeconds: 12,
      expectedWidth: 1080,
      expectedHeight: 1920,
      probe: { durationSeconds: 12, width: 1080, height: 1920, sizeBytes: 1024 },
      framePaths: [
        "/tmp/scene-01.jpg",
        "/tmp/scene-02.jpg",
        "/tmp/scene-03.jpg",
      ],
      blackSegments: [],
      sceneFrames: [
        { sceneId: "scene-01", framePath: "/tmp/scene-01.jpg" },
        { sceneId: "scene-02", framePath: "/tmp/scene-02.jpg" },
        { sceneId: "scene-03", framePath: "/tmp/scene-03.jpg" },
      ],
      frameSimilarities: [
        {
          leftSceneId: "scene-01",
          rightSceneId: "scene-02",
          similarity: 0.982,
          adjacent: true,
        },
        {
          leftSceneId: "scene-02",
          rightSceneId: "scene-03",
          similarity: 0.978,
          adjacent: true,
        },
      ],
    });

    expect(report.passed).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "render.repeated-composition",
          severity: "error",
        }),
      ]),
    );
  });

  test("reports missing main visuals and repeated asset use", () => {
    const report = evaluatePostRenderQa({
      videoPath: "/tmp/preview.mp4",
      expectedDurationSeconds: 12,
      expectedWidth: 1080,
      expectedHeight: 1920,
      probe: { durationSeconds: 12, width: 1080, height: 1920, sizeBytes: 1024 },
      framePaths: [
        "/tmp/scene-01.jpg",
        "/tmp/scene-02.jpg",
        "/tmp/scene-03.jpg",
      ],
      blackSegments: [],
      primaryVisualUsage: [
        { sceneId: "scene-01", assetId: "same", fileName: "same.png", rendered: true },
        { sceneId: "scene-02", assetId: "same", fileName: "same.png", rendered: true },
        { sceneId: "scene-03", assetId: "same", fileName: "same.png", rendered: true },
        { sceneId: "scene-04", assetId: "missing", fileName: "missing.png", rendered: false },
      ],
    });

    expect(report.passed).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "render.primary-visual-missing",
          severity: "error",
        }),
        expect.objectContaining({
          code: "render.asset-overused",
          severity: "warning",
        }),
      ]),
    );
  });

  test("prevents a failed post-render report from being delivered as final video", () => {
    const report = evaluatePostRenderQa({
      videoPath: "/tmp/final.mp4",
      expectedDurationSeconds: 12,
      expectedWidth: 1080,
      expectedHeight: 1920,
      probe: { durationSeconds: 12, width: 1080, height: 1920, sizeBytes: 1024 },
      framePaths: [],
      blackSegments: [],
    });

    expect(() => assertDeliverableQualityReport(report)).toThrow(
      "渲染后质量检查未通过",
    );
  });
});
