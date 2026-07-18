import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateMiniMaxAudio } from "@/lib/minimax-tts";

describe("generateMiniMaxAudio", () => {
  const originalApiKey = process.env.MINIMAX_API_KEY;

  beforeEach(() => {
    process.env.MINIMAX_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "https://example.com/subtitles.json") {
          return new Response(JSON.stringify({
            subtitles: [
              { text: "腾讯混元", start_time: 0, end_time: 1200 },
              { text: "Hy3正式发布", start_time: 1200, end_time: 2600 },
              { text: "这次重点是真实业务验证", start_time: 2600, end_time: 5200 },
            ],
          }), { status: 200 });
        }

        return new Response(JSON.stringify({
          data: {
            audio: Buffer.from("fake mp3").toString("hex"),
            subtitle_file: "https://example.com/subtitles.json",
          },
          extra_info: { audio_length: 5200 },
          base_resp: { status_code: 0, status_msg: "success" },
        }), { status: 200 });
      }),
    );
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.MINIMAX_API_KEY;
    } else {
      process.env.MINIMAX_API_KEY = originalApiKey;
    }
    vi.unstubAllGlobals();
  });

  test("writes the confirmed voiceover script next to generated audio", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "shin-minimax-"));
    const result = await generateMiniMaxAudio({
      text: "腾讯混元 Hy3 正式发布。\n\n这次重点是真实业务验证。",
      outputDir,
    });

    expect(result.voiceoverPath).toBe(join(outputDir, "口播文案.md"));
    await expect(readFile(result.voiceoverPath, "utf8")).resolves.toBe("腾讯混元 Hy3 正式发布。\n\n这次重点是真实业务验证。\n");
    expect(result.provider).toBe("minimax");
    expect(result.durationMs).toBe(5200);
    expect(result.timings).toEqual([
      { text: "腾讯混元", startMs: 0, endMs: 1200, kind: "word" },
      { text: "Hy3正式发布", startMs: 1200, endMs: 2600, kind: "word" },
      { text: "这次重点是真实业务验证", startMs: 2600, endMs: 5200, kind: "word" },
    ]);

    const request = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String((request[1] as RequestInit).body));
    expect(body.subtitle_enable).toBe(true);
    expect(body.subtitle_type).toBe("word");
  });

  test("fails when MiniMax does not return native timestamps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({
        data: { audio: Buffer.from("fake mp3").toString("hex") },
        extra_info: { audio_length: 1000 },
        base_resp: { status_code: 0, status_msg: "success" },
      }), { status: 200 })),
    );

    const outputDir = await mkdtemp(join(tmpdir(), "shin-minimax-"));
    await expect(generateMiniMaxAudio({
      text: "没有时间戳就不能继续。",
      outputDir,
    })).rejects.toThrow("原生时间戳");
  });

  test("fails when MiniMax returns overlapping native timing units", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input) === "https://example.com/subtitles.json") {
          return new Response(JSON.stringify({
            subtitles: [
              { text: "时间", start_time: 0, end_time: 800 },
              { text: "重叠", start_time: 700, end_time: 1400 },
            ],
          }), { status: 200 });
        }

        return new Response(JSON.stringify({
          data: {
            audio: Buffer.from("fake mp3").toString("hex"),
            subtitle_file: "https://example.com/subtitles.json",
          },
          extra_info: { audio_length: 1400 },
          base_resp: { status_code: 0, status_msg: "success" },
        }), { status: 200 });
      }),
    );

    const outputDir = await mkdtemp(join(tmpdir(), "shin-minimax-"));
    await expect(generateMiniMaxAudio({
      text: "时间重叠。",
      outputDir,
    })).rejects.toThrow("时间戳");
  });

  test("accepts provider subtitle JSON wrapped in data or returned as a root array", async () => {
    const payloads = [
      {
        data: {
          subtitles: [
            { text: "原生", start_time: 0, end_time: 500 },
            { text: "时间轴", start_time: 500, end_time: 1200 },
          ],
        },
      },
      [
        { text: "原生", start_time: 0, end_time: 500 },
        { text: "时间轴", start_time: 500, end_time: 1200 },
      ],
    ];

    for (const subtitlePayload of payloads) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL | Request) => {
          if (String(input) === "https://example.com/subtitles.json") {
            return new Response(JSON.stringify(subtitlePayload), { status: 200 });
          }

          return new Response(JSON.stringify({
            data: {
              audio: Buffer.from("fake mp3").toString("hex"),
              subtitle_file: "https://example.com/subtitles.json",
            },
            extra_info: { audio_length: 1200 },
            base_resp: { status_code: 0, status_msg: "success" },
          }), { status: 200 });
        }),
      );

      const outputDir = await mkdtemp(join(tmpdir(), "shin-minimax-"));
      const result = await generateMiniMaxAudio({
        text: "原生时间轴。",
        outputDir,
      });

      expect(result.timings).toEqual([
        { text: "原生", startMs: 0, endMs: 500, kind: "word" },
        { text: "时间轴", startMs: 500, endMs: 1200, kind: "word" },
      ]);
    }
  });

  test("parses the real MiniMax root-array payload and flattens timestamped words", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input) === "https://example.com/subtitles.json") {
          return new Response(JSON.stringify([
            {
              text: "真实时间轴。",
              time_begin: 0,
              time_end: 1400,
              text_begin: 0,
              text_end: 6,
              timestamped_words: [
                { word: "真", word_begin: 0, word_end: 1, time_begin: 40, time_end: 260 },
                { word: "实", word_begin: 1, word_end: 2, time_begin: 260, time_end: 520 },
                { word: "时", word_begin: 2, word_end: 3, time_begin: 520, time_end: 760 },
                { word: "间", word_begin: 3, word_end: 4, time_begin: 760, time_end: 980 },
                { word: "轴", word_begin: 4, word_end: 5, time_begin: 980, time_end: 1240 },
                { word: "。", word_begin: 5, word_end: 6, time_begin: 1240, time_end: 1280 },
              ],
            },
          ]), { status: 200 });
        }

        return new Response(JSON.stringify({
          data: {
            audio: Buffer.from("fake mp3").toString("hex"),
            subtitle_file: "https://example.com/subtitles.json",
          },
          extra_info: { audio_length: 1400 },
          base_resp: { status_code: 0, status_msg: "success" },
        }), { status: 200 });
      }),
    );

    const outputDir = await mkdtemp(join(tmpdir(), "shin-minimax-"));
    const result = await generateMiniMaxAudio({
      text: "真实时间轴。",
      outputDir,
    });

    expect(result.timings).toEqual([
      { text: "真", startMs: 40, endMs: 260, kind: "character", sourceStart: 0, sourceEnd: 1 },
      { text: "实", startMs: 260, endMs: 520, kind: "character", sourceStart: 1, sourceEnd: 2 },
      { text: "时", startMs: 520, endMs: 760, kind: "character", sourceStart: 2, sourceEnd: 3 },
      { text: "间", startMs: 760, endMs: 980, kind: "character", sourceStart: 3, sourceEnd: 4 },
      { text: "轴", startMs: 980, endMs: 1240, kind: "character", sourceStart: 4, sourceEnd: 5 },
      { text: "。", startMs: 1240, endMs: 1280, kind: "character", sourceStart: 5, sourceEnd: 6 },
    ]);
  });

  test("preserves global source offsets across MiniMax subtitle groups", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input) === "https://example.com/subtitles.json") {
          return new Response(JSON.stringify([
            {
              text: "第一句。",
              text_begin: 0,
              text_end: 4,
              timestamped_words: [
                { word: "第", word_begin: 0, word_end: 1, time_begin: 0, time_end: 200 },
                { word: "一", word_begin: 1, word_end: 2, time_begin: 200, time_end: 400 },
                { word: "句", word_begin: 2, word_end: 3, time_begin: 400, time_end: 600 },
                { word: "。", word_begin: 3, word_end: 4, time_begin: 600, time_end: 650 },
              ],
            },
            {
              text: "第二句。",
              text_begin: 4,
              text_end: 8,
              timestamped_words: [
                { word: "第", word_begin: 4, word_end: 5, time_begin: 800, time_end: 1000 },
                { word: "二", word_begin: 5, word_end: 6, time_begin: 1000, time_end: 1200 },
                { word: "句", word_begin: 6, word_end: 7, time_begin: 1200, time_end: 1400 },
                { word: "。", word_begin: 7, word_end: 8, time_begin: 1400, time_end: 1450 },
              ],
            },
          ]), { status: 200 });
        }

        return new Response(JSON.stringify({
          data: {
            audio: Buffer.from("fake mp3").toString("hex"),
            subtitle_file: "https://example.com/subtitles.json",
          },
          extra_info: { audio_length: 1500 },
          base_resp: { status_code: 0, status_msg: "success" },
        }), { status: 200 });
      }),
    );

    const outputDir = await mkdtemp(join(tmpdir(), "shin-minimax-"));
    const result = await generateMiniMaxAudio({
      text: "第一句。第二句。",
      outputDir,
    });

    expect(result.timings.at(4)).toMatchObject({
      text: "第",
      sourceStart: 4,
      sourceEnd: 5,
    });
    expect(result.timings.at(-1)).toMatchObject({
      text: "。",
      sourceStart: 7,
      sourceEnd: 8,
    });
  });

  test("rejects MiniMax timings that end after the reported audio duration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input) === "https://example.com/subtitles.json") {
          return new Response(JSON.stringify([
            {
              text: "越界。",
              timestamped_words: [
                { word: "越", word_begin: 0, word_end: 1, time_begin: 0, time_end: 500 },
                { word: "界", word_begin: 1, word_end: 2, time_begin: 500, time_end: 1100 },
                { word: "。", word_begin: 2, word_end: 3, time_begin: 1100, time_end: 1200 },
              ],
            },
          ]), { status: 200 });
        }

        return new Response(JSON.stringify({
          data: {
            audio: Buffer.from("fake mp3").toString("hex"),
            subtitle_file: "https://example.com/subtitles.json",
          },
          extra_info: { audio_length: 1000 },
          base_resp: { status_code: 0, status_msg: "success" },
        }), { status: 200 });
      }),
    );

    const outputDir = await mkdtemp(join(tmpdir(), "shin-minimax-"));
    await expect(generateMiniMaxAudio({
      text: "越界。",
      outputDir,
    })).rejects.toThrow("音频时长");
  });

  test("redacts the API key from provider status errors", async () => {
    process.env.MINIMAX_API_KEY = "minimax-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({
        data: {},
        base_resp: {
          status_code: 1001,
          status_msg: "invalid credential minimax-secret",
        },
      }), { status: 401 })),
    );

    const outputDir = await mkdtemp(join(tmpdir(), "shin-minimax-"));
    const error = await generateMiniMaxAudio({
      text: "密钥不能出现在错误中。",
      outputDir,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("minimax-secret");
    expect((error as Error).message).toContain("[REDACTED]");
  });

  test("redacts the API key from request failures", async () => {
    process.env.MINIMAX_API_KEY = "minimax-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network rejected minimax-secret");
      }),
    );

    const outputDir = await mkdtemp(join(tmpdir(), "shin-minimax-"));
    const error = await generateMiniMaxAudio({
      text: "请求失败也不能泄漏密钥。",
      outputDir,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("minimax-secret");
    expect((error as Error).message).toContain("[REDACTED]");
  });

  test("normalizes subtitle download failures without exposing the API key", async () => {
    process.env.MINIMAX_API_KEY = "minimax-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input) === "https://example.com/subtitles.json") {
          throw new Error("subtitle download rejected minimax-secret");
        }

        return new Response(JSON.stringify({
          data: {
            audio: Buffer.from("fake mp3").toString("hex"),
            subtitle_file: "https://example.com/subtitles.json",
          },
          extra_info: { audio_length: 1200 },
          base_resp: { status_code: 0, status_msg: "success" },
        }), { status: 200 });
      }),
    );

    const outputDir = await mkdtemp(join(tmpdir(), "shin-minimax-"));
    const error = await generateMiniMaxAudio({
      text: "字幕下载失败。",
      outputDir,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("MiniMax 原生时间戳下载失败：[REDACTED]");
  });
});
