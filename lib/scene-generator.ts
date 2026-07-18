import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { selectDirectorPlan } from "./director-selector";
import { extractImageReferences, readFirstExistingMaterialPackFile } from "./material-pack";
import {
  buildNaturalResegmentCandidates,
  mergeRhetoricalContinuations,
  splitLongScenesAtTimelineBoundaries,
} from "./scene-resegment";
import { buildSceneSemanticContext } from "./scene-semantics";
import type {
  CreativeBrief,
  CreativeTone,
  DirectorNarrativeLayer,
  DirectorNarrativeRole,
  DirectorQualityTargets,
  DirectorSceneType,
  DirectorScriptScene,
  BackgroundMotion,
  BackgroundRole,
  BackgroundType,
  CameraMotion,
  CaptionLine,
  DataAnimation,
  EmphasisAnimation,
  EntranceAnimation,
  LayoutRecipe,
  MotionVariant,
  RenderInput,
  Scene,
  SceneAnimationSystem,
  SceneBackgroundSystem,
  ScenePace,
  SceneRoleV2,
  SceneTransition,
  SceneType,
  ShotStyle,
  TransitionAnimation,
  TimelineSegment,
  RuntimeDirectorScript,
  VideoArchetype,
  VisualIntent,
  VisualModule,
  VisualPriority,
} from "./types";

export type GenerateScenesInput = {
  materialPackPath?: string;
  voiceoverPath?: string;
  timelineSegments: TimelineSegment[];
  scenesPath?: string;
  audioSrc?: string;
  articleText?: string;
};

export type GeneratedScenes = RenderInput & {
  materialPackPath?: string;
  warnings: string[];
};

