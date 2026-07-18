import { generateCustomTtsAudio } from "./custom-tts";
import { generateMiniMaxAudio } from "./minimax-tts";
import type { TtsGenerationResult, TtsProviderName } from "./tts-provider";
import { generateVolcengineAudio } from "./volcengine-tts";

export type GenerateTtsAudioInput = {
  provider?: TtsProviderName | string;
  text: string;
  outputDir: string;
  fileName?: string;
  voiceId?: string;
};

const resolveProvider = (requested?: string): TtsProviderName => {
  const provider = (requested || process.env.SHIN_VIDEO_TTS_PROVIDER || "minimax")
    .trim()
    .toLocaleLowerCase("en-US");
  if (provider === "minimax" || provider === "volcengine" || provider === "custom") {
    return provider;
  }
  throw new Error(`不支持的 TTS 服务商：${provider}`);
};

export const generateTtsAudio = async (
  input: GenerateTtsAudioInput,
): Promise<TtsGenerationResult> => {
  const provider = resolveProvider(input.provider);
  const commonInput = {
    text: input.text,
    outputDir: input.outputDir,
    fileName: input.fileName,
    voiceId: input.voiceId,
  };

  if (provider === "minimax") return generateMiniMaxAudio(commonInput);
  if (provider === "volcengine") return generateVolcengineAudio(commonInput);
  return generateCustomTtsAudio(commonInput);
};
