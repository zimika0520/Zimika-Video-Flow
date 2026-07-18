import {
  resolveRenderableGeneratedConceptVisual,
  type RenderableGeneratedConceptVisual,
} from "./generated-concept-visual";
import {
  resolveRenderablePrimaryVisual,
  type RenderablePrimaryVisual,
} from "./primary-visual";
import type { RuntimeAssetManifest, Scene } from "./types";

export type ScenePrimaryVisual =
  | (RenderableGeneratedConceptVisual & {
      sourceKind: "generated-concept";
    })
  | (RenderablePrimaryVisual & {
      sourceKind: "ordinary";
    });

export const resolveScenePrimaryVisual = (
  scene: Scene,
  manifest?: RuntimeAssetManifest,
): ScenePrimaryVisual | undefined => {
  const ordinary = resolveRenderablePrimaryVisual(scene, manifest);
  if (ordinary) {
    return {
      ...ordinary,
      sourceKind: "ordinary",
    };
  }

  const generatedConcept = resolveRenderableGeneratedConceptVisual(scene, manifest);
  return generatedConcept
    ? {
        ...generatedConcept,
        sourceKind: "generated-concept",
      }
    : undefined;
};
