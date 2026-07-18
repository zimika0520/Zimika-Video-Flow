import type {
  GeneratedImageVisualTreatment,
  RuntimeAssetManifest,
  Scene,
} from "./types";

export type GeneratedConceptVisual = {
  assetId: string;
  fileName: string;
  treatment: GeneratedImageVisualTreatment;
  factLabel?: string;
};

export type RenderableGeneratedConceptVisual = GeneratedConceptVisual & {
  runtimeImage: string;
};

export const resolveGeneratedConceptVisual = (
  sceneId: string,
  manifest?: RuntimeAssetManifest,
): GeneratedConceptVisual | undefined => {
  if (!manifest) return undefined;

  const binding = manifest.sceneBindings.find((candidate) => candidate.sceneId === sceneId);
  if (!binding) return undefined;

  for (const assetId of binding.assetIds) {
    const asset = manifest.assets.find((candidate) => candidate.id === assetId);
    if (
      asset?.type !== "ai-generated" ||
      asset.role !== "concept" ||
      asset.metadata?.evidenceStatus !== "concept-only" ||
      !asset.metadata.visualTreatment
    ) {
      continue;
    }

    return {
      assetId: asset.id,
      fileName: asset.fileName,
      treatment: asset.metadata.visualTreatment,
      factLabel: typeof asset.metadata.factLabel === "string" ? asset.metadata.factLabel : undefined,
    };
  }

  return undefined;
};

export const resolveRenderableGeneratedConceptVisual = (
  scene: Scene,
  manifest?: RuntimeAssetManifest,
): RenderableGeneratedConceptVisual | undefined => {
  const concept = resolveGeneratedConceptVisual(scene.id, manifest);
  if (!concept) return undefined;

  const runtimeImage = scene.images.find(
    (image) => image === concept.fileName || image.endsWith(`/${concept.fileName}`),
  );
  return runtimeImage ? { ...concept, runtimeImage } : undefined;
};
