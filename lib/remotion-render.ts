import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { readRuntimeDirectorPlan } from "./director-plan";
import { resolveMaterialImagePath } from "./material-pack";
import { readJsonIfExists, validateProductionGateFiles } from "./production-gate";
import { runPostRenderQa } from "./post-render-qa";
import type { GeneratedScenes } from "./scene-generator";
import { readRuntimeStyleProfile } from "./style-profile";
import {
  parseProviderNativeSubtitleTimeline,
  type ProviderNativeSubtitleTimeline,
} from "./tts-provider";
import type { RenderInput, RuntimeAssetManifest, RuntimeDirectorPlan, RuntimeVideoBrief, RuntimeVisualManifest, Scene } from "./types";

export type RenderVideoInput = {
  scenesPath: string;
  materialPackPath?: string;
  audioPath: string;
  voiceoverPath: string;
  subtitleTimelinePath: string;
  videoBriefPath?: string;
  visualManifestPath?: string;
  assetManifestPath?: string;
  directorPlanPath: string;
  styleProfilePath: string;
  outputPath: string;
  publicRuntimeDir: string;
  publicRuntimeBase: string;
};

const projectRoot = process.cwd();
let remotionBundlePromise: Promise<string> | undefined;

export const getRemotionServeUrl = async (): Promise<string> => {
  if (!remotionBundlePromise) {
    remotionBundlePromise = import("@remotion/bundler").then(({ bundle }) =>
      bundle(path.join(projectRoot, "remotion", "index.ts")),
    );
  }

  const pendingBundle = remotionBundlePromise;
  try {
    return await pendingBundle;
  } finally {
    if (remotionBundlePromise === pendingBundle) {
      remotionBundlePromise = undefined;
    }
  }
};

const copyRuntimeAssets = async (
  renderData: GeneratedScenes,
  materialPackPath: string | undefined,
  audioPath: string,
  subtitleTimeline: ProviderNativeSubtitleTimeline,
  directorPlan: RuntimeDirectorPlan,
  styleProfile: Awaited<ReturnType<typeof readRuntimeStyleProfile>>,
  videoBrief: RuntimeVideoBrief | undefined,
  visualManifest: RuntimeVisualManifest | undefined,
  assetManifest: RuntimeAssetManifest | undefined,
  publicRuntimeDir: string,
  publicRuntimeBase: string,
): Promise<RenderInput> => {
  await rm(publicRuntimeDir, { recursive: true, force: true });
  await mkdir(path.join(publicRuntimeDir, "images"), { recursive: true });

  const imageNames = new Set(renderData.scenes.flatMap((scene) => scene.images));
  const copiedImageNames = new Set<string>();
  const audioFileName = path.basename(audioPath);
  if (materialPackPath) {
    const materialImageNames = [...imageNames];
    await Promise.all([
      copyFile(audioPath, path.join(publicRuntimeDir, audioFileName)),
      ...materialImageNames.map(async (imageName) => {
        await copyFile(
          await resolveMaterialImagePath(materialPackPath, imageName),
          path.join(publicRuntimeDir, "images", imageName),
        );
      }),
    ]);
    materialImageNames.forEach((imageName) => copiedImageNames.add(imageName));
  } else {
    await copyFile(audioPath, path.join(publicRuntimeDir, audioFileName));
  }

  if (assetManifest) {
    const assetsByFileName = new Map<string, string>();
    for (const asset of assetManifest.assets) {
      if (!asset.fileName || !asset.localPath) continue;
      assetsByFileName.set(asset.fileName, asset.localPath);
    }
    await Promise.all(
      [...assetsByFileName].map(([fileName, localPath]) =>
        copyFile(localPath, path.join(publicRuntimeDir, "images", fileName)),
      ),
    );
    assetsByFileName.forEach((_localPath, fileName) => copiedImageNames.add(fileName));
  }

  const directorSceneById = new Map(directorPlan.scenes.map((scene) => [scene.id, scene]));
  const mergeDirectorScene = (scene: Scene): Scene => {
    const directorScene = directorSceneById.get(scene.id);
    if (!directorScene) return scene;

    return {
      ...scene,
      ...directorScene,
      images: scene.images,
      animation: {
        ...scene.animation,
        ...directorScene.animation,
      } as Scene["animation"],
      background: {
        ...scene.background,
        ...directorScene.background,
      } as Scene["background"],
      content: {
        ...scene.content,
        ...directorScene.content,
      },
      visualBrief: {
        ...scene.visualBrief,
        ...directorScene.visualBrief,
      },
    };
  };

  return {
    scenes: renderData.scenes.map((scene) => {
      const merged = mergeDirectorScene(scene);
      return {
        ...merged,
        images: scene.images
          .filter((image) => copiedImageNames.has(image))
          .map((image) => `${publicRuntimeBase}/images/${image}`),
      };
    }),
    captions: subtitleTimeline.segments.map(({ text, start, end }) => ({
      text,
      start,
      end,
    })),
    audioSrc: `${publicRuntimeBase}/${audioFileName}`,
    duration: renderData.duration,
    fps: renderData.fps,
    width: renderData.width,
    height: renderData.height,
    styleProfile,
    directorPlan,
    videoBrief,
    visualManifest,
    assetManifest,
    narrativeLayer: renderData.narrativeLayer,
  };
};

