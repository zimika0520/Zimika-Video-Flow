import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { resolveScenePrimaryVisual } from "./scene-primary-visual";
import type {
  QualityIssue,
  RuntimeAssetManifest,
  Scene,
  VideoQualityReport,
} from "./types";

const execFile = promisify(execFileCallback);

export type VideoProbe = {
  durationSeconds: number;
  width: number;
  height: number;
  sizeBytes: number;
};

export type BlackSegment = {
  start: number;
  end: number;
  duration: number;
};

export type SceneFrameCapture = {
  sceneId: string;
  timestampSeconds: number;
  framePath: string;
};

export type EvaluatePostRenderQaInput = {
  videoPath: string;
  expectedDurationSeconds: number;
  expectedWidth: number;
  expectedHeight: number;
  probe: VideoProbe;
  framePaths: string[];
  blackSegments: BlackSegment[];
  sceneFrames?: Array<{ sceneId: string; framePath: string }>;
  frameSimilarities?: Array<{
    leftSceneId: string;
    rightSceneId: string;
    similarity: number;
    adjacent: boolean;
  }>;
  primaryVisualUsage?: Array<{
    sceneId: string;
    assetId: string;
    fileName: string;
    rendered: boolean;
  }>;
};

const postRenderIssue = (
  code: string,
  message: string,
  suggestedAction: QualityIssue["suggestedAction"],
  severity: QualityIssue["severity"] = "error",
  sceneId?: string,
): QualityIssue => ({
  code,
  message,
  severity,
  stage: "post-render",
  suggestedAction,
  sceneId,
});

export const assertDeliverableQualityReport = (
  report: VideoQualityReport,
): void => {
  if (report.passed) return;
  const reasons = report.errors.length > 0
    ? report.errors.join("；")
    : "存在未解决的渲染后质量问题";
  throw new Error(`渲染后质量检查未通过，禁止交付最终视频：${reasons}`);
};

export const evaluatePostRenderQa = ({
  videoPath,
  expectedDurationSeconds,
  expectedWidth,
  expectedHeight,
  probe,
  framePaths,
  blackSegments,
  sceneFrames = [],
  frameSimilarities = [],
  primaryVisualUsage = [],
}: EvaluatePostRenderQaInput): VideoQualityReport => {
  const issues: QualityIssue[] = [];
  if (probe.sizeBytes <= 0 || probe.durationSeconds <= 0) {
    issues.push(postRenderIssue("render.invalid-media", "渲染文件为空或没有有效视频时长", "rerender"));
  }
  if (Math.abs(probe.durationSeconds - expectedDurationSeconds) > Math.max(1, expectedDurationSeconds * 0.08)) {
    issues.push(
      postRenderIssue(
        "render.duration-mismatch",
        `成片时长 ${probe.durationSeconds.toFixed(2)} 秒与预期 ${expectedDurationSeconds.toFixed(2)} 秒不一致`,
        "rerender",
      ),
    );
  }
  if (probe.width !== expectedWidth || probe.height !== expectedHeight) {
    issues.push(
      postRenderIssue(
        "render.dimension-mismatch",
        `成片尺寸为 ${probe.width}x${probe.height}，预期为 ${expectedWidth}x${expectedHeight}`,
        "rerender",
      ),
    );
  }
  if (blackSegments.some((segment) => segment.duration >= 1.5)) {
    issues.push(postRenderIssue("render.long-black-frame", "成片包含持续 1.5 秒以上的明显黑帧", "review-frame"));
  }
  if (framePaths.length < 3) {
    issues.push(postRenderIssue("render.frames-missing", "未能生成足够的代表帧供审片", "rerender"));
  }

  const adjacentSimilarities = frameSimilarities.filter(
    (item) => item.adjacent && item.similarity >= 0.975,
  );
  for (let index = 0; index < sceneFrames.length - 2; index += 1) {
    const first = sceneFrames[index];
    const second = sceneFrames[index + 1];
    const third = sceneFrames[index + 2];
    const firstPair = adjacentSimilarities.some(
      (item) =>
        item.leftSceneId === first.sceneId &&
        item.rightSceneId === second.sceneId,
    );
    const secondPair = adjacentSimilarities.some(
      (item) =>
        item.leftSceneId === second.sceneId &&
        item.rightSceneId === third.sceneId,
    );
    if (!firstPair || !secondPair) continue;
    issues.push(
      postRenderIssue(
        "render.repeated-composition",
        `连续镜头 ${first.sceneId}、${second.sceneId}、${third.sceneId} 的最终构图高度相似`,
        "review-frame",
      ),
    );
    break;
  }

  for (const usage of primaryVisualUsage) {
    if (usage.rendered) continue;
    issues.push(
      postRenderIssue(
        "render.primary-visual-missing",
        `${usage.sceneId} 的主视觉素材 ${usage.fileName} 未实际渲染`,
        "replace-asset",
        "error",
        usage.sceneId,
      ),
    );
  }

  const usageByAsset = new Map<string, typeof primaryVisualUsage>();
  for (const usage of primaryVisualUsage.filter((item) => item.rendered)) {
    const key = usage.assetId || usage.fileName;
    usageByAsset.set(key, [...(usageByAsset.get(key) ?? []), usage]);
  }
  for (const [assetId, usages] of usageByAsset) {
    if (usages.length < 3) continue;
    issues.push(
      postRenderIssue(
        "render.asset-overused",
        `主视觉素材 ${usages[0].fileName || assetId} 连续/高频复用 ${usages.length} 次，容易形成套模板观感`,
        "replace-asset",
        "warning",
      ),
    );
  }

  const warnings = issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);
  return {
    passed: issues.every((issue) => issue.severity !== "error"),
    errors: issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.message),
    warnings,
    issues,
    checkedAt: new Date().toISOString(),
    render: {
      videoPath,
      durationSeconds: probe.durationSeconds,
      width: probe.width,
      height: probe.height,
      sizeBytes: probe.sizeBytes,
      framePaths,
      blackSegments,
      sceneFrames,
      frameSimilarities,
      primaryVisualUsage,
    },
  };
};

