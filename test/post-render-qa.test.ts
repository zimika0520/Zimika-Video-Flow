import { describe, expect, test } from "vitest";
import path from "node:path";
import {
  evaluatePostRenderQa,
  planQualitySampleCaptures,
} from "@/lib/post-render-qa";
import type { Scene } from "@/lib/types";

const captureScenes: Scene[] = [
  {
    id: "scene-opening",
    start: 0,
    end: 4,
    subtitle: "开场内容",
    images: [],
    layout: "title",
    importance: 6,
  },
  {
    id: "scene-peak",
    start: 4,
    end: 10,
    subtitle: "重点内容",
    images: [],
    layout: "quote",
    importance: 10,
  },
  {
    id: "scene-ending",
    start: 10,
    end: 14,
    subtitle: "结尾内容",
    images: [],
    layout: "ending",
    importance: 8,
  },
];

const validProbe = {
  durationSeconds: 14,
  width: 1080,
  height: 1920,
  sizeBytes: 1024,
  hasAudioStream: true,
};

describe("post-render QA", () => {
  test("only samples opening, highest-importance scene, and ending", () => {
    expect(planQualitySampleCaptures(captureScenes, 14, "/tmp/quality")).toEqual([
      {
        label: "opening",
        timestampSeconds: 1.12,
        framePath: path.join("/tmp/quality", "opening.jpg"),
      },
      {
        label: "peak",
        timestampSeconds: 7,
        framePath: path.join("/tmp/quality", "peak.jpg"),
      },
      {
        label: "ending",
        timestampSeconds: 12.6,
        framePath: path.join("/tmp/quality", "ending.jpg"),
      },
    ]);
  });

  test("falls back to the video midpoint when scenes are unavailable", () => {
    expect(planQualitySampleCaptures([], 10, "/tmp/quality")[1]).toMatchObject({
      label: "peak",
      timestampSeconds: 5,
    });
  });

  test("passes a valid final video after the three required samples decode", () => {
    const report = evaluatePostRenderQa({
      videoPath: "/tmp/final.mp4",
      expectedDurationSeconds: 14,
      expectedWidth: 1080,
      expectedHeight: 1920,
      probe: validProbe,
      sampledFrameCount: 3,
    });

    expect(report.passed).toBe(true);
    expect(report.render).toMatchObject({
      hasAudioStream: true,
      sampledFrameCount: 3,
    });
    expect(report.issues).toEqual([]);
  });

  test("blocks invalid media, duration, dimensions, missing audio, or missing samples", () => {
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
      sampledFrameCount: 2,
    });

    expect(report.passed).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "render.invalid-media",
        "render.duration-mismatch",
        "render.dimension-mismatch",
        "render.audio-missing",
        "render.samples-missing",
      ]),
    );
  });

});
