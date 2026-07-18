import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readRuntimeDirectorPlan } from "@/lib/director-plan";
import { readJsonIfExists, validateProductionGateFiles } from "@/lib/production-gate";
import { readRuntimeStyleProfile } from "@/lib/style-profile";
import { parseProviderNativeSubtitleTimeline } from "@/lib/tts-provider";
import type { RuntimeAssetManifest, RuntimeVideoBrief, RuntimeVisualManifest, Scene } from "@/lib/types";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=")];
  }),
);

const requiredArg = (key: string): string => {
  const value = args.get(key);
  if (!value) {
    throw new Error(`缺少参数 --${key}=...`);
  }
  return value;
};

const readJson = async <T>(filePath: string): Promise<T> => JSON.parse(await readFile(filePath, "utf8")) as T;

const main = async () => {
  const scenesPath = requiredArg("scenes");
  const reportPath = args.get("report") ?? path.join(path.dirname(scenesPath), "production-gate-report.json");
  const renderData = await readJson<{ scenes: Scene[] }>(scenesPath);
  const subtitleTimeline = parseProviderNativeSubtitleTimeline(
    await readJson<unknown>(requiredArg("subtitle-timeline")),
  );

  const report = await validateProductionGateFiles({
    scenes: renderData.scenes,
    captions: subtitleTimeline.segments,
    subtitleTimeline,
    videoBrief: args.get("video-brief")
      ? await readJsonIfExists<RuntimeVideoBrief>(args.get("video-brief")!)
      : undefined,
    assetManifest: args.get("asset-manifest")
      ? await readJsonIfExists<RuntimeAssetManifest>(args.get("asset-manifest")!)
      : undefined,
    visualManifest: args.get("visual-manifest")
      ? await readJsonIfExists<RuntimeVisualManifest>(args.get("visual-manifest")!)
      : undefined,
    directorPlan: await readRuntimeDirectorPlan(requiredArg("director-plan")),
    styleProfile: await readRuntimeStyleProfile(requiredArg("style-profile")),
    audioPath: requiredArg("audio"),
    voiceoverPath: requiredArg("voiceover"),
  });

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (!report.passed) {
    console.error(report.errors.join("\n"));
    process.exit(1);
  }

  console.log(`Production gate passed: ${reportPath}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
