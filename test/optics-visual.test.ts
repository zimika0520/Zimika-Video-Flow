import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

const componentNames = [
  "MoonPerceptionFrame",
  "ReferenceScaleFrame",
  "AttentionFieldFrame",
  "FieldOfViewFrame",
  "AngularDiameterFrame",
  "DistanceMythFrame",
  "ZoomCropFrame",
  "MoonCompositionFrame",
] as const;

describe("optics-specific visual system", () => {
  test("exports the complete optics scene family", async () => {
    const source = await readFile(
      new URL("../remotion/visual-library/optics.tsx", import.meta.url),
      "utf8",
    );
    const index = await readFile(
      new URL("../remotion/visual-library/index.ts", import.meta.url),
      "utf8",
    );

    for (const componentName of componentNames) {
      expect(source).toContain(`export const ${componentName}`);
    }
    expect(index).toContain('export * from "./optics"');
  });

  test("routes every optics component by its director component name", async () => {
    const video = await readFile(
      new URL("../remotion/Video.tsx", import.meta.url),
      "utf8",
    );

    for (const componentName of componentNames) {
      expect(video).toContain(`"${componentName}"`);
      expect(video).toContain(`<${componentName}`);
    }
  });

  test("uses finite frame-driven motion instead of permanent loops", async () => {
    const source = await readFile(
      new URL("../remotion/visual-library/optics.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useCurrentFrame");
    expect(source).toContain("spring");
    expect(source).toContain("extrapolateRight");
    expect(source).not.toMatch(/frame\s*%/);
    expect(source).not.toMatch(/animation\s*:/);
    expect(source).not.toContain("infinite");
  });
});
