import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { bindAssetsToScenes, researchAssets } from "./asset-researcher";
import { writeDirectorReviewArtifacts, writeRuntimeDirectorPlan } from "./director-plan";
import { selectDirectorPlan } from "./director-selector";
import { createRunPaths, getRuntimeConfig, sanitizeOutputFileName } from "./paths";
import { assertDeliverableQualityReport } from "./post-render-qa";
import {
  readJsonIfExists,
  validateProductionGate,
  validateProductionGateFiles,
} from "./production-gate";
import {
  finalizeGeneratedScenesForRender,
  probeAudioDurationSeconds,
  resolveRenderDimensions,
} from "./render-metadata";
import { renderVideo } from "./remotion-render";
import { generateScenes } from "./scene-generator";
import { buildSceneSemanticContext } from "./scene-semantics";
import { writeRuntimeStyleProfile } from "./style-profile";
import {
  buildSubtitleTimeline,
  createScriptFingerprint,
  type ProviderNativeSubtitleTimeline,
  validateSubtitleTimelineFiles,
} from "./tts-provider";
import { generateTtsAudio } from "./tts-dispatcher";
import type { VideoStyle } from "./editor-types";
import type { RuntimeStyleProfile, RuntimeVideoBrief, TimelineSegment } from "./types";
import { buildRuntimeVideoBrief, writeRuntimeVideoBrief } from "./video-brief";
import { buildVisualManifestFromScenes, writeRuntimeVisualManifest } from "./visual-manifest";

export type ShinVideoLiteOptions = {
  article?: string;
  articlePath?: string;
  url?: string;
  title?: string;
  outputRoot?: string;
  voiceId?: string;
  ttsProvider?: "minimax" | "volcengine" | "custom";
  voiceoverPath?: string;
  audioPath?: string;
  subtitleTimelinePath?: string;
  generatedImageManifestPath?: string;
  style?: VideoStyle;
  aspectRatio?: "16:9" | "9:16";
  dryRun?: boolean;
  skipRender?: boolean;
};

export type ShinVideoLiteResult = {
  title: string;
  selectedStyle: VideoStyle;
  finalPath?: string;
  runDir: string;
  finalDir: string;
  voiceoverPath: string;
  audioPath?: string;
  videoBriefPath: string;
  scenesPath: string;
  subtitleTimelinePath: string;
  visualManifestPath: string;
  assetManifestPath: string;
  directorPlanPath: string;
  styleProfilePath: string;
  productionGateReportPath: string;
  publishingPackPath: string;
  warnings: string[];
};

const sentenceBreak = /(?<=[。！？!?；;])/g;

const normalizeWhitespace = (value: string): string => value.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

const stripHtml = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"");

const extractTitleFromText = (text: string, fallback = "Shin-video 成片"): string => {
  const firstLine = text
    .split(/\n/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find((line) => line.length >= 4 && line.length <= 48);
  return sanitizeOutputFileName(firstLine ?? fallback);
};

const splitSentences = (text: string): string[] => {
  const normalized = normalizeWhitespace(text).replace(/\n+/g, " ");
  const sentences = normalized
    .split(sentenceBreak)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8 && !/^(已关注|关注|重播|分享|赞|关闭|更多|退出全屏|倍速|视频详情)/.test(part));
  return sentences.length ? sentences : [normalized].filter(Boolean);
};

const scoreSentence = (sentence: string, index: number): number => {
  let score = Math.max(0, 16 - index * 0.2);
  if (/\d|%|倍|亿|万|美元|元|tokens?|Token|参数|成本|价格|订单|增长|下降|提升|降低/i.test(sentence)) score += 8;
  if (/发布|宣布|上线|突破|首次|核心|关键|原因|意味着|风险|问题|结果|结论/.test(sentence)) score += 6;
  if (/但是|不过|真正|更重要|换句话说|本质/.test(sentence)) score += 4;
  if (sentence.length > 90) score -= 5;
  return score;
};

