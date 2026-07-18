import type { GeneratedImageManifestEntry, GeneratedImageSize } from "./types";

export const isImageSizeValid = (
  width: number,
  height: number,
): boolean => {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
};

type ContainedImageSizeInput = {
  imageWidth: number;
  imageHeight: number;
  maxWidth: number;
  maxHeight: number;
};

export const calculateContainedImageSize = ({
  imageWidth,
  imageHeight,
  maxWidth,
  maxHeight,
}: ContainedImageSizeInput): GeneratedImageSize => {
  if (
    !isImageSizeValid(imageWidth, imageHeight) ||
    !isImageSizeValid(maxWidth, maxHeight)
  ) {
    throw new Error("Image and container dimensions must be positive finite numbers.");
  }

  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
  };
};

type CreateIllustratedImageManifestEntryInput = {
  id: string;
  fileName: string;
  prompt: string;
  requestedSize: GeneratedImageSize;
  actualSize: GeneratedImageSize;
  sceneId: string;
  requestRecord: string;
  responseRecord: string;
};

export const createIllustratedImageManifestEntry = ({
  id,
  fileName,
  prompt,
  requestedSize,
  actualSize,
  sceneId,
  requestRecord,
  responseRecord,
}: CreateIllustratedImageManifestEntryInput): GeneratedImageManifestEntry => ({
  id,
  fileName,
  model: "gpt-image-2",
  prompt,
  requestedSize,
  actualSize,
  role: "storybook-scene",
  evidenceStatus: "concept-only",
  visualTreatment: "layered-parallax",
  boundSceneIds: [sceneId],
  requestRecord,
  responseRecord,
});
