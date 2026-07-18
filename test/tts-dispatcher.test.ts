import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateTtsAudio } from "@/lib/tts-dispatcher";

describe("TTS dispatcher", () => {
  const originalApiKey = process.env.MINIMAX_API_KEY;
  const originalProvider = process.env.SHIN_VIDEO_TTS_PROVIDER;

  beforeEach(() => {
    process.env.MINIMAX_API_KEY = "minimax-test-key";
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.MINIMAX_API_KEY;
    else process.env.MINIMAX_API_KEY = originalApiKey;
    if (originalProvider === undefined) delete process.env.SHIN_VIDEO_TTS_PROVIDER;
    else process.env.SHIN_VIDEO_TTS_PROVIDER = originalProvider;
    vi.unstubAllGlobals();
  });

  test("routes an explicit MiniMax request through the unified entry point", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      if (String(input) === "https://example.test/native-timestamps.json") {
        return new Response(JSON.stringify({
          subtitles: [
            { text: "统一入口", start_time: 0, end_time: 800 },
            { text: "调用MiniMax", start_time: 800, end_time: 1600 },
          ],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        data: {
          audio: Buffer.from("minimax-audio").toString("hex"),
          subtitle_file: "https://example.test/native-timestamps.json",
        },
        extra_info: { audio_length: 1600 },
        base_resp: { status_code: 0, status_msg: "success" },
      }), { status: 200 });
    }));

    const outputDir = await mkdtemp(path.join(tmpdir(), "shin-tts-dispatcher-"));
    await expect(generateTtsAudio({
      provider: "minimax",
      text: "统一入口调用 MiniMax。",
      outputDir,
    })).resolves.toMatchObject({ provider: "minimax", durationMs: 1600 });
  });

  test("uses the configured provider when the request does not specify one", async () => {
    process.env.SHIN_VIDEO_TTS_PROVIDER = "custom";
    process.env.CUSTOM_TTS_ENDPOINT = "https://tts.example.test/v1/generate";
    process.env.CUSTOM_TTS_API_KEY = "custom-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      audio_base64: Buffer.from("custom-audio").toString("base64"),
      duration_ms: 1000,
      timings: [
        { text: "环境变量选择服务商", start_ms: 0, end_ms: 1000, kind: "sentence" },
      ],
    }), { status: 200 })));

    const outputDir = await mkdtemp(path.join(tmpdir(), "shin-tts-dispatcher-"));
    await expect(generateTtsAudio({
      text: "环境变量选择服务商。",
      outputDir,
    })).resolves.toMatchObject({ provider: "custom" });
  });

  test("rejects unknown providers instead of silently falling back", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "shin-tts-dispatcher-"));
    await expect(generateTtsAudio({
      provider: "unknown-provider",
      text: "不能静默回退。",
      outputDir,
    })).rejects.toThrow("不支持的 TTS 服务商");
  });
});
