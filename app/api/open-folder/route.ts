import { spawn } from "node:child_process";
import { errorJson, okJson, readJsonBody } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ folderPath?: string }>(request);
    if (!body.folderPath) {
      return errorJson("缺少文件夹路径");
    }

    spawn("open", [body.folderPath], { stdio: "ignore", detached: true }).unref();
    return okJson({ opened: true });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "打开文件夹失败", 500);
  }
}
