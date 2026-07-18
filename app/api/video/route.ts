import { readFile } from "node:fs/promises";
import path from "node:path";
import { errorJson } from "@/lib/api-response";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const videoPath = url.searchParams.get("path");

  if (!videoPath) {
    return errorJson("缺少视频路径");
  }

  try {
    const file = await readFile(videoPath);
    const extension = path.extname(videoPath).toLowerCase();
    const contentType = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : extension === ".png" ? "image/png" : "video/mp4";
    return new Response(file, {
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
  } catch {
    return errorJson("视频文件不存在", 404);
  }
}
