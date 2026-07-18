import { errorJson, okJson, readJsonBody } from "@/lib/api-response";
import type { VideoStyle } from "@/lib/editor-types";
import { writeRuntimeStyleProfile } from "@/lib/style-profile";
import type { RuntimeStyleProfile } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      style?: VideoStyle;
      aspectRatio?: RuntimeStyleProfile["aspectRatio"];
      styleProfilePath?: string;
    }>(request);

    if (!body.styleProfilePath) {
      return errorJson("缺少 style-profile 输出路径");
    }

    const styleProfile = await writeRuntimeStyleProfile(
      body.styleProfilePath,
      body.style || "light-finance-mg",
      body.aspectRatio || "16:9",
    );

    return okJson({ styleProfilePath: body.styleProfilePath, styleProfile });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "生成视觉风格配置失败", 500);
  }
}
