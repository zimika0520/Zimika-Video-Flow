import type { RuntimeAsset, RuntimeAssetManifest, Scene } from "./types";

export type RenderablePrimaryVisual = {
  assetId: string;
  fileName: string;
  runtimeImage: string;
  kind: "evidence" | "context" | "concept";
  role: RuntimeAsset["role"];
};

const basename = (value: string): string => {
  const normalized = value.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
};

const isEvidenceAsset = (asset: RuntimeAsset): boolean =>
  asset.role === "evidence" ||
  asset.type === "web-screenshot" ||
  asset.type === "evidence-card";

const isConceptAsset = (asset: RuntimeAsset): boolean =>
  asset.role === "concept" || asset.type === "ai-generated";

const visualKind = (asset: RuntimeAsset): RenderablePrimaryVisual["kind"] => {
  if (isEvidenceAsset(asset)) return "evidence";
  if (isConceptAsset(asset)) return "concept";
  return "context";
};

const sceneImageForAsset = (
  scene: Scene,
  asset: RuntimeAsset,
): string | undefined =>
  scene.images.find((image) => basename(image) === asset.fileName);

const assetMatchesRef = (asset: RuntimeAsset, ref: string): boolean => {
  const refBase = basename(ref);
  return asset.id === ref || asset.fileName === ref || asset.fileName === refBase;
};

const toRenderable = (
  scene: Scene,
  asset: RuntimeAsset,
): RenderablePrimaryVisual | undefined => {
  const runtimeImage = sceneImageForAsset(scene, asset);
  if (!runtimeImage) return undefined;
  return {
    assetId: asset.id,
    fileName: asset.fileName,
    runtimeImage,
    kind: visualKind(asset),
    role: asset.role,
  };
};

export const resolveRenderablePrimaryVisual = (
  scene: Scene,
  manifest?: RuntimeAssetManifest,
): RenderablePrimaryVisual | undefined => {
  if (!manifest) return undefined;

  const assetById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const explicitRefs = [
    scene.primaryVisualAsset,
    scene.primaryAsset,
    scene.evidenceAsset,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  for (const ref of explicitRefs) {
    const asset =
      assetById.get(ref) ??
      manifest.assets.find((candidate) => assetMatchesRef(candidate, ref));
    if (!asset) continue;
    if (isConceptAsset(asset)) continue;
    const renderable = toRenderable(scene, asset);
    if (renderable) return renderable;
    continue;
  }

  const binding = manifest.sceneBindings.find(
    (candidate) => candidate.sceneId === scene.id,
  );
  if (!binding) return undefined;

  const boundAssets = (binding?.assetIds ?? [])
    .map((id) => assetById.get(id))
    .filter((asset): asset is RuntimeAsset => Boolean(asset))
    .filter((asset) => !isConceptAsset(asset));

  const evidence = boundAssets.find(
    (asset) => isEvidenceAsset(asset) && sceneImageForAsset(scene, asset),
  );
  if (evidence) return toRenderable(scene, evidence);

  const fallback = boundAssets.find((asset) => sceneImageForAsset(scene, asset));
  return fallback ? toRenderable(scene, fallback) : undefined;
};
