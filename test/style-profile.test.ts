import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { buildRuntimeStyleProfile, readRuntimeStyleProfile, writeRuntimeStyleProfile } from "@/lib/style-profile";

describe("runtime style profiles", () => {
  test("builds Remotion-readable visual systems for each supported style", () => {
    const fastStyle = buildRuntimeStyleProfile("fast-short-video");

    expect(fastStyle).toMatchObject({
      styleProfileVersion: 2,
      styleName: "强节奏短视频风",
      motionSystem: {
        intensity: "strong",
        transformComposer: "makeTransform",
        colorInterpolation: "interpolateColors",
      },
      effectsSystem: {
        starburst: true,
        svgPathMotion: true,
      },
      transitionSystem: {
        posterize: true,
      },
      recipeSystem: {
        sceneTypes: expect.arrayContaining(["impact-hook", "data-breakdown", "relationship-map", "summary-card"]),
        visualModules: expect.arrayContaining(["transforms", "layers", "transitions", "effects", "fonts", "measuring", "randomness", "animation-math", "svg-path", "color-interpolation"]),
      },
      antiRepetitionRules: {
        maxSameSceneTypeInRow: 1,
        maxSameMotionVariantInRow: 1,
        minShotStylesPerVideo: 3,
        requireMemoryFrame: true,
        minSceneTypesPerVideo: 3,
      },
      directorSystem: {
        shotStyles: expect.arrayContaining(["Burst", "Flow", "Reveal", "Zoom", "Split", "Collapse"]),
        entranceAnimations: expect.arrayContaining(["fadeBlurIn", "slideParallaxIn", "maskReveal", "zoomIn", "kineticPop"]),
        cameraMotions: expect.arrayContaining(["dollyIn", "dollyOut", "parallaxDrift", "orbitalRotate"]),
        backgroundTypes: expect.arrayContaining(["Flat", "Gradient", "Mesh", "Grid", "DataField", "AbstractFlow"]),
      },
    });

    expect(fastStyle.recipeSystem?.visualModules).not.toContain("noise");
    expect(fastStyle.visualFoundation.background.noise).toEqual({ enabled: false, opacity: 0 });
  });

  test("writes and reads runtime/style-profile.json", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-style-"));
    const styleProfilePath = join(root, "runtime", "style-profile.json");

    await writeRuntimeStyleProfile(styleProfilePath, "dark-data-analysis", "16:9");
    const raw = await readFile(styleProfilePath, "utf8");
    const profile = await readRuntimeStyleProfile(styleProfilePath);

    expect(raw).toContain("\"styleProfileVersion\": 2");
    expect(profile.styleName).toBe("深色数据分析风");
    expect(profile.visualFoundation.palette.paper).toBe("#0f172a");
    expect(profile.directorSystem?.shotStyles).toContain("Burst");
  });
});
