import { directorCapabilities } from "./director-capabilities";
import type { DirectorSceneType, Scene } from "./types";

export const directorVisualForm = (
  directorType?: DirectorSceneType,
  rendererFamily?: Scene["rendererFamily"],
  visualTreatment?: Scene["visualTreatment"],
): string => {
  const capability = directorType ? directorCapabilities[directorType] : undefined;
  const family = rendererFamily ?? capability?.rendererFamily ?? "none";
  const treatment = visualTreatment ?? capability?.allowedTreatments[0] ?? "none";
  return `${family}:${treatment}`;
};
