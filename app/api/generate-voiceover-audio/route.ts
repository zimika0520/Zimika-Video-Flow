import { writeFile } from "node:fs/promises";
import path from "node:path";
import { errorJson, okJson, readJsonBody } from "@/lib/api-response";
import { generateTtsAudio } from "@/lib/tts-dispatcher";
import { buildSubtitleTimeline } from "@/lib/tts-provider";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      provider?: string;
      text?: string;
      outputDir?: string;
      materialPackPath?: string;
      voiceId?: string;
    }>(request);

    const outputDir = body.materialPackPath || body.outputDir;
    if (!outputDir) return errorJson("缺少音频输出目录");

    const audio = await generateTtsAudio({
      provider: body.provider,
      text: body.text || "",
      outputDir,
      voiceId: body.voiceId,
    });
    const subtitleTimeline = await buildSubtitleTimeline({
      provider: audio.provider,
      audioPath: audio.audioPath,
      voiceoverPath: audio.voiceoverPath,
      timings: audio.timings,
    });
    const subtitleTimelinePath = path.join(outputDir, "subtitle-timeline.json");
    await writeFile(
      subtitleTimelinePath,
      `${JSON.stringify(subtitleTimeline, null, 2)}\n`,
      "utf8",
    );

    return okJson({
      ...audio,
      provider: audio.provider,
      subtitleTimelinePath,
      subtitleTimeline,
    });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "TTS 生成口播音频失败", 500);
  }
}
