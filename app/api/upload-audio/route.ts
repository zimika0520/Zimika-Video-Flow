import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { errorJson, okJson } from "@/lib/api-response";
import { parseProviderNativeSubtitleTimeline } from "@/lib/tts-provider";

const allowedExtensions = new Set([".mp3", ".wav", ".m4a"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("audio");
    const subtitleTimelineInput = form.get("subtitleTimeline");
    const voiceoverText = String(form.get("voiceoverText") ?? "");
    const runDir = String(form.get("runDir") ?? "");

    if (!(file instanceof File)) {
      return errorJson("请拖入或上传 mp3 / wav / m4a 音频文件");
    }
    if (!(subtitleTimelineInput instanceof File) && typeof subtitleTimelineInput !== "string") {
      return errorJson("外部音频必须同时提供服务商原生时间轴 JSON");
    }
    if (!voiceoverText.trim()) {
      return errorJson("外部音频必须同时提供确认后的口播文案");
    }
    if (!runDir) {
      return errorJson("缺少输出目录");
    }

    const extension = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return errorJson("仅支持 mp3 / wav / m4a");
    }

    const timelineText = subtitleTimelineInput instanceof File
      ? await subtitleTimelineInput.text()
      : subtitleTimelineInput;
    let parsedTimeline: unknown;
    try {
      parsedTimeline = JSON.parse(timelineText);
    } catch {
      return errorJson("服务商原生时间轴不是有效 JSON");
    }
    const timeline = parseProviderNativeSubtitleTimeline(parsedTimeline);

    await mkdir(runDir, { recursive: true });
    const token = randomUUID();
    const tempAudioPath = path.join(runDir, `.upload-${token}${extension}`);
    const tempVoiceoverPath = path.join(runDir, `.voiceover-${token}.md`);
    const tempTimelinePath = path.join(runDir, `.timeline-${token}.json`);
    const audioPath = path.join(runDir, `口播音频${extension}`);
    const voiceoverPath = path.join(runDir, "口播文案.md");
    const subtitleTimelinePath = path.join(runDir, "subtitle-timeline.json");

    try {
      await writeFile(tempAudioPath, Buffer.from(await file.arrayBuffer()));
      await writeFile(tempVoiceoverPath, `${voiceoverText.replace(/(?:\r?\n)+$/, "")}\n`, "utf8");
      await writeFile(tempTimelinePath, `${JSON.stringify(timeline, null, 2)}\n`, "utf8");

      await rename(tempAudioPath, audioPath);
      await rename(tempVoiceoverPath, voiceoverPath);
      await rename(tempTimelinePath, subtitleTimelinePath);
    } finally {
      await Promise.all([
        rm(tempAudioPath, { force: true }),
        rm(tempVoiceoverPath, { force: true }),
        rm(tempTimelinePath, { force: true }),
      ]);
    }

    return okJson({
      audioPath,
      fileName: file.name,
      voiceoverPath,
      subtitleTimelinePath,
      provider: timeline.provider,
    });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "音频包读取失败", 500);
  }
}
