import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { errorJson, okJson, readJsonBody } from "@/lib/api-response";
import { createRunPaths, getRuntimeConfig, type RunPaths } from "@/lib/paths";

type ArchiveProjectBody = {
  projectName?: string;
  runPaths?: RunPaths | null;
  materialPackPath?: string;
  audioPath?: string;
  voiceoverPath?: string;
  subtitleTimelinePath?: string;
  videoPath?: string;
  videoStyle?: string;
  currentTime?: number;
  totalDuration?: number;
  elements?: unknown[];
};

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<ArchiveProjectBody>(request);
    const projectName = body.projectName?.trim() || "未命名视频";
    const audioPath = body.audioPath?.trim() || "";
    const voiceoverPath = body.voiceoverPath?.trim() || "";
    const subtitleTimelinePath = body.subtitleTimelinePath?.trim() || "";
    const audioPackageItemCount = [
      audioPath,
      voiceoverPath,
      subtitleTimelinePath,
    ].filter(Boolean).length;
    if (audioPackageItemCount > 0 && audioPackageItemCount < 3) {
      return errorJson(
        "口播音频、确认文案和服务商原生字幕时间轴必须同时提供",
        400,
      );
    }
    const runPaths = body.runPaths ?? createRunPaths(getRuntimeConfig().defaultOutputRoot, projectName);
    const archivePath = path.join(runPaths.runDir, "项目存档.json");

    await mkdir(runPaths.runDir, { recursive: true });
    await writeFile(
      archivePath,
      JSON.stringify(
        {
          projectName,
          archivedAt: new Date().toISOString(),
          runPaths,
          materialPackPath: body.materialPackPath || "",
          audioPath,
          voiceoverPath,
          subtitleTimelinePath,
          videoPath: body.videoPath || "",
          videoStyle: body.videoStyle || "",
          currentTime: body.currentTime ?? 0,
          totalDuration: body.totalDuration ?? 0,
          elements: body.elements ?? [],
        },
        null,
        2,
      ),
      "utf8",
    );

    return okJson({ archivePath, runPaths });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "项目存档失败", 500);
  }
}
