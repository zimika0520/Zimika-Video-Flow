import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { GeneratedScenes } from "./scene-generator";
import type { RuntimeAssetManifest } from "./types";

const execFile = promisify(execFileCallback);

type StandardAspectRatio = "16:9" | "9:16";

const greatestCommonDivisor = (left: number, right: number): number => {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
};

const aspectRatioLabel = (width: number, height: number): `${number}:${number}` => {
  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
};

export const resolveRenderDimensions = ({
  assetManifest,
  fallbackAspectRatio,
}: {
  assetManifest?: RuntimeAssetManifest;
  fallbackAspectRatio: StandardAspectRatio;
}): {
  width: number;
  height: number;
  aspectRatio: `${number}:${number}`;
  source: "generated-image" | "fallback";
} => {
  const generatedImage = assetManifest?.assets.find(
    (asset) =>
      asset.type === "ai-generated" &&
      asset.metadata?.actualSize?.width &&
      asset.metadata.actualSize.height,
  );
  const actualSize = generatedImage?.metadata?.actualSize;
  if (actualSize) {
    return {
      width: actualSize.width,
      height: actualSize.height,
      aspectRatio: aspectRatioLabel(actualSize.width, actualSize.height),
      source: "generated-image",
    };
  }

  const dimensions = fallbackAspectRatio === "9:16"
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
  return {
    ...dimensions,
    aspectRatio: fallbackAspectRatio,
    source: "fallback",
  };
};

export const probeAudioDurationSeconds = async (
  audioPath: string,
): Promise<number> => {
  const { stdout } = await execFile("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`无法读取最终音频时长：${audioPath}`);
  }
  return duration;
};

export const finalizeGeneratedScenesForRender = (
  generated: GeneratedScenes,
  {
    durationSeconds,
    width,
    height,
  }: {
    durationSeconds: number;
    width: number;
    height: number;
  },
): GeneratedScenes => {
  const duration = Number(durationSeconds.toFixed(3));
  const finalSceneIndex = generated.scenes.length - 1;
  return {
    ...generated,
    duration,
    width,
    height,
    scenes: generated.scenes.map((scene, index) =>
      index === finalSceneIndex
        ? { ...scene, end: Math.max(scene.end, duration) }
        : { ...scene },
    ),
    captions: generated.captions?.map((caption) => ({ ...caption })),
  };
};
