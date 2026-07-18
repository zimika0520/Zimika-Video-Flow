import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { errorJson, okJson, readJsonBody } from "@/lib/api-response";
import { cleanupRenderArtifacts } from "@/lib/output-cleanup";
import { assertDeliverableQualityReport } from "@/lib/post-render-qa";
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
      productionGateReportPath?: string;
      qualityReportPath?: string;
      qualityFramesDir?: string;
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
      productionGateReportPath: body.productionGateReportPath,
      qualityReportPath: body.qualityReportPath,
      qualityFramesDir: body.qualityFramesDir,
      outputPath: body.finalPath,
      publicRuntimeDir: body.publicRuntimeDir,
      publicRuntimeBase: body.publicRuntimeBase,
    });
    if (!result.qualityReport.passed) {
      await rm(result.videoPath, { force: true });
      assertDeliverableQualityReport(result.qualityReport);
    }
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
