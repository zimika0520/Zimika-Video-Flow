import { describe, expect, test } from "vitest";
import {
  calculateContainedImageSize,
  createIllustratedImageManifestEntry,
  isImageSizeValid,
} from "@/lib/illustrated-image";

describe("illustrated image size validation", () => {
  test("accepts any positive image ratio", () => {
    expect(isImageSizeValid(2560, 1440)).toBe(true);
    expect(isImageSizeValid(1080, 1440)).toBe(true);
    expect(isImageSizeValid(512, 1536)).toBe(true);
  });

  test("rejects invalid dimensions only", () => {
    expect(isImageSizeValid(0, 1000)).toBe(false);
    expect(isImageSizeValid(1000, 0)).toBe(false);
    expect(isImageSizeValid(Number.NaN, 1000)).toBe(false);
  });
});

describe("illustrated scene contain layout", () => {
  test("fits landscape and portrait images without cropping", () => {
    expect(
      calculateContainedImageSize({
        imageWidth: 2560,
        imageHeight: 1440,
        maxWidth: 936,
        maxHeight: 1560,
      }),
    ).toEqual({ width: 936, height: 526.5 });

    expect(
      calculateContainedImageSize({
        imageWidth: 1080,
        imageHeight: 1440,
        maxWidth: 936,
        maxHeight: 1560,
      }),
    ).toEqual({ width: 936, height: 1248 });

    expect(
      calculateContainedImageSize({
        imageWidth: 512,
        imageHeight: 1536,
        maxWidth: 936,
        maxHeight: 1560,
      }),
    ).toEqual({ width: 520, height: 1560 });
  });
});

describe("illustrated image manifest entry", () => {
  test("records the generated image and binds it to the preview scene", () => {
    expect(
      createIllustratedImageManifestEntry({
        id: "storybook-scene-01",
        fileName: "storybook-scene-01.png",
        prompt: "A hand-drawn rural storybook scene.",
        requestedSize: { width: 2560, height: 1440 },
        actualSize: { width: 1080, height: 1440 },
        sceneId: "illustrated-preview-01",
        requestRecord: "/tmp/request.json",
        responseRecord: "/tmp/response.json",
      }),
    ).toEqual({
      id: "storybook-scene-01",
      fileName: "storybook-scene-01.png",
      model: "gpt-image-2",
      prompt: "A hand-drawn rural storybook scene.",
      requestedSize: { width: 2560, height: 1440 },
      actualSize: { width: 1080, height: 1440 },
      role: "storybook-scene",
      evidenceStatus: "concept-only",
      visualTreatment: "layered-parallax",
      boundSceneIds: ["illustrated-preview-01"],
      requestRecord: "/tmp/request.json",
      responseRecord: "/tmp/response.json",
    });
  });
});
