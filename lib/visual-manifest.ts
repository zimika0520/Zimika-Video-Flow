import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSourceScenesFingerprint } from "./director-plan";
import type { RuntimeVisualManifest, Scene, VisualManifestScene } from "./types";

const sceneText = (scene: Scene): string =>
  scene.visualBrief?.headline ||
  scene.content?.headline ||
  scene.content?.sceneTitle ||
  scene.content?.centerLabel ||
  scene.title ||
  scene.subtitle;

const visualGoalForScene = (scene: Scene): string => {
  const type = scene.directorType ?? scene.sceneType ?? "Scene";
  return `${type} 镜头只解释本段核心信息：${sceneText(scene)}`;
};

export const buildVisualManifestFromScenes = (scenes: Scene[]): RuntimeVisualManifest => ({
  visualManifestVersion: 1,
  sourceScenesFingerprint: createSourceScenesFingerprint(scenes),
  scenes: scenes.map(
    (scene): VisualManifestScene => ({
      sceneId: scene.id,
      visualGoal: visualGoalForScene(scene),
      primaryVisualAsset: scene.primaryVisualAsset ?? scene.primaryAsset ?? scene.images[0],
      evidenceAsset: scene.evidenceAsset,
      narrationClaim: scene.subtitle,
      targetRegion: {
        coordinateSpace: "normalized_frame",
        x: 0.08,
        y: 0.08,
        width: 0.84,
        height: 0.7,
        description: "主视觉保留在画面上方与中部，底部留给字幕条。",
      },
      safeZones: {
        subtitle: "bottom",
        mainVisualAvoidsSubtitle: true,
      },
      overlapRisks: ["底部字幕区", "大标题与数据卡", "素材裁切边缘"],
      forbiddenReuse: ["复用上一条视频背景", "整屏复读字幕", "连续使用同一图标/K线模板"],
      whyThisVisual: scene.visualIntent
        ? `当前 visualIntent 为 ${scene.visualIntent}，应服务于画面解释而不是字幕复写。`
        : "根据本 scene 的导演类型和口播主张选择可视化方式。",
    }),
  ),
});

export const writeRuntimeVisualManifest = async (visualManifestPath: string, manifest: RuntimeVisualManifest): Promise<void> => {
  await mkdir(path.dirname(visualManifestPath), { recursive: true });
  await writeFile(visualManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
};

export const readRuntimeVisualManifest = async (visualManifestPath: string): Promise<RuntimeVisualManifest> => {
  const manifest = JSON.parse(await readFile(visualManifestPath, "utf8")) as RuntimeVisualManifest;
  if (!manifest.visualManifestVersion) {
    throw new Error("runtime/visual-manifest.json 缺少 visualManifestVersion");
  }
  if (!Array.isArray(manifest.scenes)) {
    throw new Error("runtime/visual-manifest.json 缺少 scenes");
  }
  return manifest;
};
