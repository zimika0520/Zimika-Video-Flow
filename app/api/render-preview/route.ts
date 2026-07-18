import { errorJson, okJson, readJsonBody } from "@/lib/api-response";
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
      previewPath?: string;
      publicRuntimeDir?: string;
      publicRuntimeBase?: string;
    }>(request);

    if (!body.scenesPath || !body.audioPath || !body.voiceoverPath || !body.subtitleTimelinePath || !body.directorPlanPath || !body.styleProfilePath || !body.previewPath || !body.publicRuntimeDir || !body.publicRuntimeBase) {
      return errorJson("缺少 Remotion 渲染参数");
    }

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
      outputPath: body.previewPath,
      publicRuntimeDir: body.publicRuntimeDir,
      publicRuntimeBase: body.publicRuntimeBase,
    });

    return okJson(result);
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "渲染预览失败", 500);
  }
}