const probeVideo = async (videoPath: string): Promise<VideoProbe> => {
  const [{ stdout }, file] = await Promise.all([
    execFile("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height:format=duration",
      "-of",
      "json",
      videoPath,
    ]),
    stat(videoPath),
  ]);
  const data = JSON.parse(stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  return {
    durationSeconds: Number(data.format?.duration ?? 0),
    width: Number(data.streams?.[0]?.width ?? 0),
    height: Number(data.streams?.[0]?.height ?? 0),
    sizeBytes: file.size,
  };
};

const detectBlackSegments = async (videoPath: string): Promise<BlackSegment[]> => {
  try {
    const { stderr } = await execFile("ffmpeg", [
      "-hide_banner",
      "-i",
      videoPath,
      "-vf",
      "blackdetect=d=0.5:pix_th=0.10",
      "-an",
      "-f",
      "null",
      "-",
    ]);
    return [...stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)].map((match) => ({
      start: Number(match[1]),
      end: Number(match[2]),
      duration: Number(match[3]),
    }));
  } catch (error) {
    const stderr = String((error as { stderr?: string }).stderr ?? "");
    return [...stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)].map((match) => ({
      start: Number(match[1]),
      end: Number(match[2]),
      duration: Number(match[3]),
    }));
  }
};

const extractRepresentativeFrames = async (
  videoPath: string,
  frameDir: string,
  durationSeconds: number,
): Promise<string[]> => {
  await mkdir(frameDir, { recursive: true });
  const timestamps = [0.12, 0.5, 0.88].map((ratio) => Math.max(0, durationSeconds * ratio));
  const framePaths: string[] = [];
  for (const [index, timestamp] of timestamps.entries()) {
    const framePath = path.join(frameDir, `frame-${String(index + 1).padStart(2, "0")}.jpg`);
    await execFile("ffmpeg", ["-y", "-ss", timestamp.toFixed(3), "-i", videoPath, "-frames:v", "1", "-q:v", "2", framePath]);
    framePaths.push(framePath);
  }
  return framePaths;
};

const safeSceneFileName = (sceneId: string): string =>
  sceneId.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "scene";

export const planSceneFrameCaptures = (
  scenes: Scene[],
  frameDir: string,
): SceneFrameCapture[] =>
  scenes.map((scene) => ({
    sceneId: scene.id,
    timestampSeconds: Math.max(0, scene.start + (scene.end - scene.start) / 2),
    framePath: path.join(frameDir, "scenes", `${safeSceneFileName(scene.id)}.jpg`),
  }));

