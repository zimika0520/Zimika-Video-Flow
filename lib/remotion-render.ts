import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertDirectorPlanMatchesScenes, readRuntimeDirectorPlan } from "./director-plan";
import { resolveMaterialImagePath } from "./material-pack";
import { readJsonIfExists, validateProductionGateFiles } from "./production-gate";
import { runPostRenderQa } from "./post-render-qa";
import type { GeneratedScenes } from "./scene-generator";
import { readRuntimeStyleProfile } from "./style-profile";
import {
  parseProviderNativeSubtitleTimeline,
  type ProviderNativeSubtitleTimeline,
} from "./tts-provider";
import type { RenderInput, RuntimeAssetManifest, RuntimeDirectorPlan, RuntimeVideoBrief, RuntimeVisualManifest, Scene, VideoQualityReport } from "./types";

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
  productionGateReportPath?: string;
  qualityReportPath?: string;
  qualityFramesDir?: string;
  outputPath: string;
  publicRuntimeDir: string;
  publicRuntimeBase: string;
};

const projectRoot = process.cwd();

const copyRuntimeAssets = async (
  renderData: GeneratedScenes,
  materialPackPath: string | undefined,
  audioPath: string,
  subtitleTimeline: ProviderNativeSubtitleTimeline,
  directorPlan: RuntimeDirectorPlan,
  styleProfilePath: string,
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
  if (materialPackPath) {
    for (const imageName of imageNames) {
      await copyFile(await resolveMaterialImagePath(materialPackPath, imageName), path.join(publicRuntimeDir, "images", imageName));
      copiedImageNames.add(imageName);
    }
  }

  if (assetManifest) {
    for (const asset of assetManifest.assets) {
      if (!asset.fileName || !asset.localPath) continue;
      await copyFile(asset.localPath, path.join(publicRuntimeDir, "images", asset.fileName));
      copiedImageNames.add(asset.fileName);
    }
  }

  const audioFileName = path.basename(audioPath);
  await copyFile(audioPath, path.join(publicRuntimeDir, audioFileName));
  const styleProfile = await readRuntimeStyleProfile(styleProfilePath);
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
  productionGateReportPath,
  qualityReportPath,
  qualityFramesDir,
  outputPath,
  publicRuntimeDir,
  publicRuntimeBase,
}: RenderVideoInput): Promise<{ videoPath: string; qualityReport: VideoQualityReport }> => {
  const renderData = JSON.parse(await readFile(scenesPath, "utf8")) as GeneratedScenes;
  const directorPlan = await readRuntimeDirectorPlan(directorPlanPath);
  assertDirectorPlanMatchesScenes(directorPlan, renderData.scenes);
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

  if (productionGateReportPath) {
    await mkdir(path.dirname(productionGateReportPath), { recursive: true });
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(productionGateReportPath, `${JSON.stringify(gateReport, null, 2)}\n`, "utf8"),
    );
  }

  if (!gateReport.passed) {
    throw new Error(`production gate 未通过，停止渲染：${gateReport.errors.join("；")}`);
  }

  const inputProps = await copyRuntimeAssets(
    renderData,
    materialPackPath,
    audioPath,
    subtitleTimeline,
    directorPlan,
    styleProfilePath,
    videoBrief,
    visualManifest,
    assetManifest,
    publicRuntimeDir,
    publicRuntimeBase,
  );
  const { bundle } = await import("@remotion/bundler");
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  const serveUrl = await bundle(path.join(projectRoot, "remotion", "index.ts"));
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
    frameDir: qualityFramesDir ?? path.join(path.dirname(outputPath), "quality-frames"),
    expectedDurationSeconds: renderData.duration,
    expectedWidth: renderData.width,
    expectedHeight: renderData.height,
    scenes: inputProps.scenes,
    assetManifest,
  });
  const qualityReport: VideoQualityReport = {
    ...postRenderReport,
    passed: gateReport.passed && postRenderReport.passed,
    errors: [...gateReport.errors, ...postRenderReport.errors],
    warnings: [...gateReport.warnings, ...postRenderReport.warnings],
    issues: [...gateReport.issues, ...postRenderReport.issues],
  };
  if (qualityReportPath) {
    await mkdir(path.dirname(qualityReportPath), { recursive: true });
    await writeFile(qualityReportPath, `${JSON.stringify(qualityReport, null, 2)}\n`, "utf8");
  }

  return { videoPath: outputPath, qualityReport };
};
