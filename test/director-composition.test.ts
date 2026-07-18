import { describe, expect, test } from "vitest";
import {
  directorCompositionSignature,
  getDirectorCompositionProfile,
} from "@/lib/director-composition";
import { directorCapabilities } from "@/lib/director-capabilities";

describe("director composition profiles", () => {
  test("maps every registered treatment to a renderable composition profile", () => {
    for (const capability of Object.values(directorCapabilities)) {
      for (const treatment of capability.allowedTreatments) {
        expect(
          getDirectorCompositionProfile(capability.type, treatment),
        ).toMatchObject({
          layout: expect.any(String),
          motion: expect.any(String),
          titlePlacement: expect.any(String),
        });
      }
    }
  });

  test("gives sibling treatments structurally different final signatures", () => {
    for (const capability of Object.values(directorCapabilities)) {
      const signatures = capability.allowedTreatments.map((treatment) =>
        directorCompositionSignature({
          type: capability.type,
          rendererFamily: capability.rendererFamily,
          visualTreatment: treatment,
          components: [`${capability.type}Renderer`],
        }),
      );

      expect(new Set(signatures).size).toBe(signatures.length);
    }
  });
});
