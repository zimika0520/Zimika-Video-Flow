import { basename } from "node:path";
import { createRunPaths, getRuntimeConfig } from "@/lib/paths";
import { validateMaterialPack } from "@/lib/material-pack";
import { errorJson, okJson, readJsonBody } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ materialPackPath?: string }>(request);
    if (!body.materialPackPath) {
      return errorJson("请选择素材包文件夹");
    }

    const validation = await validateMaterialPack(body.materialPackPath);
    const materialPackName = basename(body.materialPackPath);
    const runPaths = createRunPaths(getRuntimeConfig().defaultOutputRoot, materialPackName, body.materialPackPath);

    return okJson({ validation, runPaths });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "素材包检查失败", 500);
  }
}