export const computeGrayscaleSimilarity = (
  left: Uint8Array,
  right: Uint8Array,
): number => {
  if (left.length === 0 || left.length !== right.length) return 0;
  let leftMean = 0;
  let rightMean = 0;
  for (let index = 0; index < left.length; index += 1) {
    leftMean += left[index];
    rightMean += right[index];
  }
  leftMean /= left.length;
  rightMean /= right.length;

  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftCentered = left[index] - leftMean;
    const rightCentered = right[index] - rightMean;
    covariance += leftCentered * rightCentered;
    leftVariance += leftCentered * leftCentered;
    rightVariance += rightCentered * rightCentered;
  }

  if (leftVariance === 0 || rightVariance === 0) {
    return Math.max(0, 1 - Math.abs(leftMean - rightMean) / 255);
  }
  const correlation = covariance / Math.sqrt(leftVariance * rightVariance);
  return Math.max(0, Math.min(1, (correlation + 1) / 2));
};

const extractSceneFrames = async (
  videoPath: string,
  captures: SceneFrameCapture[],
): Promise<Array<{ sceneId: string; framePath: string }>> => {
  if (captures.length === 0) return [];
  await mkdir(path.dirname(captures[0].framePath), { recursive: true });
  for (const capture of captures) {
    await execFile("ffmpeg", [
      "-y",
      "-ss",
      capture.timestampSeconds.toFixed(3),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      capture.framePath,
    ]);
  }
  return captures.map(({ sceneId, framePath }) => ({ sceneId, framePath }));
};

const readNormalizedGrayscaleFrame = async (
  framePath: string,
): Promise<Uint8Array> => {
  const grayPath = `${framePath}.gray`;
  try {
    await execFile("ffmpeg", [
      "-y",
      "-i",
      framePath,
      "-vf",
      "scale=32:18,format=gray",
      "-f",
      "rawvideo",
      grayPath,
    ]);
    return new Uint8Array(await readFile(grayPath));
  } finally {
    await rm(grayPath, { force: true });
  }
};

const compareAdjacentSceneFrames = async (
  sceneFrames: Array<{ sceneId: string; framePath: string }>,
): Promise<EvaluatePostRenderQaInput["frameSimilarities"]> => {
  const normalized = await Promise.all(
    sceneFrames.map(async (frame) => ({
      ...frame,
      pixels: await readNormalizedGrayscaleFrame(frame.framePath),
    })),
  );
  return normalized.slice(0, -1).map((left, index) => {
    const right = normalized[index + 1];
    return {
      leftSceneId: left.sceneId,
      rightSceneId: right.sceneId,
      similarity: computeGrayscaleSimilarity(left.pixels, right.pixels),
      adjacent: true,
    };
  });
};

export const derivePrimaryVisualUsage = (
  scenes: Scene[],
  manifest?: RuntimeAssetManifest,
): NonNullable<EvaluatePostRenderQaInput["primaryVisualUsage"]> => {
  if (!manifest) return [];
  const assetById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const usage: NonNullable<EvaluatePostRenderQaInput["primaryVisualUsage"]> = [];
  for (const scene of scenes) {
    const selected = resolveScenePrimaryVisual(scene, manifest);
    if (selected) {
      usage.push({
        sceneId: scene.id,
        assetId: selected.assetId,
        fileName: selected.fileName,
        rendered: true,
      });
      continue;
    }

    const binding = manifest.sceneBindings.find((item) => item.sceneId === scene.id);
    const expectedAsset = binding?.assetIds
      .map((assetId) => assetById.get(assetId))
      .find(Boolean);
    if (expectedAsset) {
      usage.push({
        sceneId: scene.id,
        assetId: expectedAsset.id,
        fileName: expectedAsset.fileName,
        rendered: false,
      });
    }
  }
  return usage;
};

export const runPostRenderQa = async (input: {
  videoPath: string;
  frameDir: string;
  expectedDurationSeconds: number;
  expectedWidth: number;
  expectedHeight: number;
  scenes?: Scene[];
  assetManifest?: RuntimeAssetManifest;
}): Promise<VideoQualityReport> => {
  const probe = await probeVideo(input.videoPath);
  const captures = planSceneFrameCaptures(input.scenes ?? [], input.frameDir);
  const [framePaths, blackSegments, sceneFrames] = await Promise.all([
    extractRepresentativeFrames(input.videoPath, input.frameDir, probe.durationSeconds),
    detectBlackSegments(input.videoPath),
    extractSceneFrames(input.videoPath, captures),
  ]);
  const frameSimilarities = await compareAdjacentSceneFrames(sceneFrames);
  const primaryVisualUsage = derivePrimaryVisualUsage(
    input.scenes ?? [],
    input.assetManifest,
  );
  return evaluatePostRenderQa({
    ...input,
    probe,
    framePaths,
    blackSegments,
    sceneFrames,
    frameSimilarities,
    primaryVisualUsage,
  });
};