const buildVoiceover = (article: string, targetChars = 620): string => {
  const sentences = splitSentences(article);
  const selected = sentences
    .map((sentence, index) => ({ sentence, index, score: scoreSentence(sentence, index) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(14, sentences.length))
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

  const lead = selected[0] ?? sentences[0] ?? "这条视频快速讲清楚一个值得关注的新变化。";
  const body: string[] = [
    `这条消息最值得看的，不是标题本身，而是它背后正在发生的变化。${lead}`,
  ];

  for (const sentence of selected.slice(1)) {
    const next = sentence.replace(/^(今年|目前|同时|此外|除了|而且)/, "");
    if (body.join("").length + next.length > targetChars) break;
    body.push(next);
  }

  const joined = body.join("");
  const closing = "所以这件事不能只看热闹，要看它是否真的改变了成本、效率和产业分工。";
  return `${joined}${joined.length + closing.length <= targetChars + 80 ? closing : ""}`;
};

const buildSyntheticTimeline = (voiceover: string): TimelineSegment[] => {
  const chars = Math.max(voiceover.replace(/\s+/g, "").length, 1);
  const duration = Math.max(12, Number((chars / 4.2).toFixed(3)));
  const units = normalizeWhitespace(voiceover)
    .replace(/\n+/g, " ")
    .split(/(?<=[。！？!?；;，,：:])/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const characters = Array.from(part);
      const chunks: string[] = [];
      for (let index = 0; index < characters.length; index += 20) {
        chunks.push(characters.slice(index, index + 20).join(""));
      }
      return chunks;
    });
  const requiredCount = Math.max(1, Math.ceil(duration / 8));
  while (units.length < requiredCount) {
    const longestIndex = units.reduce(
      (bestIndex, unit, index) =>
        Array.from(unit).length > Array.from(units[bestIndex] ?? "").length
          ? index
          : bestIndex,
      0,
    );
    const characters = Array.from(units[longestIndex] ?? "");
    if (characters.length < 2) break;
    const midpoint = Math.ceil(characters.length / 2);
    units.splice(
      longestIndex,
      1,
      characters.slice(0, midpoint).join(""),
      characters.slice(midpoint).join(""),
    );
  }

  const weights = units.map((unit) =>
    Math.max(unit.replace(/\s+/g, "").length, 1),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let cursor = 0;

  return units.map((unit, index) => {
    const start = cursor;
    cursor =
      index === units.length - 1
        ? duration
        : cursor + (duration * weights[index]) / totalWeight;
    return {
      id: `seg-${String(index + 1).padStart(4, "0")}`,
      start: Number(start.toFixed(3)),
      end: Number(cursor.toFixed(3)),
      text: unit,
    };
  });
};

const readArticleSource = async (options: ShinVideoLiteOptions): Promise<{ article: string; source: string }> => {
  if (options.article?.trim()) return { article: normalizeWhitespace(options.article), source: "inline-article" };
  if (options.articlePath) return { article: normalizeWhitespace(await readFile(options.articlePath, "utf8")), source: options.articlePath };
  if (options.url) {
    const response = await fetch(options.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 Shin-video-lite",
      },
    });
    if (!response.ok) {
      throw new Error(`文章链接读取失败：HTTP ${response.status}。请改用 --article-file 提供正文。`);
    }
    return { article: normalizeWhitespace(stripHtml(await response.text())), source: options.url };
  }
  throw new Error("缺少文章输入。请提供 --url、--article 或 --article-file。");
};

const httpSourceUrl = (value?: string): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const buildBrief = (title: string, article: string, voiceover: string): RuntimeVideoBrief => {
  const proofPoints = [
    ...(article.match(/\d+(?:\.\d+)?\s*(?:%|倍|亿|万|美元|元|tokens?|Token|B|K)?/gi) ?? []),
    ...(article.match(/发布|上线|开源|价格|成本|订单|风险|突破|模型|芯片|算力|融资|收入/g) ?? []),
  ];
  const firstSentence = splitSentences(voiceover)[0] ?? title;

  return buildRuntimeVideoBrief({
    topic: title,
    audience: "想快速看懂科技、财经和产业事件的中文短视频观众",
    coreAngle: `围绕“${title}”提炼事件变化、关键证据和现实影响`,
    whyWatch: "用口播、数据镜头和关系图把长文压缩成一条可看懂、可发布的视频。",
    viewerDoubt: "这件事到底重要在哪里，和行业变化有什么关系？",
    plainAnswer: firstSentence,
    hook: {
      firstThreeSeconds: firstSentence,
      viewerReasonToContinue: "后面会拆出关键数字、关系链和最终判断。",
    },
    narrativeArc: {
      opening: firstSentence,
      turn: "从表面新闻转入背后的结构变化。",
      proof: "用文中的数字、时间节点和事实支撑判断。",
      reinforcement: "补充产业链、竞争格局或成本效率的影响。",
      closing: "收束成一个观众能记住的判断。",
    },
    proofPoints: [...new Set(proofPoints.map((item) => item.trim()).filter(Boolean))].slice(0, 10),
    assetNeeds: ["事件主体标识", "产品或官网截图", "关键数据图", "产业链关系图"],
    visualDirection: {
      density: "rich",
      mustAvoid: ["PPT化", "连续套同一版式", "主画面复读完整字幕", "无意义抖动", "默认噪点", "字幕和主视觉重叠"],
    },
  });
};

