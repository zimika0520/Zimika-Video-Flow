import { basename, extname } from "node:path";
import { errorJson, okJson, readJsonBody } from "@/lib/api-response";
import { createRunPaths, getRuntimeConfig } from "@/lib/paths";

const cleanAudioProjectName = (fileName?: string): string => {
  const fallback = "音频视频";
  if (!fileName) return fallback;

  const base = basename(fileName, extname(fileName)).trim();
  return base || fallback;
};

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ fileName?: string; projectName?: string }>(request);
    const projectName = body.projectName?.trim() || cleanAudioProjectName(body.fileName);
    const runPaths = createRunPaths(getRuntimeConfig().defaultOutputRoot, projectName);

    return okJson({ runPaths });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "创建音频项目失败", 500);
  }
}