type VoiceoverBlock = {
  text: string;
  images: string[];
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const stripHeading = (line: string): string => line.replace(/^#+\s*/, "").trim();

export const parseVoiceoverBlocks = (voiceover: string): VoiceoverBlock[] => {
  const blocks: VoiceoverBlock[] = [];
  let currentLines: string[] = [];
  let currentImages: string[] = [];

  const flush = () => {
    const text = currentLines.map(stripHeading).filter(Boolean).join("\n").trim();
    if (text || currentImages.length > 0) {
      blocks.push({ text, images: currentImages });
    }
    currentLines = [];
    currentImages = [];
  };

  for (const rawLine of voiceover.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }

    if (line.includes("【画面")) {
      currentImages = [...new Set([...currentImages, ...extractImageReferences(line)])];
      continue;
    }

    if (line.startsWith("#")) {
      continue;
    }

    currentLines.push(line);
  }

  flush();
  return blocks.filter((block) => block.text || block.images.length > 0);
};

const cleanArticleLine = (line: string): string => {
  return line
    .replace(/^#+\s*/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .trim();
};

export const parseArticleImageBlocks = (articleWithImages: string): VoiceoverBlock[] => {
  const blocks: VoiceoverBlock[] = [];
  let pendingImages: string[] = [];
  let currentImages: string[] = [];
  let currentLines: string[] = [];

  const pushCurrent = () => {
    const text = currentLines.map(cleanArticleLine).filter(Boolean).join("\n").trim();
    if (text || currentImages.length > 0) {
      blocks.push({ text, images: [...new Set(currentImages)].slice(0, 2) });
    }
    currentLines = [];
    currentImages = [];
  };

  for (const rawLine of articleWithImages.split(/\r?\n/)) {
    const line = rawLine.trim();
    const markerImages = extractImageReferences(line);
    const isImageMarker = line.startsWith("<!-- image_") || /^!\[.*]\(.+\)$/.test(line);

    if (isImageMarker && markerImages.length > 0) {
      if (currentLines.length > 0) pushCurrent();
      pendingImages = [...new Set([...pendingImages, ...markerImages])];
      continue;
    }

    const cleaned = cleanArticleLine(line);
    if (!cleaned) {
      continue;
    }

    if (pendingImages.length > 0 && currentLines.length === 0) {
      currentImages = pendingImages;
      pendingImages = [];
    }

    currentLines.push(cleaned);

    if (currentLines.join("").length >= 58) {
      pushCurrent();
    }
  }

  pushCurrent();

  if (pendingImages.length > 0) {
    blocks.push({ text: " ", images: pendingImages });
  }

  return blocks.filter((block) => block.text || block.images.length > 0);
};

const sceneLayout = (images: string[], index: number, total: number): Scene["layout"] => {
  if (index === total - 1 && images.length === 0) return "ending";
  if (images.length >= 2) return "split-image";
  if (images.length === 1) return "single-image";
  return "quote";
};

const textGrams = (text: string): Set<string> => {
  const normalized = normalizeMatchText(text);
  const grams = new Set<string>();

  for (const size of [2, 3, 4]) {
    for (let index = 0; index <= normalized.length - size; index += 1) {
      grams.add(normalized.slice(index, index + size));
    }
  }

  return grams;
};

const overlapScore = (source: Set<string>, candidate: string): number => {
  const normalizedCandidate = normalizeMatchText(candidate);
  if (!normalizedCandidate) return 0;

  let score = 0;
  for (const gram of source) {
    if (normalizedCandidate.includes(gram)) {
      score += gram.length;
    }
  }

  return score;
};

const findBestVoiceoverBlock = (markerText: string, sceneBlocks: VoiceoverBlock[], minimumIndex: number): number | null => {
  const topicTokens = ["WLFI", "meme", "IP", "USDC", "ETH", "BTC", "LINK", "AAVE", "ENA", "MOVE", "ONDO"];
  const markerNormalized = normalizeMatchText(markerText);
  const markerTopic = topicTokens.find((token) => markerNormalized.includes(normalizeMatchText(token)));
  if (markerTopic) {
    const normalizedTopic = normalizeMatchText(markerTopic);
    for (let index = minimumIndex; index < sceneBlocks.length; index += 1) {
      if (normalizeMatchText(sceneBlocks[index]?.text ?? "").includes(normalizedTopic)) {
        return index;
      }
    }
  }

  const markerLead = normalizeMatchText(markerText).slice(0, 32) || markerText;
  const source = textGrams(markerLead);
  if (source.size === 0) return null;

  let best = { index: -1, score: 0 };

  for (let index = minimumIndex; index < sceneBlocks.length; index += 1) {
    const score = overlapScore(source, sceneBlocks[index]?.text ?? "");
    if (score > best.score) {
      best = { index, score };
    }
  }

  return best.score >= 8 ? best.index : null;
};

const fallbackAnchorIndex = (anchorOrder: number, anchorCount: number, sceneCount: number): number => {
  if (sceneCount <= 1) return 0;
  const ratio = (anchorOrder + 1) / (anchorCount + 1);
  return Math.min(sceneCount - 1, Math.max(0, Math.round(ratio * (sceneCount - 1))));
};

const assignMarkerImagesToScenes = (imageBlocks: VoiceoverBlock[], sceneBlocks: VoiceoverBlock[]): string[][] => {
  const imagesByScene = sceneBlocks.map(() => [] as string[]);
  const markers = imageBlocks.filter((block) => block.images.length > 0);
  const anchors: Array<{ index: number; images: string[] }> = [];
  let minimumIndex = 0;

  markers.forEach((marker, markerIndex) => {
    const matchedIndex = findBestVoiceoverBlock(marker.text, sceneBlocks, minimumIndex);
    const index = matchedIndex ?? fallbackAnchorIndex(markerIndex, markers.length, sceneBlocks.length);
    const clampedIndex = Math.min(sceneBlocks.length - 1, Math.max(minimumIndex, index));
    anchors.push({ index: clampedIndex, images: marker.images });
    minimumIndex = Math.min(sceneBlocks.length - 1, clampedIndex + 1);
  });

  anchors.forEach((anchor, anchorIndex) => {
    const nextAnchor = anchors[anchorIndex + 1];
    const endIndex = nextAnchor ? nextAnchor.index : sceneBlocks.length;

    for (let sceneIndex = anchor.index; sceneIndex < endIndex; sceneIndex += 1) {
      imagesByScene[sceneIndex] = [...new Set([...imagesByScene[sceneIndex], ...anchor.images])];
    }
  });

  return imagesByScene;
};

const extractEmphasis = (text: string): string[] => {
  const matches =
    text.match(
      /(?:\d+(?:\.\d+)?\s*(?:%|倍|K|B|元\/百万tokens|元|亿|万|美金|美元|tokens))|WLFI|meme|IP|USDC|ETH|BTC|LINK|AAVE|ENA|MOVE|ONDO|Hy3|MoE|WorkBuddy|CodeBuddy|优必选|UBTECH|U1Lite|U1Pro|U1|仿生机器人|情感陪伴|智能大模型|预售订单|定金|付款率|量产难度/gi,
    ) ?? [];
  return [...new Set(matches.map((match) => match.replace(/\s+/g, "")))].slice(0, 4);
};

const recipeBySceneType: Record<SceneType, { visualIntent: VisualIntent; layoutRecipe: LayoutRecipe }> = {
  "impact-hook": { visualIntent: "hook-attention", layoutRecipe: "metric-hero" },
  "news-context": { visualIntent: "establish-context", layoutRecipe: "news-column" },
  "data-breakdown": { visualIntent: "explain-number", layoutRecipe: "stacked-data-cards" },
  "relationship-map": { visualIntent: "map-relationship", layoutRecipe: "node-map" },
  "risk-contrast": { visualIntent: "compare-risk", layoutRecipe: "split-risk-cards" },
  timeline: { visualIntent: "show-sequence", layoutRecipe: "horizontal-timeline" },
  "evidence-zoom": { visualIntent: "zoom-evidence", layoutRecipe: "screenshot-focus" },
  "concept-steps": { visualIntent: "teach-steps", layoutRecipe: "step-ladder" },
  "quote-impact": { visualIntent: "hit-quote", layoutRecipe: "quote-slam" },
  "summary-card": { visualIntent: "wrap-up", layoutRecipe: "closing-summary" },
};

const motionBySceneType: Record<SceneType, MotionVariant[]> = {
  "impact-hook": ["scale-pop", "white-flash", "type-build"],
  "news-context": ["column-wipe", "slow-push", "type-build"],
  "data-breakdown": ["scan-rise", "card-stack", "scale-pop"],
  "relationship-map": ["line-draw", "guided-pan", "card-stack"],
  "risk-contrast": ["warning-pulse", "column-wipe", "white-flash"],
  timeline: ["line-draw", "scan-rise", "guided-pan"],
  "evidence-zoom": ["slow-push", "scan-rise", "line-draw"],
  "concept-steps": ["card-stack", "type-build", "guided-pan"],
  "quote-impact": ["white-flash", "scale-pop", "warning-pulse"],
  "summary-card": ["card-stack", "slow-push", "type-build"],
};

const transitionBySceneType: Record<SceneType, SceneTransition> = {
  "impact-hook": "white-flash",
  "news-context": "column-cut",
  "data-breakdown": "scan-wipe",
  "relationship-map": "card-slide",
  "risk-contrast": "flash-wipe",
  timeline: "soft-wipe",
  "evidence-zoom": "scan-wipe",
  "concept-steps": "card-slide",
  "quote-impact": "white-flash",
  "summary-card": "soft-wipe",
};

const fallbackSceneTypeSequence: SceneType[] = [
  "impact-hook",
  "news-context",
  "data-breakdown",
  "relationship-map",
  "risk-contrast",
  "concept-steps",
  "quote-impact",
  "summary-card",
];

const inferSceneType = (scene: Pick<Scene, "subtitle" | "images" | "emphasis" | "layout">, index: number, total: number): SceneType => {
  const text = normalizeMatchText(scene.subtitle);

  if (index === total - 1) return "summary-card";
  if (index === 0) return "impact-hook";
  if (scene.images.length > 0) return "evidence-zoom";
  if (/风险|争议|问题|危险|代价|但是|不过|反常|下跌|撤离|警惕/.test(scene.subtitle)) return "risk-contrast";
  if (/首先|其次|然后|最后|第一|第二|第三|时间|阶段|接着/.test(scene.subtitle)) return "timeline";
  if (/关系|路径|关联|背后|来源|授权|项目|主体|链路|wlfi|meme|ip/.test(text)) return "relationship-map";
  if (scene.emphasis?.some((value) => /\d/.test(value)) || /\d|亿|万|美元|美金|%/.test(scene.subtitle)) return "data-breakdown";
  if (/为什么|怎么|如何|本质|逻辑|拆成|理解|解释|意思/.test(scene.subtitle)) return "concept-steps";
  if (scene.subtitle.length <= 34) return "quote-impact";
  return fallbackSceneTypeSequence[index % fallbackSceneTypeSequence.length];
};

const nextDifferentSceneType = (current: SceneType, index: number): SceneType => {
  const offset = fallbackSceneTypeSequence.indexOf(current);
  return fallbackSceneTypeSequence[(Math.max(0, offset) + index + 1) % fallbackSceneTypeSequence.length];
};

const visualModulesForScene = (scene: Scene, sceneType: SceneType): VisualModule[] => {
  const modules: VisualModule[] = ["transforms", "layers", "fonts", "measuring", "animation-math", "transitions", "effects", "svg-path", "color-interpolation"];

  if (scene.images.length > 0) modules.push("assets");
  if (sceneType === "impact-hook" || sceneType === "quote-impact") modules.push("starburst");
  if (sceneType === "news-context" || sceneType === "relationship-map") modules.push("randomness");
  if (sceneType === "data-breakdown") modules.push("html-in-canvas");
  if (sceneType === "impact-hook") modules.push("posterization");

  return [...new Set(modules)];
};

const paceForScene = (sceneType: SceneType, index: number, total: number): ScenePace => {
  if (sceneType === "impact-hook" || sceneType === "quote-impact" || sceneType === "risk-contrast") return "strong";
  if (sceneType === "summary-card" || index > total * 0.7) return "medium";
  if (sceneType === "concept-steps" || sceneType === "news-context") return "soft";
  return "medium";
};

const applySceneRecipe = (scene: Scene, sceneType: SceneType, motionVariant: MotionVariant, index: number, total: number): Scene => ({
  ...scene,
  sceneType,
  visualIntent: recipeBySceneType[sceneType].visualIntent,
  layoutRecipe: recipeBySceneType[sceneType].layoutRecipe,
  motionVariant,
  transition: transitionBySceneType[sceneType],
  visualModules: visualModulesForScene(scene, sceneType),
  pace: paceForScene(sceneType, index, total),
});

const ensureMinimumRecipeVariety = (scenes: Scene[]): Scene[] => {
  if (scenes.length < 3) return scenes;

  const uniqueTypes = new Set(scenes.map((scene) => scene.sceneType));
  if (uniqueTypes.size >= 3) return scenes;

  const candidates = ["news-context", "data-breakdown", "relationship-map", "risk-contrast", "concept-steps", "quote-impact"] satisfies SceneType[];
  let candidateIndex = 0;

  return scenes.map((scene, index) => {
    if (index === 0 || index === scenes.length - 1 || uniqueTypes.size >= 3) return scene;

    let nextType = candidates[candidateIndex % candidates.length];
    candidateIndex += 1;
    while (uniqueTypes.has(nextType) && candidateIndex < candidates.length * 2) {
      nextType = candidates[candidateIndex % candidates.length];
      candidateIndex += 1;
    }

    uniqueTypes.add(nextType);
    const motionVariant = motionBySceneType[nextType][index % motionBySceneType[nextType].length];
    return applySceneRecipe(scene, nextType, motionVariant, index, scenes.length);
  });
};

const enrichScenesWithVisualRecipes = (scenes: Scene[]): Scene[] => {
  let previousSceneType: SceneType | undefined;
  let previousMotion: MotionVariant | undefined;

  const enriched = scenes.map((scene, index) => {
    let sceneType = inferSceneType(scene, index, scenes.length);

    if (previousSceneType === sceneType && scenes.length >= 3) {
      sceneType = nextDifferentSceneType(sceneType, index);
    }

    const motionOptions = motionBySceneType[sceneType];
    let motionVariant = motionOptions[index % motionOptions.length];
    if (previousMotion === motionVariant && motionOptions.length > 1) {
      motionVariant = motionOptions[(index + 1) % motionOptions.length];
    }

    previousSceneType = sceneType;
    previousMotion = motionVariant;

    return applySceneRecipe(scene, sceneType, motionVariant, index, scenes.length);
  });

  return ensureMinimumRecipeVariety(enriched);
};

const shortenVisualHeadline = (source: string, fallback: string): string => {
  const compact = source.replace(/\s+/g, "");
  if (!compact) return fallback;

  const keywordMatches =
    compact.match(
      /MiniMax|M3|Hailuo|海螺|Agent|API|MoE|Token|Apache|Huggingface|OpenRouter|腾讯混元|Hy3|WorkBuddy|CodeBuddy|元宝|Marvis|ima|混元|DeepSeek|Claude|OpenAI|Anthropic|优必选|UBTECH|U1Lite|U1Pro|U1|仿生机器人|情感陪伴|智能大模型|预售订单|定金|付款率|量产难度|单身经济|情绪陪伴|宇树|模型|业务|价格|订单|开源|上下文|幻觉率|错误率|参数|实用|升级|预训练|强化学习|成本|能力|办公|代码|金融|任务|增长|下降|提升|降低|融资|亏损|发布|至暗时刻|视频生成|语音|多模态|应用|\d+(?:\.\d+)?倍|\d+(?:\.\d+)?%?|\d+(?:\.\d+)?[KMB]?/gi,
    ) ?? [];
  const keywords = [...new Set(keywordMatches.map((value) => value.replace(/[，。！？；：、,.!?;:\s]/g, "")))].filter(
    (value) => value.length >= 2 && value.length <= 16,
  );

  const semanticKeywords = keywords.filter((value) => !/^\d+(?:\.\d+)?(?:%|倍|K|B|M)?$/i.test(value));

  if (semanticKeywords.length >= 2) return semanticKeywords.slice(0, 3).join(" / ");
  if (semanticKeywords.length === 1) {
    const numericKeyword = keywords.find((value) => value !== semanticKeywords[0] && /\d/.test(value));
    return numericKeyword ? `${semanticKeywords[0]} / ${numericKeyword}` : semanticKeywords[0];
  }
  if (keywords.length >= 2) return keywords.slice(0, 3).join(" / ");
  if (compact.length <= 14) return compact;

  const phrase = compact
    .replace(/今年|目前|这种|通过|相比|同时|除了|以及|已经|正式|发布|上线|用户|真实|场景/g, "")
    .replace(/[，。！？；：、,.!?;:]/g, "");
  const shortened = phrase.slice(0, 18);
  return /^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*$/.test(shortened) ? fallback : shortened || fallback;
};

const titleFromScene = (scene: Scene, fallback: string): string => {
  const firstSentence = scene.subtitle
    .split(/(?<=[。！？!?；;])|\n/g)
    .map((part) => part.trim())
    .find(Boolean);
  const source = scene.visualBrief?.headline ?? scene.title ?? firstSentence ?? fallback;
  const shortened = shortenVisualHeadline(source, fallback);
  if (normalizeMatchText(shortened) !== normalizeMatchText(scene.subtitle)) return shortened;

  const keywords = sceneKeywords(scene, []);
  const keywordTitle = keywords.slice(0, 3).join(" / ");
  return keywordTitle || fallback;
};

const fallbackPhrasesFromSubtitle = (subtitle: string): string[] => {
  const fragments = subtitle
    .replace(/[“”"'（）()]/g, "")
    .split(/[，。！？；：、,.!?;:\n]|(?:不是|而是|所以|但是|当然|更像|就变成了|开始进入)/g)
    .map((value) =>
      value
        .replace(/^(真正的|真正|重点是|重点|核心是|核心|这也是|这次|这事|它|一家)/, "")
        .replace(/\s+/g, "")
        .trim(),
    )
    .filter((value) => value.length >= 2)
    .map((value) => (value.length > 12 ? value.slice(0, 12) : value));

  return [...new Set(fragments)].slice(0, 4);
};

const sceneKeywords = (scene: Scene, fallback: string[] = []): string[] => {
  const matches =
    scene.subtitle.match(
      /MiniMax|M3|Hailuo|海螺|Agent|API|MoE|Token|Apache|Huggingface|OpenRouter|腾讯混元|混元|DeepSeek|Claude|OpenAI|Anthropic|AI|HBM|英伟达|国产替代芯片|国产芯片|自研芯片|训练芯片|推理芯片|芯片|算力控制权|算力命脉|推理算力|算力|出口管制|供应链|供应节奏|供应|产能|制程|高带宽内存|软件生态|万卡互联|流片|量产|调用量|推理调用|一次性投入|水电费|行业信号|信号|硬件|模型|业务|价格|订单|开源|上下文|幻觉率|错误率|参数|成本|能力|办公|代码生成|代码|金融|任务|增长|下降|提升|降低|融资|亏损|发布|至暗时刻|视频生成|语音|多模态|应用|\d+(?:\.\d+)?%?|\d+(?:\.\d+)?[KMB]?/gi,
    ) ?? [];
  const semanticFallback = matches.length > 0 ? [] : fallbackPhrasesFromSubtitle(scene.subtitle);
  const cleaned = [...(scene.emphasis ?? []), ...matches, ...semanticFallback, ...fallback]
    .map((value) => value.replace(/[，。！？；：、,.!?;:\s]/g, "").trim())
    .filter((value) => value.length >= 2 && value.length <= 16)
    .filter((value) => !/^\d+(?:\.\d+)?$/.test(value));
  return [...new Set(cleaned)].slice(0, 5);
};

const narrativeRoleForScene = (directorType: DirectorSceneType, index: number, total: number): DirectorNarrativeRole => {
  if (directorType === "Pause") return "breath";
  if (directorType === "Hero" || index === 0) return "opening";
  if (directorType === "Summary" || index === total - 1) return "closing";
  const progress = index / Math.max(1, total - 1);
  if (progress < 0.32) return "turn";
  if (progress < 0.62) return "proof";
  return "reinforcement";
};

const intensityForDirectorType = (directorType: DirectorSceneType, scene: Scene, index: number, total: number): 1 | 2 | 3 | 4 | 5 => {
  if (directorType === "Pause") return 1;
  if (directorType === "Hero" || directorType === "DataExplosion" || directorType === "Pricing") return 5;
  if (directorType === "Contrast" || directorType === "SpecSheet") return 4;
  if (directorType === "Summary") return 3;
  if ((scene.semantics?.metrics.length ?? 0) > 0 || index > total * 0.55) return 4;
  return 3;
};

const priorityForIntensity = (intensity: number): VisualPriority => {
  if (intensity >= 5) return "extreme";
  if (intensity === 4) return "high";
  if (intensity === 3) return "medium";
  return "low";
};

const motionStyleForScene = (directorType: DirectorSceneType, intensity: number): "soft" | "medium" | "sharp" => {
  if (directorType === "Pause") return "soft";
  if (intensity >= 5 || directorType === "Contrast" || directorType === "Pricing") return "sharp";
  if (intensity <= 2) return "soft";
  return "medium";
};

const shotStyleForDirectorType = (directorType: DirectorSceneType, index: number): ShotStyle => {
  const styles: Record<DirectorSceneType, ShotStyle[]> = {
    Hero: ["Burst"],
    Timeline: ["Flow", "Reveal"],
    SystemMap: ["Flow", "Zoom"],
    DataExplosion: ["Burst", "Zoom"],
    Contrast: ["Split"],
    SpecSheet: ["Zoom", "Reveal"],
    Pricing: ["Burst", "Split"],
    Pause: ["Collapse"],
    Summary: ["Collapse", "Reveal"],
    EvidenceHero: ["Reveal", "Zoom"],
    KeywordInvestigation: ["Split", "Reveal"],
    FinancialMeter: ["Burst", "Zoom"],
    SystemStack: ["Flow", "Reveal"],
    DependencyMap: ["Flow", "Split"],
    QuestionPause: ["Collapse"],
    BarrierWall: ["Reveal", "Split"],
    EvidenceReturn: ["Reveal", "Collapse"],
    IndustrySignal: ["Flow", "Zoom"],
    CompetitionLayerStack: ["Split", "Flow"],
    FinalJudgement: ["Collapse", "Reveal"],
  };
  const options = styles[directorType];
  return options[index % options.length];
};

const sceneRoleForDirectorType = (
  directorType: DirectorSceneType,
  importance: number,
  index: number,
): SceneRoleV2 => {
  if (directorType === "Pause" || directorType === "QuestionPause") return "transition";
  if (
    index === 0 ||
    directorType === "Hero" ||
    directorType === "EvidenceHero" ||
    directorType === "FinalJudgement"
  ) return "memory";
  if (
    directorType === "DataExplosion" ||
    directorType === "Pricing" ||
    directorType === "FinancialMeter" ||
    directorType === "Contrast" ||
    directorType === "BarrierWall" ||
    importance >= 8
  )
    return "spike";
  return "support";
};

const importanceForDirectorType = (directorType: DirectorSceneType, scene: Scene, index: number, total: number): number => {
  if (directorType === "Pause" || directorType === "QuestionPause") return 2;
  if (index === 0 || directorType === "Hero" || directorType === "EvidenceHero") return 10;
  if (directorType === "DataExplosion" || directorType === "Pricing" || directorType === "FinancialMeter") return 9;
  if (directorType === "Contrast" || directorType === "SpecSheet" || directorType === "BarrierWall" || directorType === "EvidenceReturn") return 8;
  if (directorType === "Summary" || directorType === "FinalJudgement" || directorType === "CompetitionLayerStack") return 7;
  if ((scene.semantics?.metrics.length ?? 0) > 0) return 8;
  if (index === Math.floor(total / 2)) return 8;
  return 5;
};

const entranceForShotStyle = (shotStyle: ShotStyle, directorType: DirectorSceneType): EntranceAnimation => {
  if (directorType === "Pause" || directorType === "QuestionPause") return "fadeBlurIn";
  const entrances: Record<ShotStyle, EntranceAnimation> = {
    Burst: "kineticPop",
    Flow: "slideParallaxIn",
    Reveal: "maskReveal",
    Zoom: "zoomIn",
    Split: "maskReveal",
    Collapse: "fadeBlurIn",
  };
  return entrances[shotStyle];
};

const emphasisForShotStyle = (shotStyle: ShotStyle, directorType: DirectorSceneType): EmphasisAnimation => {
  if (directorType === "Pause" || directorType === "QuestionPause") return "depthPush";
  const emphasis: Record<ShotStyle, EmphasisAnimation> = {
    Burst: "pulseGlow",
    Flow: "highlightSweep",
    Reveal: "elasticStretch",
    Zoom: "depthPush",
    Split: "highlightSweep",
    Collapse: "highlightSweep",
  };
  return emphasis[shotStyle];
};

const transitionForShotStyle = (shotStyle: ShotStyle): TransitionAnimation => {
  const transitions: Record<ShotStyle, TransitionAnimation> = {
    Burst: "flowMerge",
    Flow: "cameraPan",
    Reveal: "wipe",
    Zoom: "morph",
    Split: "split",
    Collapse: "flowMerge",
  };
  return transitions[shotStyle];
};

const dataAnimationForDirectorType = (directorType: DirectorSceneType, shotStyle: ShotStyle): DataAnimation | undefined => {
  if (directorType === "DataExplosion") return shotStyle === "Burst" ? "particleFormation" : "kineticCounter";
  if (directorType === "Pricing" || directorType === "FinancialMeter") return "kineticCounter";
  if (directorType === "SpecSheet" || directorType === "BarrierWall") return "liquidFill";
  return undefined;
};

const cameraMotionForShotStyle = (shotStyle: ShotStyle, directorType: DirectorSceneType): CameraMotion => {
  if (directorType === "Pause" || directorType === "QuestionPause") return "dollyOut";
  const camera: Record<ShotStyle, CameraMotion> = {
    Burst: "dollyIn",
    Flow: "dollyIn",
    Reveal: "dollyOut",
    Zoom: "dollyIn",
    Split: "dollyOut",
    Collapse: "dollyOut",
  };
  return camera[shotStyle];
};

const animationForScene = (directorType: DirectorSceneType, shotStyle: ShotStyle): SceneAnimationSystem => {
  const dataAnimation = dataAnimationForDirectorType(directorType, shotStyle);
  return {
    entranceAnimation: entranceForShotStyle(shotStyle, directorType),
    emphasisAnimation: emphasisForShotStyle(shotStyle, directorType),
    transitionAnimation: transitionForShotStyle(shotStyle),
    ...(dataAnimation ? { dataAnimation } : {}),
    cameraMotion: cameraMotionForShotStyle(shotStyle, directorType),
  };
};

const backgroundForDirectorType = (directorType: DirectorSceneType, shotStyle: ShotStyle): SceneBackgroundSystem => {
  const typeByDirector: Record<DirectorSceneType, BackgroundType> = {
    Hero: "Gradient",
    Timeline: "AbstractFlow",
    SystemMap: "Mesh",
    DataExplosion: "DataField",
    Contrast: "Grid",
    SpecSheet: "Grid",
    Pricing: "DataField",
    Pause: "Flat",
    Summary: "Gradient",
    EvidenceHero: "Gradient",
    KeywordInvestigation: "Grid",
    FinancialMeter: "DataField",
    SystemStack: "Mesh",
    DependencyMap: "Mesh",
    QuestionPause: "Flat",
    BarrierWall: "Grid",
    EvidenceReturn: "Grid",
    IndustrySignal: "AbstractFlow",
    CompetitionLayerStack: "Mesh",
    FinalJudgement: "Gradient",
  };
  const motionByType: Record<BackgroundType, BackgroundMotion> = {
    Flat: "static",
    Gradient: "slowDrift",
    Mesh: "parallax",
    Grid: shotStyle === "Zoom" ? "parallax" : "slowDrift",
    DataField: "reactive",
    AbstractFlow: "parallax",
  };
  const roleByType: Record<BackgroundType, BackgroundRole> = {
    Flat: "supportive",
    Gradient: directorType === "Hero" || directorType === "EvidenceHero" || directorType === "FinalJudgement" ? "emotional" : "supportive",
    Mesh: "narrative",
    Grid: "supportive",
    DataField: "narrative",
    AbstractFlow: "narrative",
  };
  const backgroundType = typeByDirector[directorType];
  return {
    backgroundType,
    backgroundMotion: motionByType[backgroundType],
    backgroundRole: roleByType[backgroundType],
  };
};

const buildNarrativeLayer = (scenes: Scene[]): DirectorNarrativeLayer => {
  const byRole = (role: DirectorNarrativeRole, fallbackIndex: number) =>
    scenes.find((scene) => scene.narrativeRole === role)?.content?.headline ?? titleFromScene(scenes[fallbackIndex] ?? scenes[0], "待生成");
  const byType = (type: DirectorSceneType, fallbackIndex: number) =>
    scenes.find((scene) => scene.directorType === type)?.content?.headline ?? titleFromScene(scenes[fallbackIndex] ?? scenes[0], "待生成");
  const total = Math.max(1, scenes.length);
  const peakMoments = scenes
    .filter((scene) => (scene.importance ?? 0) >= 8 && scene.directorType !== "Pause")
    .slice(0, 4)
    .map((scene) => ({
      sceneId: scene.id,
      reason: `${scene.directorType ?? "Scene"} 用于强化 ${scene.content?.headline ?? titleFromScene(scene, "核心信息")}`,
      intensity: scene.intensity ?? 4,
    }));

  return {
    structure: {
      opening: byRole("opening", 0),
      background: byType("Timeline", Math.floor(total * 0.15)),
      coreUpgrade: byType("SystemMap", Math.floor(total * 0.3)),
      dataProof: byType("DataExplosion", Math.floor(total * 0.45)),
      technicalAbility: byType("SpecSheet", Math.floor(total * 0.6)),
      pricingAdvantage: byType("Pricing", Math.floor(total * 0.75)),
      openSourceValue: byRole("closing", total - 1),
      turn: byRole("turn", Math.floor(total * 0.2)),
      proof: byRole("proof", Math.floor(total * 0.45)),
      reinforcement: byRole("reinforcement", Math.floor(total * 0.7)),
      closing: byRole("closing", total - 1),
    },
    attentionCurve: [
      { range: "0-10", label: "吸引", intensity: 82 },
      { range: "10-30", label: "背景建立", intensity: 58 },
      { range: "30-50", label: "信息展开", intensity: 68 },
      { range: "50-70", label: "数据爆发", intensity: 90 },
      { range: "70-85", label: "技术说明", intensity: 72 },
      { range: "85-100", label: "总结收束", intensity: 64 },
    ],
    peakMoments,
  };
};

const inferVideoArchetype = (scenes: Scene[]): VideoArchetype => {
  const text = normalizeMatchText(scenes.map((scene) => scene.subtitle).join(" "));

  if (/营收|成本|利润|定价|价格|现金|订单|收入|估值|市场/.test(text)) return "finance-explainer";
  if (/发布|上线|宣布|更新|接入|事件|争议|会议|采访/.test(text)) return "event-breakdown";
  if (/模型|参数|架构|api|上下文|代码|产品|功能|系统/.test(text)) return "tech-demo";
  if (/为什么|如何|本质|逻辑|解释|意味着|背后/.test(text)) return "narrative-explainer";
  return "news-commentary";
};

const toneForArchetype = (archetype: VideoArchetype): CreativeTone => {
  switch (archetype) {
    case "finance-explainer":
      return "analytical";
    case "event-breakdown":
      return "urgent";
    case "tech-demo":
      return "optimistic";
    case "narrative-explainer":
      return "reflective";
    case "news-commentary":
    default:
      return "measured";
  }
};

const buildCreativeBrief = (
  scenes: Scene[],
  narrativeLayer: DirectorNarrativeLayer,
  videoArchetype: VideoArchetype,
): CreativeBrief => {
  const sceneCount = scenes.length;
  const durationSeconds = Number((scenes.at(-1)?.end ?? 0).toFixed(3));
  const opening = narrativeLayer.structure.opening;
  const proof = narrativeLayer.structure.proof;
  const closing = narrativeLayer.structure.closing;

  const purposeByArchetype: Record<VideoArchetype, string> = {
    "news-commentary": "把复杂事件讲清楚，并给出一个清晰判断框架。",
    "finance-explainer": "把数字背后的结构和真实影响讲透，而不是只报结果。",
    "event-breakdown": "快速还原事件进展、关键节点和后续影响。",
    "tech-demo": "把产品或模型升级点讲得具体、可感知、可验证。",
    "narrative-explainer": "把抽象概念拆成可理解、可记忆的视觉叙事。",
  };

  const visualStrategyByArchetype: Record<VideoArchetype, string> = {
    "news-commentary": "用标题帧、关系图、关键证据和总结帧建立评论感，不做整屏字幕搬运。",
    "finance-explainer": "优先数字卡、对比、资金流和结构图，用少量关键词承接字幕信息。",
    "event-breakdown": "先抓事件钩子，再拉时间线和因果链路，重点节点要有峰值镜头。",
    "tech-demo": "把升级点拆成能力、接入、参数、成本四种镜头表达，不把技术词堆成一页。",
    "narrative-explainer": "把抽象概念拆成隐喻、步骤、关系图和结论帧，保证每一段只有一个中心意思。",
  };

  const pacingByArchetype: Record<VideoArchetype, "steady" | "dynamic" | "layered"> = {
    "news-commentary": "layered",
    "finance-explainer": "layered",
    "event-breakdown": "dynamic",
    "tech-demo": "steady",
    "narrative-explainer": "layered",
  };

  return {
    archetype: videoArchetype,
    purpose: purposeByArchetype[videoArchetype],
    audience: "需要快速看懂事件、产品或观点重点的中文短视频观众。",
    coreMessage: [opening, proof, closing].filter(Boolean).join(" -> "),
    desiredAction: "看完后能复述核心变化、关键证据和最终判断。",
    durationSeconds,
    estimatedSceneCount: sceneCount,
    emotionalArc: narrativeLayer.attentionCurve.map((point) => point.label).join(" -> "),
    creativeDirection: {
      tone: toneForArchetype(videoArchetype),
      pacing: pacingByArchetype[videoArchetype],
      visualStrategy: visualStrategyByArchetype[videoArchetype],
      subtitlePolicy: "字幕只跟随音频节奏；主画面不重复完整字幕，只保留关键词、关系、数字和证据。",
      evidencePolicy: "有数字用数字卡，有关系用关系图，有时间进展用时间线，不用泛化装饰词填充画面。",
    },
  };
};

const purposeForDirectorScene = (scene: Scene): string => {
  switch (scene.narrativeRole) {
    case "opening":
      return "抓住注意力并快速建立主题";
    case "turn":
      return "把背景和问题转入主要信息";
    case "proof":
      return "用事实、数据或证据支撑判断";
    case "reinforcement":
      return "强化升级点、能力点或影响";
    case "closing":
      return "收束观点并给出结论";
    case "breath":
      return "给观众留节奏停顿";
    default:
      return "推进叙事";
  }
};

const informationFunctionForScene = (scene: Scene): DirectorScriptScene["informationFunction"] => {
  if (scene.narrativeRole === "opening") return "hook";
  if (scene.narrativeRole === "turn") return "context";
  if (scene.narrativeRole === "proof") return scene.directorType === "Contrast" ? "contrast" : "proof";
  if (scene.narrativeRole === "closing") return "closing";
  if (scene.directorType === "Pricing" || scene.directorType === "Summary") return "payoff";
  return "explain";
};

const visualRoleForDirectorType = (directorType: DirectorSceneType): string => {
  switch (directorType) {
    case "Hero":
      return "用强标题和留白建立记忆帧";
    case "Timeline":
      return "用时间结构解释事件推进";
    case "SystemMap":
      return "用节点关系解释主体、产品或逻辑链";
    case "DataExplosion":
      return "用大数字和指标对比强化证据";
    case "Contrast":
      return "用左右对照制造冲突感";
    case "SpecSheet":
      return "用参数和能力表解释技术信息";
    case "Pricing":
      return "用价格冲击和计数动画强化性价比";
    case "Pause":
      return "用低信息密度做节奏缓冲";
    case "Summary":
      return "用收束卡片完成总结";
    default:
      return "用画面强化这段信息";
  }
};

const buildDirectorScript = (
  scenes: Scene[],
  creativeBrief: CreativeBrief,
  videoArchetype: VideoArchetype,
): RuntimeDirectorScript => {
  const reviewChecklist = [
    "每一段主画面只表达一个核心意思",
    "主画面不要重复完整字幕原句",
    "至少存在标题、关系、数据、总结四类镜头表达",
    "镜头节奏要有高点和缓冲，不要全片平均推进",
  ];

  return {
    directorScriptVersion: 1,
    videoArchetype,
    creativeBrief,
    reviewChecklist,
    scenes: scenes.map((scene) => ({
      id: scene.id,
      start: scene.start,
      end: scene.end,
      duration: Number((scene.end - scene.start).toFixed(3)),
      timeRange: `${scene.start.toFixed(2)}s - ${scene.end.toFixed(2)}s`,
      purpose: purposeForDirectorScene(scene),
      coreIdea: scene.content?.headline ?? titleFromScene(scene, "核心信息"),
      informationFunction: informationFunctionForScene(scene),
      directorType: scene.directorType ?? "DataExplosion",
      shotStyle: scene.shotStyle ?? "Reveal",
      mainVisualRole: visualRoleForDirectorType(scene.directorType ?? "DataExplosion"),
      onScreenKeywords: (scene.content?.keywords ?? sceneKeywords(scene)).slice(0, 4),
      motionSuggestion: [
        scene.animation?.entranceAnimation,
        scene.animation?.emphasisAnimation,
        scene.animation?.cameraMotion,
      ]
        .filter(Boolean)
        .join(" + "),
      avoid: "不要把整句字幕再贴回主画面；优先关键词、结构、数字、关系。",
    })),
  };
};

const applyDirectorDsl = (
  scenes: Scene[],
  timelineSegments: TimelineSegment[],
  articleText?: string,
): {
  scenes: Scene[];
  narrativeLayer: DirectorNarrativeLayer;
  videoArchetype: VideoArchetype;
  creativeBrief: CreativeBrief;
  directorScript: RuntimeDirectorScript;
  directorQualityTargets: DirectorQualityTargets;
} => {
  const totalDuration = Math.max(...scenes.map((scene) => scene.end));
  const minimumSceneCount = Math.floor(totalDuration / 10) + 1;
  let selectedInputScenes = mergeRhetoricalContinuations(
    scenes,
    minimumSceneCount,
  );
  const context = buildSceneSemanticContext({
    scenes: selectedInputScenes,
    articleText,
  });
  let selection = selectDirectorPlan(selectedInputScenes, context);

  if (!selection.ok) {
    for (const candidateScenes of buildNaturalResegmentCandidates(
      selectedInputScenes,
      timelineSegments,
    )) {
      const candidateContext = buildSceneSemanticContext({
        scenes: candidateScenes,
        articleText,
      });
      const candidateSelection = selectDirectorPlan(candidateScenes, candidateContext);
      if (candidateSelection.ok) {
        selectedInputScenes = candidateScenes;
        selection = candidateSelection;
        break;
      }
    }
  }

  if (!selection.ok) {
    throw new Error(selection.errors.join("\n"));
  }

  const selectedScenes = selection.scenes;
  const directorQualityTargets = selection.targets;
  const directedScenes = selectedScenes.map((scene, index) => {
    const directorType = scene.directorType!;
    const narrativeRole = narrativeRoleForScene(directorType, index, selectedScenes.length);
    const intensity = intensityForDirectorType(directorType, scene, index, selectedScenes.length);
    const importance = importanceForDirectorType(directorType, scene, index, selectedScenes.length);
    const shotStyle = shotStyleForDirectorType(directorType, index);
    const animation = animationForScene(directorType, shotStyle);
    const background = backgroundForDirectorType(directorType, shotStyle);
    const content = scene.content!;
    const visualBriefNodes = (scene.visualBrief?.nodes ?? content.nodes)?.map((node) =>
      typeof node === "string" ? { label: node } : node,
    );

    return {
      ...scene,
      directorType,
      narrativeRole,
      intensity,
      importance,
      role: sceneRoleForDirectorType(directorType, importance, index),
      shotStyle,
      visualPriority: priorityForIntensity(intensity),
      motionStyle: motionStyleForScene(directorType, intensity),
      animation,
      background,
      directorContractIssues: scene.directorContractIssues ?? [],
      content,
      visualBrief: {
        ...scene.visualBrief,
        headline: scene.visualBrief?.headline ?? content.headline,
        primaryMetric: scene.visualBrief?.primaryMetric ?? content.metrics?.[0],
        metricCards: scene.visualBrief?.metricCards ?? content.metrics,
        timelineItems: scene.visualBrief?.timelineItems ?? content.timelineItems,
        nodes: visualBriefNodes,
        tags: scene.visualBrief?.tags ?? content.keywords,
        comparisonCards: scene.visualBrief?.comparisonCards ?? content.comparisons,
        summaryItems: scene.visualBrief?.summaryItems ?? content.summaryItems,
      },
    } satisfies Scene;
  });

  const narrativeLayer = buildNarrativeLayer(directedScenes);
  const videoArchetype = inferVideoArchetype(directedScenes);
  const creativeBrief = buildCreativeBrief(directedScenes, narrativeLayer, videoArchetype);
  const directorScript = buildDirectorScript(directedScenes, creativeBrief, videoArchetype);

  return {
    scenes: directedScenes,
    narrativeLayer,
    videoArchetype,
    creativeBrief,
    directorScript,
    directorQualityTargets,
  };
};

const createVoiceoverTimings = (blocks: VoiceoverBlock[], timelineSegments: TimelineSegment[]): Array<{ start: number; end: number }> => {
  if (blocks.length === 0) return [];
  const duration = timelineSegments.at(-1)?.end ?? Math.max(blocks.length * 4, 5);
  if (timelineSegments.length === 0) {
    const weights = blocks.map((block) =>
      Math.max(normalizeMatchText(block.text).length, 8),
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    let cursor = 0;
    return blocks.map((_, index) => {
      const start = cursor;
      cursor =
        index === blocks.length - 1
          ? duration
          : cursor + (duration * weights[index]) / totalWeight;
      return {
        start: Number(start.toFixed(3)),
        end: Number(cursor.toFixed(3)),
      };
    });
  }

  if (timelineSegments.length < blocks.length) {
    throw new Error(
      `服务商原生时间轴只有 ${timelineSegments.length} 个时间段，无法为 ${blocks.length} 个口播块分配非零边界`,
    );
  }

  const blockWeights = blocks.map((block) =>
    Math.max(normalizeMatchText(block.text).length, 1),
  );
  const totalBlockWeight =
    blockWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  const segmentWeights = timelineSegments.map((segment) =>
    Math.max(normalizeMatchText(segment.text).length, 1),
  );
  const totalSegmentWeight =
    segmentWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  const cumulativeSegmentWeight = [0];
  segmentWeights.forEach((weight) => {
    cumulativeSegmentWeight.push(
      cumulativeSegmentWeight.at(-1)! + weight,
    );
  });

  const timings: Array<{ start: number; end: number }> = [];
  let blockWeightSoFar = 0;
  let segmentStartIndex = 0;

  blocks.forEach((_, blockIndex) => {
    blockWeightSoFar += blockWeights[blockIndex];
    const remainingBlocks = blocks.length - blockIndex - 1;
    const minimumEndIndex = segmentStartIndex + 1;
    const maximumEndIndex = timelineSegments.length - remainingBlocks;
    const targetSegmentWeight =
      (blockWeightSoFar / totalBlockWeight) * totalSegmentWeight;

    let endIndex =
      blockIndex === blocks.length - 1
        ? timelineSegments.length
        : minimumEndIndex;
    while (
      endIndex < maximumEndIndex &&
      cumulativeSegmentWeight[endIndex] < targetSegmentWeight
    ) {
      endIndex += 1;
    }
    if (endIndex > minimumEndIndex) {
      const previousDistance = Math.abs(
        cumulativeSegmentWeight[endIndex - 1] - targetSegmentWeight,
      );
      const currentDistance = Math.abs(
        cumulativeSegmentWeight[endIndex] - targetSegmentWeight,
      );
      if (previousDistance <= currentDistance) endIndex -= 1;
    }

    const start =
      timings.at(-1)?.end ?? timelineSegments[0].start;
    const end = timelineSegments[endIndex - 1].end;
    if (end <= start) {
      throw new Error(
        `口播块 ${blockIndex + 1} 无法获得递增的服务商原生时间边界`,
      );
    }
    timings.push({
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
    });
    segmentStartIndex = endIndex;
  });

  return timings;
};

const splitVoiceoverSentences = (text: string): string[] => {
  const normalized = text
    .replace(/\r?\n+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[。！？!?；;])/g)
    .map((part) => part.trim())
    .filter(Boolean);

  return sentences.length ? sentences : [normalized];
};

const createCaptionLines = (
  blocks: VoiceoverBlock[],
  timings: Array<{ start: number; end: number }>,
  timelineSegments: TimelineSegment[],
): CaptionLine[] => {
  const lines: CaptionLine[] = [];
  const duration = timelineSegments.at(-1)?.end ?? timings.at(-1)?.end ?? Math.max(blocks.length * 4, 5);

  blocks.forEach((block, blockIndex) => {
    const sentences = splitVoiceoverSentences(block.text);
    if (sentences.length === 0) return;

    const blockStart = timings[blockIndex]?.start ?? 0;
    const blockEnd = timings[blockIndex]?.end ?? duration;
    const blockDuration = Math.max(0.4, blockEnd - blockStart);
    const weights = sentences.map((sentence) => Math.max(normalizeMatchText(sentence).length, 8));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    let cursor = blockStart;

    sentences.forEach((sentence, sentenceIndex) => {
      const start = cursor;
      cursor = sentenceIndex === sentences.length - 1 ? blockEnd : cursor + (blockDuration * weights[sentenceIndex]) / totalWeight;
      const end = Math.max(start + 0.8, cursor);

      lines.push({
        text: sentence,
        start: Number(start.toFixed(3)),
        end: Number(Math.min(blockEnd, end).toFixed(3)),
      });
    });
  });

  return lines;
};

const createTimelineOnlyBlocks = (timelineSegments: TimelineSegment[]): VoiceoverBlock[] => {
  const blocks: VoiceoverBlock[] = [];
  let currentText = "";
  let currentStart = timelineSegments[0]?.start ?? 0;
  const targetSeconds = 7.2;
  const targetChars = 58;

  const flush = () => {
    const text = currentText.trim();
    if (text) blocks.push({ text, images: [] });
    currentText = "";
  };

  timelineSegments.forEach((segment) => {
    if (!currentText) currentStart = segment.start;
    currentText += segment.text.trim();

    const longEnough = segment.end - currentStart >= targetSeconds;
    const textEnough = currentText.length >= targetChars;
    const punctuationBreak = /[。！？!?]$/.test(segment.text.trim());

    if (longEnough || textEnough || (punctuationBreak && currentText.length >= 34)) {
      flush();
    }
  });

  flush();
  return blocks;
};

const createTimelineOnlyTimings = (blocks: VoiceoverBlock[], timelineSegments: TimelineSegment[]): Array<{ start: number; end: number }> => {
  if (blocks.length === 0) return [];

  const duration = timelineSegments.at(-1)?.end ?? Math.max(blocks.length * 4, 5);
  if (timelineSegments.length === 0) {
    return blocks.map((_, index) => {
      const start = Number(((duration / blocks.length) * index).toFixed(3));
      const end = Number((index === blocks.length - 1 ? duration : (duration / blocks.length) * (index + 1)).toFixed(3));
      return { start, end };
    });
  }

  let segmentIndex = 0;
  return blocks.map((block, blockIndex) => {
    const start = blockIndex === 0 ? 0 : (timelineSegments[segmentIndex]?.start ?? 0);
    let textLength = 0;

    while (segmentIndex < timelineSegments.length) {
      textLength += timelineSegments[segmentIndex]?.text.trim().length ?? 0;
      const end = timelineSegments[segmentIndex]?.end ?? duration;
      segmentIndex += 1;
      if (textLength >= normalizeMatchText(block.text).length * 0.72 || segmentIndex >= timelineSegments.length) {
        return {
          start: Number(start.toFixed(3)),
          end: Number(end.toFixed(3)),
        };
      }
    }

    return {
      start: Number(start.toFixed(3)),
      end: Number(duration.toFixed(3)),
    };
  });
};

const buildScenesFromBlocks = (
  blocks: VoiceoverBlock[],
  timings: Array<{ start: number; end: number }>,
  warnings: string[],
): Scene[] => {
  return blocks.map((block, index) => {
    const id = `scene-${String(index + 1).padStart(4, "0")}`;
    const allImages = block.images;
    const images = allImages.slice(0, 2);

    if (allImages.length > 2) {
      warnings.push(`${id} 引用了超过 2 张图片，已保留前 2 张`);
    }

    return {
      id,
      start: timings[index]?.start ?? 0,
      end: timings[index]?.end ?? timings[index]?.start ?? 5,
      subtitle: block.text || " ",
      images,
      layout: sceneLayout(images, index, blocks.length),
      emphasis: extractEmphasis(block.text),
    };
  });
};

const createCaptionLinesFromScenes = (scenes: Scene[], timelineSegments: TimelineSegment[]): CaptionLine[] => {
  return createCaptionLines(
    scenes.map((scene) => ({ text: scene.subtitle, images: scene.images })),
    scenes.map((scene) => ({ start: scene.start, end: scene.end })),
    timelineSegments,
  );
};

const normalizeMatchText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9.]+/gu, "");
};

export const generateScenes = async ({
  materialPackPath,
  voiceoverPath,
  timelineSegments,
  scenesPath,
  audioSrc,
  articleText,
}: GenerateScenesInput): Promise<GeneratedScenes> => {
  if (!materialPackPath && voiceoverPath) {
    const warnings: string[] = [];
    const voiceover = await readFile(voiceoverPath, "utf8");
    const blocks = parseVoiceoverBlocks(voiceover);
    const sceneBlocks = blocks.length > 0 ? blocks : [{ text: "等待生成视频时间轴", images: [] }];
    const duration = timelineSegments.at(-1)?.end ?? Math.max(sceneBlocks.length * 4, 5);
    const timings = createVoiceoverTimings(sceneBlocks, timelineSegments);
    const readableScenes = splitLongScenesAtTimelineBoundaries(
      buildScenesFromBlocks(sceneBlocks, timings, warnings).map((scene, index, allScenes) => ({
        ...scene,
        layout: index === 0 ? "title" : index === allScenes.length - 1 ? "ending" : scene.layout,
      })),
      timelineSegments,
    );
    const visualScenes = enrichScenesWithVisualRecipes(readableScenes);
    const {
      scenes,
      narrativeLayer,
      videoArchetype,
      creativeBrief,
      directorScript,
      directorQualityTargets,
    } = applyDirectorDsl(visualScenes, timelineSegments, articleText);
    const captions = createCaptionLinesFromScenes(scenes, timelineSegments);

    const generated: GeneratedScenes = {
      scenes,
      captions,
      audioSrc,
      duration,
      fps: 30,
      width: 1920,
      height: 1080,
      narrativeLayer,
      videoArchetype,
      creativeBrief,
      directorScript,
      directorQualityTargets,
      warnings,
    };

    if (scenesPath) {
      await mkdir(path.dirname(scenesPath), { recursive: true });
      await writeFile(scenesPath, JSON.stringify(generated, null, 2));
    }

    return generated;
  }

  if (!materialPackPath) {
    const warnings: string[] = [];
    const blocks = createTimelineOnlyBlocks(timelineSegments);
    const sceneBlocks = blocks.length > 0 ? blocks : [{ text: "等待生成视频时间轴", images: [] }];
    const duration = timelineSegments.at(-1)?.end ?? Math.max(sceneBlocks.length * 4, 5);
    const timings = createTimelineOnlyTimings(sceneBlocks, timelineSegments);
    const readableScenes = splitLongScenesAtTimelineBoundaries(
      buildScenesFromBlocks(sceneBlocks, timings, warnings).map((scene, index, allScenes) => ({
        ...scene,
        layout: index === 0 ? "title" : index === allScenes.length - 1 ? "ending" : scene.layout,
      })),
      timelineSegments,
    );
    const visualScenes = enrichScenesWithVisualRecipes(readableScenes);
    const {
      scenes,
      narrativeLayer,
      videoArchetype,
      creativeBrief,
      directorScript,
      directorQualityTargets,
    } = applyDirectorDsl(visualScenes, timelineSegments, articleText);
    const captions = createCaptionLinesFromScenes(scenes, timelineSegments);

    const generated: GeneratedScenes = {
      scenes,
      captions,
      audioSrc,
      duration,
      fps: 30,
      width: 1920,
      height: 1080,
      narrativeLayer,
      videoArchetype,
      creativeBrief,
      directorScript,
      directorQualityTargets,
      warnings,
    };

    if (scenesPath) {
      await mkdir(path.dirname(scenesPath), { recursive: true });
      await writeFile(scenesPath, JSON.stringify(generated, null, 2));
    }

    return generated;
  }

  const voiceoverSource = await readFirstExistingMaterialPackFile(materialPackPath, ["口播文案.md", "voiceover.md", "图文位置.md", "article-images.md", "文章带图片位置_清洗版.md", "正文素材_含图片位置.md"]);
  const imageSource = await readFirstExistingMaterialPackFile(materialPackPath, ["图文位置.md", "article-images.md", "文章带图片位置_清洗版.md", "正文素材_含图片位置.md", "口播文案.md", "voiceover.md"]);
  const voiceoverBlocks = ["口播文案.md", "voiceover.md"].includes(voiceoverSource.fileName) ? parseVoiceoverBlocks(voiceoverSource.content) : parseArticleImageBlocks(voiceoverSource.content);
  const imageBlocks = ["口播文案.md", "voiceover.md"].includes(imageSource.fileName) ? parseVoiceoverBlocks(imageSource.content) : parseArticleImageBlocks(imageSource.content);
  const blocks = voiceoverBlocks.length > 0 ? voiceoverBlocks : imageBlocks;
  const duration = timelineSegments.at(-1)?.end ?? Math.max(blocks.length * 4, 5);
  const warnings: string[] = [];

  const sceneBlocks = blocks;
  const timings = createVoiceoverTimings(sceneBlocks, timelineSegments);
  const markerImages = assignMarkerImagesToScenes(imageBlocks, sceneBlocks);
  const readableScenes = splitLongScenesAtTimelineBoundaries(
    timelineSegments.length > 0 && sceneBlocks.length > 0
      ? sceneBlocks.map((block, index) => {
          const id = `scene-${String(index + 1).padStart(4, "0")}`;
          const allImages = markerImages[index] ?? block.images;
          const images = allImages.slice(0, 2);

          if (allImages.length > 2) {
            warnings.push(`${id} 引用了超过 2 张图片，已保留前 2 张`);
          }

          return {
            id,
            start: timings[index].start,
            end: timings[index].end,
            subtitle: block.text || " ",
            images,
            layout: sceneLayout(images, index, sceneBlocks.length),
            emphasis: extractEmphasis(block.text),
          };
        })
      : (blocks.length ? blocks : [{ text: "等待生成视频时间轴", images: [] }]).map((block, index) => {
          const sceneCount = Math.max(blocks.length, 1);
          const start = Number(((duration / sceneCount) * index).toFixed(3));
          const end = Number((index === sceneCount - 1 ? duration : (duration / sceneCount) * (index + 1)).toFixed(3));
          const id = `scene-${String(index + 1).padStart(4, "0")}`;

          return {
            id,
            start,
            end,
            subtitle: block.text || " ",
            images: block.images.slice(0, 2),
            layout: sceneLayout(block.images, index, sceneCount),
            emphasis: extractEmphasis(block.text),
          };
        }),
    timelineSegments,
  );
  const visualScenes: Scene[] = enrichScenesWithVisualRecipes(readableScenes);
  const {
    scenes,
    narrativeLayer,
    videoArchetype,
    creativeBrief,
    directorScript,
    directorQualityTargets,
  } = applyDirectorDsl(visualScenes, timelineSegments, articleText);
  const captions = createCaptionLinesFromScenes(scenes, timelineSegments);

  const generated: GeneratedScenes = {
    materialPackPath,
    scenes,
    captions,
    audioSrc,
    duration,
    fps: 30,
    width: 1920,
    height: 1080,
    narrativeLayer,
    videoArchetype,
    creativeBrief,
    directorScript,
    directorQualityTargets,
    warnings,
  };

  if (scenesPath) {
    await mkdir(path.dirname(scenesPath), { recursive: true });
    await writeFile(scenesPath, JSON.stringify(generated, null, 2));
  }

  return generated;
};