const selectLiteStyle = (article: string, title: string): VideoStyle => {
  const text = `${title}\n${article}`;
  if (/模型|AI|芯片|算力|参数|Token|系统|平台|架构|数据|代码|开源|云/i.test(text)) {
    return "dark-data-analysis";
  }
  if (/股|币|美元|美债|VIX|仓位|K线|BTC|ETH|价格|收入|利润|估值|融资|财报|交易|资金|利率/i.test(text)) {
    return "light-finance-mg";
  }
  if (/突发|宣布|回应|争议|调查|监管|法院|政府|政策|舆论|记者|新闻|事件/.test(text)) {
    return "news-commentary";
  }
  if (/教程|原理|为什么|如何|机制|论文|研究|概念|解释|知识|科普/.test(text)) {
    return "knowledge-explainer";
  }
  if (/爆火|离谱|反转|震惊|短视频|抖音|小红书|直播|流量|热点/.test(text)) {
    return "fast-short-video";
  }
  return "knowledge-explainer";
};

const writePublishingPack = async (filePath: string, input: {
  title: string;
  voiceover: string;
  source: string;
  finalPath?: string;
  assetManifestPath: string;
  warnings: string[];
}): Promise<void> => {
  const summary = splitSentences(input.voiceover).slice(0, 3).join("");
  const lines = [
    `# ${input.title}`,
    "",
    "## 发布标题",
    "",
    input.title,
    "",
    "## 摘要",
    "",
    summary,
    "",
    "## 交付文件",
    "",
    `- 视频：${input.finalPath ?? "未渲染或跳过渲染"}`,
    `- 来源：${input.source}`,
    `- 素材清单：${input.assetManifestPath}`,
    "",
    "## 风险提示",
    "",
    ...(input.warnings.length ? input.warnings.map((warning) => `- ${warning}`) : ["- 暂无额外风险提示。"]),
  ];
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
};

