import { errorJson, okJson, readJsonBody } from "@/lib/api-response";
import { renderTemplateProjectVideo } from "@/lib/template-project-pipeline";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      materialPackPath?: string;
      audioPath?: string;
    }>(request);

    if (!body.materialPackPath || !body.audioPath) {
      return errorJson("缺少模板工程素材包路径或音频路径");
    }

    const result = await renderTemplateProjectVideo({
      materialPackPath: body.materialPackPath,
      sourceAudioPath: body.audioPath,
    });

    return okJson(result);
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "模板工程渲染失败", 500);
  }
}