export const renderVideo = async ({
  scenesPath,
  materialPackPath,
  audioPath,
  voiceoverPath,
  subtitleTimelinePath,
  videoBriefPath,
  visualManifestPath,
  assetManifestPath,
  directorPlanPath,
  styleProfilePath,
  outputPath,
  publicRuntimeDir,
  publicRuntimeBase,
}: RenderVideoInput): Promise<{ videoPath: string }> => {
  const renderData = JSON.parse(await readFile(scenesPath, "utf8")) as GeneratedScenes;
  const directorPlan = await readRuntimeDirectorPlan(directorPlanPath);
  const styleProfile = await readRuntimeStyleProfile(styleProfilePath);
  const videoBrief = videoBriefPath ? await readJsonIfExists<RuntimeVideoBrief>(videoBriefPath) : undefined;
  const visualManifest = visualManifestPath ? await readJsonIfExists<RuntimeVisualManifest>(visualManifestPath) : undefined;
  const assetManifest = assetManifestPath ? await readJsonIfExists<RuntimeAssetManifest>(assetManifestPath) : undefined;
  const subtitleTimeline = parseProviderNativeSubtitleTimeline(
    JSON.parse(await readFile(subtitleTimelinePath, "utf8")),
  );
  const gateReport = await validateProductionGateFiles({
    scenes: renderData.scenes,
    captions: subtitleTimeline.segments,
    subtitleTimeline,
    videoBrief,
    visualManifest,
    assetManifest,
    directorPlan,
    styleProfile,
    audioPath,
    voiceoverPath,
  });

  if (!gateReport.passed) {
    throw new Error(`production gate 未通过，停止渲染：${gateReport.errors.join("；")}`);
  }

  const inputProps = await copyRuntimeAssets(
    renderData,
    materialPackPath,
    audioPath,
    subtitleTimeline,
    directorPlan,
    styleProfile,
    videoBrief,
    visualManifest,
    assetManifest,
    publicRuntimeDir,
    publicRuntimeBase,
  );
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  const serveUrl = await getRemotionServeUrl();
  const composition = await selectComposition({
    serveUrl,
    id: "ShinVideo",
    inputProps,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
  });

  const postRenderReport = await runPostRenderQa({
    videoPath: outputPath,
    expectedDurationSeconds: renderData.duration,
    expectedWidth: renderData.width,
    expectedHeight: renderData.height,
  });
  if (!postRenderReport.passed) {
    await rm(outputPath, { force: true });
    throw new Error(
      `成片媒体验收失败，停止交付：${postRenderReport.errors.join("；") || "无法验证最终视频"}`,
    );
  }

  return { videoPath: outputPath };
};
