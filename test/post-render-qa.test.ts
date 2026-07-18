import { describe, expect, test } from "vitest";
import { evaluatePostRenderQa } from "@/lib/post-render-qa";

const validProbe = {
  durationSeconds: 14,
  width: 1080,
  height: 1920,
  sizeBytes: 1024,
  hasAudioStream: true,
};

describe("post-render QA", () => {
  test("passes a valid final video without extracting representative frames", () => {
    const report = evaluatePostRenderQa({
      videoPath: "/tmp/final.mp4",
      expectedDurationSeconds: 14,
      expectedWidth: 1080,
      expectedHeight: 1920,
      probe: validProbe,
      blackSegments: [],
    });

    expect(report.passed).toBe(true);
    expect(report.render).toMatchObject({
      hasAudioStream: true,
      longBlackSegmentCount: 0,
    });
    expect(report.issues).toEqual([]);
  });

  test("blocks invalid media, duration, dimensions, or missing audio", () => {
    const report = evaluatePostRenderQa({
      videoPath: "/tmp/final.mp4",
      expectedDurationSeconds: 14,
      expectedWidth: 1080,
      expectedHeight: 1920,
      probe: {
        durationSeconds: 7,
        width: 1920,
        height: 1080,
        sizeBytes: 0,
        hasAudioStream: false,
      },
      blackSegments: [],
    });

    expect(report.passed).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "render.invalid-media",
        "render.duration-mismatch",
        "render.dimension-mismatch",
        "render.audio-missing",
      ]),
    );
  });

  test("blocks a sustained black segment without restoring per-scene review", () => {
    const report = evaluatePostRenderQa({
      videoPath: "/tmp/final.mp4",
      expectedDurationSeconds: 14,
      expectedWidth: 1080,
      expectedHeight: 1920,
      probe: validProbe,
      blackSegments: [
        { start: 2, end: 2.8, duration: 0.8 },
        { start: 8, end: 9.6, duration: 1.6 },
      ],
    });

    expect(report.passed).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain("render.long-black-frame");
    expect(report.render?.longBlackSegmentCount).toBe(1);
  });
});