export const runShinVideoLite = async (options: ShinVideoLiteOptions): Promise<ShinVideoLiteResult> => {
  const warnings: string[] = [];
  const { article, source } = await readArticleSource(options);
  const title = sanitizeOutputFileName(options.title ?? extractTitleFromText(article));
  const paths = createRunPaths(options.outputRoot ?? getRuntimeConfig().defaultOutputRoot, title);

  await mkdir(paths.runDir, { recursive: true });
  await mkdir(paths.finalDir, { recursive: true });
  await writeFile(path.join(paths.finalDir, "article.md"), `${article}\n`, "utf8");

  const voiceover = options.voiceoverPath
    ? normalizeWhitespace(await readFile(options.voiceoverPath, "utf8"))
    : buildVoiceover(article);
  const voiceoverPath = path.join(paths.finalDir, "口播文案.md");
  await writeFile(voiceoverPath, `${voiceover}\n`, "utf8");

  const videoBrief = buildBrief(title, article, voiceover);
  await writeRuntimeVideoBrief(paths.videoBriefPath, videoBrief);

  let audioPath = options.audioPath;
  let audioDurationSeconds: number | undefined;
  let timelineSegments: TimelineSegment[];
  let subtitleTimeline:
    | ProviderNativeSubtitleTimeline
    | {
      subtitleTimelineVersion: 1;
      source: "synthetic-dry-run";
      scriptFingerprint: string;
      segments: Array<{
        id: string;
        text: string;
        start: number;
        end: number;
        timingConfidence: number;
      }>;
    };

  if (options.dryRun) {
    warnings.push("dry-run 模式没有调用 TTS 服务商和 Remotion；合成时间边界仅用于验证工作流结构，不能用于正式渲染。");
    timelineSegments = buildSyntheticTimeline(voiceover);
    const syntheticEnd = timelineSegments.at(-1)?.end ?? 1;
    subtitleTimeline = {
      subtitleTimelineVersion: 1,
      source: "synthetic-dry-run",
      scriptFingerprint: createScriptFingerprint(voiceover),
      segments: [
        {
          id: "caption-0001",
          text: voiceover,
          start: 0,
          end: syntheticEnd,
          timingConfidence: 0,
        },
      ],
    };
  } else {
    if (audioPath) {
      if (!options.subtitleTimelinePath) {
        throw new Error("外部音频缺少同次 TTS 返回的 subtitle-timeline.json 时间轴");
      }
      const copiedAudioPath = path.join(paths.finalDir, "口播音频.mp3");
      await copyFile(audioPath, copiedAudioPath);
      audioPath = copiedAudioPath;
      subtitleTimeline = JSON.parse(
        await readFile(options.subtitleTimelinePath, "utf8"),
      ) as ProviderNativeSubtitleTimeline;
      await validateSubtitleTimelineFiles({
        timeline: subtitleTimeline,
        audioPath,
        voiceoverPath,
      });
    } else {
      const audio = await generateTtsAudio({
        provider: options.ttsProvider,
        text: voiceover,
        outputDir: paths.finalDir,
        voiceId: options.voiceId,
      });
      audioPath = audio.audioPath;
      subtitleTimeline = await buildSubtitleTimeline({
        provider: audio.provider,
        audioPath: audio.audioPath,
        voiceoverPath,
        timings: audio.timings,
      });
      audioDurationSeconds = audio.durationMs / 1000;
    }

    await validateSubtitleTimelineFiles({
      timeline: subtitleTimeline,
      audioPath,
      voiceoverPath,
    });
    timelineSegments = subtitleTimeline.segments.map((segment) => ({
      id: segment.id,
      text: segment.text,
      start: segment.start,
      end: segment.end,
    }));
    audioDurationSeconds ??= await probeAudioDurationSeconds(audioPath);
  }

  const scenesResult = await generateScenes({
    voiceoverPath,
    timelineSegments,
    scenesPath: paths.scenesPath,
    audioSrc: audioPath ? path.basename(audioPath) : undefined,
    articleText: article,
  });
  warnings.push(...scenesResult.warnings);

  await writeFile(paths.subtitleTimelinePath, `${JSON.stringify(subtitleTimeline, null, 2)}\n`, "utf8");
  const draftVisualManifest = buildVisualManifestFromScenes(scenesResult.scenes);
  const assetManifest = await researchAssets({
    title,
    article,
    sourceUrl: httpSourceUrl(options.url),
    videoBrief,
    visualManifest: draftVisualManifest,
    scenes: scenesResult.scenes,
    assetManifestPath: paths.assetManifestPath,
    generatedImageManifestPath: options.generatedImageManifestPath,
    dryRun: options.dryRun,
  });
  warnings.push(...assetManifest.warnings);
  const assetBoundScenes = bindAssetsToScenes(scenesResult.scenes, assetManifest);
  const evidenceContext = buildSceneSemanticContext({
    scenes: assetBoundScenes,
    articleText: article,
    assetManifest,
  });
  const evidenceSelection = selectDirectorPlan(assetBoundScenes, evidenceContext);
  if (!evidenceSelection.ok) {
    throw new Error(
      `素材绑定后的语义导演选择失败：${evidenceSelection.errors.join("\n")}`,
    );
  }
  const renderDimensions = resolveRenderDimensions({
    assetManifest,
    fallbackAspectRatio: options.aspectRatio ?? "16:9",
  });
  const scenesWithAssets = finalizeGeneratedScenesForRender({
    ...scenesResult,
    scenes: evidenceSelection.scenes,
    directorQualityTargets: evidenceSelection.targets,
  }, {
    durationSeconds: audioDurationSeconds ?? scenesResult.duration,
    width: renderDimensions.width,
    height: renderDimensions.height,
  });
  await writeFile(paths.scenesPath, `${JSON.stringify(scenesWithAssets, null, 2)}\n`, "utf8");

  const visualManifest = buildVisualManifestFromScenes(scenesWithAssets.scenes);
  await writeRuntimeVisualManifest(paths.visualManifestPath, visualManifest);

  const enrichedResult = { ...scenesWithAssets, videoBrief, visualManifest, assetManifest };
  const directorPlan = await writeRuntimeDirectorPlan(paths.directorPlanPath, enrichedResult);
  await writeDirectorReviewArtifacts(paths.directorPlanPath, enrichedResult);
  const selectedStyle = options.style ?? selectLiteStyle(article, title);
  if (!options.style) {
    warnings.push(`轻量入口已根据文章内容自动选择视觉风格：${selectedStyle}。如需精修，请显式指定 --style 或进入专家审核模式。`);
  }
  await writeRuntimeStyleProfile(paths.styleProfilePath, selectedStyle, renderDimensions.aspectRatio);

  const styleProfile = await readJsonIfExists<RuntimeStyleProfile>(paths.styleProfilePath);
  const gateReport = options.dryRun
    ? validateProductionGate({
        scenes: scenesWithAssets.scenes,
        captions: subtitleTimeline.segments,
        videoBrief,
        visualManifest,
        assetManifest,
        directorPlan,
        styleProfile,
      })
    : await validateProductionGateFiles({
        scenes: scenesWithAssets.scenes,
        videoBrief,
        visualManifest,
        assetManifest,
        directorPlan,
        styleProfile,
        audioPath,
        voiceoverPath,
        subtitleTimeline: subtitleTimeline as ProviderNativeSubtitleTimeline,
      });
  if (options.dryRun && !audioPath) {
    gateReport.warnings.push("dry-run 没有最终音频；正式渲染前必须通过 TTS 服务商重新生成音频和原生时间轴。");
  }
  await writeFile(paths.productionGateReportPath, `${JSON.stringify(gateReport, null, 2)}\n`, "utf8");

  let finalPath: string | undefined;
  if (!options.dryRun && !options.skipRender) {
    if (!audioPath) throw new Error("缺少最终音频，不能渲染。");
    const renderResult = await renderVideo({
      scenesPath: paths.scenesPath,
      audioPath,
      voiceoverPath,
      subtitleTimelinePath: paths.subtitleTimelinePath,
      videoBriefPath: paths.videoBriefPath,
      visualManifestPath: paths.visualManifestPath,
      assetManifestPath: paths.assetManifestPath,
      directorPlanPath: paths.directorPlanPath,
      styleProfilePath: paths.styleProfilePath,
      productionGateReportPath: paths.productionGateReportPath,
      qualityReportPath: paths.qualityReportPath,
      qualityFramesDir: paths.qualityFramesDir,
      outputPath: paths.finalPath,
      publicRuntimeDir: paths.publicRuntimeDir,
      publicRuntimeBase: paths.publicRuntimeBase,
    });
    if (!renderResult.qualityReport.passed) {
      await rm(renderResult.videoPath, { force: true });
      assertDeliverableQualityReport(renderResult.qualityReport);
    }
    finalPath = renderResult.videoPath;
  } else if (!options.dryRun && options.skipRender) {
    warnings.push("已按 --skip-render 跳过 Remotion 渲染。");
  }

  await writePublishingPack(paths.publishingPackPath, {
    title,
    voiceover,
    source,
    finalPath,
    assetManifestPath: paths.assetManifestPath,
    warnings,
  });

  return {
    title,
    selectedStyle,
    finalPath,
    runDir: paths.runDir,
    finalDir: paths.finalDir,
    voiceoverPath,
    audioPath,
    videoBriefPath: paths.videoBriefPath,
    scenesPath: paths.scenesPath,
    subtitleTimelinePath: paths.subtitleTimelinePath,
    visualManifestPath: paths.visualManifestPath,
    assetManifestPath: paths.assetManifestPath,
    directorPlanPath: paths.directorPlanPath,
    styleProfilePath: paths.styleProfilePath,
    productionGateReportPath: paths.productionGateReportPath,
    publishingPackPath: paths.publishingPackPath,
    warnings,
  };
};
