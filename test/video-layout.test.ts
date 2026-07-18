import { describe, expect, test } from "vitest";
import { resolveSceneStageInset } from "@/lib/video-layout";

describe("resolveSceneStageInset", () => {
  test("lets landscape director scenes use their own single safe-zone layer", () => {
    expect(
      resolveSceneStageInset({
        width: 1920,
        height: 1080,
        hasDirector: true,
        shotStyle: "Split",
        caseWorkflow: false,
      }),
    ).toBe("0px");
  });

  test("keeps a caption-safe portrait stage", () => {
    expect(
      resolveSceneStageInset({
        width: 1080,
        height: 1920,
        hasDirector: true,
        shotStyle: "Split",
        caseWorkflow: false,
      }),
    ).toBe("150px 48px 320px 48px");
  });

  test("keeps legacy landscape scenes inside a basic safety inset", () => {
    expect(
      resolveSceneStageInset({
        width: 1920,
        height: 1080,
        hasDirector: false,
        shotStyle: "Burst",
        caseWorkflow: false,
      }),
    ).toBe("90px 108px 118px 128px");
  });
});
