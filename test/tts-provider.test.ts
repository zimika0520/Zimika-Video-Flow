import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import {
  buildSubtitleTimeline,
  createAudioFingerprint,
  createScriptFingerprint,
  type ProviderNativeSubtitleTimeline,
  validateSubtitleTimelineFiles,
} from "@/lib/tts-provider";

describe("provider-native subtitle timeline", () => {
  test("preserves the exact confirmed script while using provider timings", async () => {
    const root = await mkdtemp(join(tmpdir(), "shin-timeline-"));
    const audioPath = join(root, "voice.mp3");
    const scriptPath = join(root, "口播文案.md");
    const script = "腾讯混元 Hy3 正式发布。\n这次重点是真实业务验证。";
    await writeFile(audioPath, "audio-bytes");
    await writeFile(scriptPath, `${script}\n`, "utf8");

    const timeline = await buildSubtitleTimeline({
      provider: "minimax",
      audioPath,
      voiceoverPath: scriptPath,
      timings: [
        { text: "腾讯混元", startMs: 0, endMs: 900, kind: "word" },
        { text: "hy3正式发布", startMs: 900, endMs: 2100, kind: "word" },
        { text: "这次重点是", startMs: 2100, endMs: 3100, kind: "word" },
        { text: "真实业务验证", startMs: 3100, endMs: 4600, kind: "word" },
      ],
    });

    expect(timeline.source).toBe("provider-native");
    expect(timeline.provider).toBe("minimax");
    expect(timeline.segments.map((segment) => segment.text).join("")).toBe(script);
    expect(timeline.segments[0].text).toBe("腾讯混元 Hy3 正式发布。\n");
    expect(timeline.segments.at(-1)?.text).toBe("这次重点是真实业务验证。");
    await expect(validateSubtitleTimelineFiles({
      timeline,
      audioPath,
      voiceoverPath: scriptPath,
    })).resolves.toBeUndefined();
  });

  test("uses the least confident provider timing kind that contributes to a subtitle sentence", async () => {
    const root = await mkdtemp(join(tmpdir(), "shin-timeline-"));
    const audioPath = join(root, "voice.mp3");
    const scriptPath = join(root, "口播文案.md");
    await writeFile(audioPath, "audio-bytes");
    await writeFile(scriptPath, "词级时间和句级时间共同组成一句字幕。\n", "utf8");

    const timeline = await buildSubtitleTimeline({
      provider: "custom",
      audioPath,
      voiceoverPath: scriptPath,
      timings: [
        { text: "词级时间", startMs: 0, endMs: 800, kind: "word" },
        { text: "和句级时间共同组成一句字幕", startMs: 800, endMs: 2400, kind: "sentence" },
      ],
    });

    expect(timeline.segments).toHaveLength(1);
    expect(timeline.segments[0].timingConfidence).toBe(0.75);
  });

  test("rejects provider text that cannot map back to the confirmed script", async () => {
    const root = await mkdtemp(join(tmpdir(), "shin-timeline-"));
    const audioPath = join(root, "voice.mp3");
    const scriptPath = join(root, "口播文案.md");
    await writeFile(audioPath, "audio-bytes");
    await writeFile(scriptPath, "确认文案是苹果。\n", "utf8");

    await expect(buildSubtitleTimeline({
      provider: "volcengine",
      audioPath,
      voiceoverPath: scriptPath,
      timings: [
        { text: "确认文案是香蕉", startMs: 0, endMs: 1200, kind: "sentence" },
      ],
    })).rejects.toThrow("无法映射");
  });

  test.each([
    {
      label: "negative start",
      timings: [{ text: "一句完整口播", startMs: -1, endMs: 1000, kind: "sentence" as const }],
    },
    {
      label: "non-finite start",
      timings: [{ text: "一句完整口播", startMs: Number.NaN, endMs: 1000, kind: "sentence" as const }],
    },
    {
      label: "zero duration",
      timings: [{ text: "一句完整口播", startMs: 1000, endMs: 1000, kind: "sentence" as const }],
    },
    {
      label: "overlap",
      timings: [
        { text: "一句", startMs: 0, endMs: 700, kind: "word" as const },
        { text: "完整口播", startMs: 600, endMs: 1200, kind: "word" as const },
      ],
    },
    {
      label: "out of order",
      timings: [
        { text: "一句", startMs: 700, endMs: 1200, kind: "word" as const },
        { text: "完整口播", startMs: 0, endMs: 700, kind: "word" as const },
      ],
    },
  ])("rejects invalid provider timing units: $label", async ({ timings }) => {
    const root = await mkdtemp(join(tmpdir(), "shin-timeline-"));
    const scriptPath = join(root, "口播文案.md");
    await writeFile(scriptPath, "一句完整口播。\n", "utf8");

    await expect(buildSubtitleTimeline({
      provider: "custom",
      audioPath: join(root, "voice.mp3"),
      voiceoverPath: scriptPath,
      timings,
    })).rejects.toThrow("时间戳");
  });

  test("rejects missing timings and stale audio or script fingerprints", async () => {
    const root = await mkdtemp(join(tmpdir(), "shin-timeline-"));
    const audioPath = join(root, "voice.mp3");
    const scriptPath = join(root, "口播文案.md");
    await writeFile(audioPath, "audio-v1");
    await writeFile(scriptPath, "一句完整口播。\n", "utf8");

    const timeline = {
      subtitleTimelineVersion: 1,
      source: "provider-native" as const,
      provider: "custom" as const,
      audioFingerprint: await createAudioFingerprint(audioPath),
      scriptFingerprint: createScriptFingerprint("一句完整口播。"),
      segments: [
        {
          id: "caption-0001",
          text: "一句完整口播。",
          start: 0,
          end: 1,
          timingConfidence: 1,
        },
      ],
    };

    await writeFile(audioPath, "audio-v2");
    await expect(validateSubtitleTimelineFiles({
      timeline,
      audioPath,
      voiceoverPath: scriptPath,
    })).rejects.toThrow("音频指纹");

    await writeFile(audioPath, "audio-v1");
    await writeFile(scriptPath, "一句被修改的口播。\n", "utf8");
    await expect(validateSubtitleTimelineFiles({
      timeline,
      audioPath,
      voiceoverPath: scriptPath,
    })).rejects.toThrow("文案指纹");
  });

  test("rejects tampered subtitle text, invalid intervals, source, or confidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "shin-timeline-"));
    const audioPath = join(root, "voice.mp3");
    const scriptPath = join(root, "口播文案.md");
    const script = "第一句。\n第二句。";
    await writeFile(audioPath, "audio-v1");
    await writeFile(scriptPath, `${script}\n`, "utf8");

    const timeline = await buildSubtitleTimeline({
      provider: "custom",
      audioPath,
      voiceoverPath: scriptPath,
      timings: [
        { text: "第一句", startMs: 0, endMs: 1000, kind: "sentence" },
        { text: "第二句", startMs: 1000, endMs: 2000, kind: "sentence" },
      ],
    });

    const tamperedText = structuredClone(timeline);
    tamperedText.segments[0].text = "篡改句。\n";
    await expect(validateSubtitleTimelineFiles({
      timeline: tamperedText,
      audioPath,
      voiceoverPath: scriptPath,
    })).rejects.toThrow("字幕文本");

    const invalidInterval = structuredClone(timeline);
    invalidInterval.segments[0].end = invalidInterval.segments[0].start;
    await expect(validateSubtitleTimelineFiles({
      timeline: invalidInterval,
      audioPath,
      voiceoverPath: scriptPath,
    })).rejects.toThrow("时间区间");

    const overlapping = structuredClone(timeline);
    overlapping.segments[1].start = overlapping.segments[0].end - 0.1;
    await expect(validateSubtitleTimelineFiles({
      timeline: overlapping,
      audioPath,
      voiceoverPath: scriptPath,
    })).rejects.toThrow("递增");

    const invalidConfidence = structuredClone(timeline);
    invalidConfidence.segments[0].timingConfidence = 1.1;
    await expect(validateSubtitleTimelineFiles({
      timeline: invalidConfidence,
      audioPath,
      voiceoverPath: scriptPath,
    })).rejects.toThrow("置信度");

    const invalidSource = {
      ...structuredClone(timeline),
      source: "manual",
    } as unknown as ProviderNativeSubtitleTimeline;
    await expect(validateSubtitleTimelineFiles({
      timeline: invalidSource,
      audioPath,
      voiceoverPath: scriptPath,
    })).rejects.toThrow("来源");
  });
});
