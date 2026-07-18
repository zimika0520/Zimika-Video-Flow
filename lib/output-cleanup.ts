import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const removeIfExists = async (targetPath: string) => {
  await rm(targetPath, { recursive: true, force: true });
};

export const cleanupRenderArtifacts = async ({
  materialPackPath,
  runDir,
  publicRuntimeDir,
}: {
  materialPackPath?: string;
  runDir?: string;
  publicRuntimeDir?: string;
}) => {
  const targets = [
    materialPackPath ? path.join(materialPackPath, "自检帧") : undefined,
    runDir ? path.join(runDir, "自检帧") : undefined,
    runDir ? path.join(runDir, "quality-frames") : undefined,
    runDir ? path.join(runDir, "quality-report.json") : undefined,
    runDir ? path.join(runDir, "production-gate-report.json") : undefined,
    runDir ? path.join(runDir, "preview.mp4") : undefined,
    publicRuntimeDir,
  ].filter((target): target is string => Boolean(target));

  await Promise.all(targets.map(removeIfExists));
};

export const cleanupExistingSelfCheckFrames = async (rootDir: string) => {
  const dirs: string[] = [];

  const walk = async (dir: string) => {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const entryPath = path.join(dir, entry.name);
      if (entry.name === "自检帧") {
        dirs.push(entryPath);
        continue;
      }

      await walk(entryPath);
    }
  };

  await walk(rootDir);

  await Promise.all(dirs.map(removeIfExists));
  return dirs;
};
