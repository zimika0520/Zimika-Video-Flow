import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { errorJson, okJson, readJsonBody } from "@/lib/api-response";
import { cleanupRenderArtifacts } from "@/lib/output-cleanup";
import { renderVideo } from "@/lib/remotion-render";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      scenesPath?: string;
      materialPackPath?: string;
      audioPath?: string;
      voiceoverPath?: string;
      subtitleTimelinePath?: string;
      videoBriefPath?: string;
      visualManifestPath?: string;
      assetManifestPath?: string;
      directorPlanPath?: string;
      styleProfilePath?: string;
      finalPath?: string;
      publicRuntimeDir?: string;
      publicRuntimeBase?: string;
    }>(request);

    if (!body.scenesPath || !body.audioPath || !body.voiceoverPath || !body.subtitleTimelinePath || !body.directorPlanPath || !body.styleProfilePath || !body.finalPath || !body.publicRuntimeDir || !body.publicRuntimeBase) {
      return errorJson("缺少导出参数");
    }

    await mkdir(dirname(body.finalPath), { recursive: true });
    const result = await renderVideo({
      scenesPath: body.scenesPath,
      materialPackPath: body.materialPackPath || undefined,
      audioPath: body.audioPath,
      voiceoverPath: body.voiceoverPath,
      subtitleTimelinePath: body.subtitleTimelinePath,
      videoBriefPath: body.videoBriefPath,
      visualManifestPath: body.visualManifestPath,
      assetManifestPath: body.assetManifestPath,
      directorPlanPath: body.directorPlanPath,
      styleProfilePath: body.styleProfilePath,
      outputPath: body.finalPath,
      publicRuntimeDir: body.publicRuntimeDir,
      publicRuntimeBase: body.publicRuntimeBase,
    });
    await cleanupRenderArtifacts({
      materialPackPath: body.materialPackPath || undefined,
      runDir: dirname(body.scenesPath),
      publicRuntimeDir: body.publicRuntimeDir,
    });

    return okJson(result);
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "导出 MP4 失败", 500);
  }
}
