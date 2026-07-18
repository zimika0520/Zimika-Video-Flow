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
  const generatedConcept = resolveRenderableGeneratedConceptVisual(scene, manifest);
  if (generatedConcept) {
    return {
      ...generatedConcept,
      sourceKind: "generated-concept",
    };
  }

  const ordinary = resolveRenderablePrimaryVisual(scene, manifest);
  return ordinary
    ? {
        ...ordinary,
        sourceKind: "ordinary",
      }
    : undefined;
};
