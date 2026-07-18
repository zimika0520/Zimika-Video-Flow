import path from "node:path";

export type RuntimeConfig = {
  defaultOutputRoot: string;
};

export type RunPaths = {
  runId: string;
  runDir: string;
  videoBriefPath: string;
  scenesPath: string;
  visualManifestPath: string;
  subtitleTimelinePath: string;
  assetManifestPath: string;
  directorPlanPath: string;
  styleProfilePath: string;
  publishingPackPath: string;
  finalPath: string;
  finalDir: string;
  publicRuntimeDir: string;
  publicRuntimeBase: string;
};

const projectRoot = process.cwd();
const defaultOutputRoot = path.join(projectRoot, "outputs");

export const getRuntimeConfig = (): RuntimeConfig => ({
  defaultOutputRoot: process.env.DEFAULT_OUTPUT_ROOT || defaultOutputRoot,
});

export const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "material-pack";
};

export const sanitizeOutputFileName = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);

  return cleaned || "未命名视频";
};

export const outputDateFolder = (timestamp = new Date().toISOString()): string => {
  const match = timestamp.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? new Date().toISOString().slice(0, 10);
};

export const createRunPaths = (
  outputRoot: string,
  materialPackName: string,
  materialPackPath?: string,
  timestamp = new Date().toISOString(),
): RunPaths => {
  const normalizedTimestamp = timestamp.replace(/[:.]/g, "-");
  const runId = `${normalizedTimestamp}-${slugify(materialPackName)}`;
  const dateDir = path.join(outputRoot, outputDateFolder(timestamp));
  const projectFolderName = sanitizeOutputFileName(materialPackName);
  const projectDir = path.join(dateDir, projectFolderName);
  const runDir = path.join(projectDir, "_runtime", runId);
  const publicRuntimeBase = `runtime/${runId}`;
  const finalDir = projectDir;
  const finalFileName = `${projectFolderName}.mp4`;

  return {
    runId,
    runDir,
    videoBriefPath: path.join(runDir, "video-brief.json"),
    scenesPath: path.join(runDir, "scenes.json"),
    visualManifestPath: path.join(runDir, "visual-manifest.json"),
    subtitleTimelinePath: path.join(runDir, "subtitle-timeline.json"),
    assetManifestPath: path.join(runDir, "asset-manifest.json"),
    directorPlanPath: path.join(runDir, "director-plan.json"),
    styleProfilePath: path.join(runDir, "style-profile.json"),
    publishingPackPath: path.join(finalDir, "publishing-pack.md"),
    finalPath: path.join(finalDir, finalFileName),
    finalDir,
    publicRuntimeDir: path.join(projectRoot, "public", "runtime", runId),
    publicRuntimeBase,
  };
};
