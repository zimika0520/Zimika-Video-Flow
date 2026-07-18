import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VideoStyle } from "./editor-types";
import {
  defaultStyleProfile,
  type BackgroundType,
  type CameraMotion,
  type DataAnimation,
  type EmphasisAnimation,
  type EntranceAnimation,
  type LayoutRecipe,
  type MotionVariant,
  type RuntimeStyleProfile,
  type SceneType,
  type ShotStyle,
  type TransitionAnimation,
  type VisualModule,
} from "./types";

type StylePatch = Omit<RuntimeStyleProfile, "styleProfileVersion" | "aspectRatio" | "layoutSystem">;

const baseLayoutSystem: RuntimeStyleProfile["layoutSystem"] = {
  safeArea: { top: 50, right: 78, bottom: 42, left: 78 },
  layers: ["background", "progress", "headline", "cards", "subtitle", "transition"],
  overflowGuard: true,
  measureTextBeforeRender: true,
};

const baseSceneTypes: SceneType[] = [
  "impact-hook",
  "news-context",
  "data-breakdown",
  "relationship-map",
  "risk-contrast",
  "timeline",
  "evidence-zoom",
  "concept-steps",
  "quote-impact",
  "summary-card",
];

const baseLayoutRecipes: LayoutRecipe[] = [
  "metric-hero",
  "news-column",
  "stacked-data-cards",
  "node-map",
  "split-risk-cards",
  "horizontal-timeline",
  "screenshot-focus",
  "step-ladder",
  "quote-slam",
  "closing-summary",
];

const baseMotionVariants: MotionVariant[] = [
  "scale-pop",
  "line-draw",
  "column-wipe",
  "scan-rise",
  "card-stack",
  "white-flash",
  "slow-push",
  "guided-pan",
  "warning-pulse",
  "type-build",
];

const baseShotStyles: ShotStyle[] = ["Burst", "Flow", "Reveal", "Zoom", "Split", "Collapse"];

const baseEntranceAnimations: EntranceAnimation[] = ["fadeBlurIn", "slideParallaxIn", "maskReveal", "zoomIn", "kineticPop"];

const baseEmphasisAnimations: EmphasisAnimation[] = ["pulseGlow", "microShake", "highlightSweep", "depthPush", "elasticStretch"];

const baseTransitionAnimations: TransitionAnimation[] = ["wipe", "morph", "split", "flowMerge", "cameraPan"];

const baseDataAnimations: DataAnimation[] = ["kineticCounter", "particleFormation", "liquidFill", "jitterSettle"];

const baseCameraMotions: CameraMotion[] = ["dollyIn", "dollyOut", "parallaxDrift", "orbitalRotate"];

const baseBackgroundTypes: BackgroundType[] = ["Flat", "Gradient", "Mesh", "Grid", "DataField", "AbstractFlow"];

const baseVisualModules: VisualModule[] = [
  "transforms",
  "assets",
  "layers",
  "transitions",
  "effects",
  "fonts",
  "measuring",
  "randomness",
  "animation-math",
  "svg-path",
  "color-interpolation",
];

const buildRecipeSystems = (style: VideoStyle): Pick<
  RuntimeStyleProfile,
  "recipeSystem" | "motionModules" | "transitionModules" | "effectModules" | "antiRepetitionRules" | "sectionPacing"
  | "directorSystem"
> => {
  const effectModules: VisualModule[] = [...baseVisualModules];

  if (style === "fast-short-video") {
    effectModules.push("posterization", "starburst", "light-leaks");
  } else if (style === "dark-data-analysis") {
    effectModules.push("html-in-canvas");
  } else {
    effectModules.push("light-leaks");
  }

  return {
    recipeSystem: {
      sceneTypes: baseSceneTypes,
      layoutRecipes: baseLayoutRecipes,
      motionVariants: baseMotionVariants,
      visualModules: [...new Set(effectModules)],
      defaultSequence: [
        "impact-hook",
        "news-context",
        "data-breakdown",
        "relationship-map",
        "risk-contrast",
        "concept-steps",
        "quote-impact",
        "summary-card",
      ],
    },
    motionModules: {
      title: ["scale-pop", "column-wipe", "type-build", "white-flash"],
      cards: ["card-stack", "scan-rise", "scale-pop", "line-draw"],
      camera: ["slow-push", "guided-pan", "snap-zoom", "data-dolly", "locked-column"],
      keyword: ["underline-sweep", "marker-bar", "concept-pill", "punch-scale", "glow-scan"],
    },
    transitionModules: ["flash-wipe", "column-cut", "card-slide", "white-flash", "scan-wipe", "soft-wipe"],
    effectModules: [...new Set(effectModules)],
    directorSystem: {
      shotStyles: baseShotStyles,
      entranceAnimations: baseEntranceAnimations,
      emphasisAnimations: baseEmphasisAnimations,
      transitionAnimations: baseTransitionAnimations,
      dataAnimations: baseDataAnimations,
      cameraMotions: baseCameraMotions,
      backgroundTypes: baseBackgroundTypes,
    },
    antiRepetitionRules: {
      maxSameSceneTypeInRow: 1,
      maxSameMotionVariantInRow: 1,
      minShotStylesPerVideo: 3,
      requireMemoryFrame: true,
      minSceneTypesPerVideo: 3,
    },
    sectionPacing: {
      opening: style === "fast-short-video" ? "strong" : "medium",
      middle: style === "knowledge-explainer" ? "soft" : "medium",
      ending: style === "fast-short-video" ? "strong" : "medium",
    },
  };
};

const profiles: Record<VideoStyle, StylePatch> = {
  "light-finance-mg": {
    ...defaultStyleProfile,
    styleKey: "light-finance-mg",
    styleName: "浅色财经 MG",
  },
  "news-commentary": {
    styleKey: "news-commentary",
    styleName: "新闻评论风",
    visualFoundation: {
      background: {
        type: "news-column",
        colors: ["#ffffff", "#f8fafc", "#eef2f7"],
        gridOpacity: 0.28,
        noise: { enabled: false, opacity: 0 },
      },
      palette: {
        primary: "#dc2626",
        secondary: "#111827",
        accent: "#991b1b",
        warning: "#f59e0b",
        text: "#111827",
        muted: "#475569",
        paper: "#f8fafc",
        panel: "#ffffff",
        line: "#fecaca",
      },
      typography: {
        fontFamily: "Inter, Arial, sans-serif",
        titleWeight: 940,
        captionWeight: 760,
        lineHeight: 1.22,
        maxCharsPerLine: 24,
      },
    },
    motionSystem: {
      intensity: "medium",
      titleEnter: "news-slam",
      cardEnter: "column-wipe",
      keywordHighlight: "marker-bar",
      camera: "locked-column",
      transformComposer: "makeTransform",
      colorInterpolation: "interpolateColors",
    },
    effectsSystem: {
      borderRadius: 6,
      boxShadow: "0 22px 54px rgba(127, 29, 29, 0.14)",
      filter: "saturate(1.02) contrast(1.04)",
      gradient: "linear-gradient(90deg, #dc2626, #111827)",
      lightLeaks: false,
      starburst: false,
      svgPathMotion: true,
    },
    transitionSystem: {
      default: "column-cut",
      durationFrames: 14,
      posterize: false,
    },
  },
  "knowledge-explainer": {
    styleKey: "knowledge-explainer",
    styleName: "知识解释风",
    visualFoundation: {
      background: {
        type: "concept-map",
        colors: ["#ffffff", "#f4fffb", "#eaf3ff"],
        gridOpacity: 0.38,
        noise: { enabled: false, opacity: 0 },
      },
      palette: {
        primary: "#0f9f80",
        secondary: "#2563eb",
        accent: "#14b8a6",
        warning: "#f59e0b",
        text: "#12312f",
        muted: "#456561",
        paper: "#f4fffb",
        panel: "#ffffff",
        line: "#b8eee2",
      },
      typography: {
        fontFamily: "Inter, Arial, sans-serif",
        titleWeight: 900,
        captionWeight: 720,
        lineHeight: 1.32,
        maxCharsPerLine: 28,
      },
    },
    motionSystem: {
      intensity: "soft",
      titleEnter: "step-reveal",
      cardEnter: "stack-expand",
      keywordHighlight: "concept-pill",
      camera: "guided-pan",
      transformComposer: "makeTransform",
      colorInterpolation: "interpolateColors",
    },
    effectsSystem: {
      borderRadius: 10,
      boxShadow: "0 24px 62px rgba(20, 184, 166, 0.14)",
      filter: "saturate(1.04) contrast(1.01)",
      gradient: "linear-gradient(90deg, #0f9f80, #2563eb)",
      lightLeaks: true,
      starburst: false,
      svgPathMotion: true,
    },
    transitionSystem: {
      default: "card-slide",
      durationFrames: 20,
      posterize: false,
    },
  },
  "fast-short-video": {
    styleKey: "fast-short-video",
    styleName: "强节奏短视频风",
    visualFoundation: {
      background: {
        type: "impact-cards",
        colors: ["#ffffff", "#fff7ed", "#eef2ff"],
        gridOpacity: 0.24,
        noise: { enabled: false, opacity: 0 },
      },
      palette: {
        primary: "#ef4444",
        secondary: "#f59e0b",
        accent: "#111827",
        warning: "#f97316",
        text: "#121826",
        muted: "#475569",
        paper: "#fff7ed",
        panel: "#ffffff",
        line: "#fed7aa",
      },
      typography: {
        fontFamily: "Inter, Arial, sans-serif",
        titleWeight: 950,
        captionWeight: 820,
        lineHeight: 1.16,
        maxCharsPerLine: 20,
      },
    },
    motionSystem: {
      intensity: "strong",
      titleEnter: "impact-pop",
      cardEnter: "flash-cut",
      keywordHighlight: "punch-scale",
      camera: "snap-zoom",
      transformComposer: "makeTransform",
      colorInterpolation: "interpolateColors",
    },
    effectsSystem: {
      borderRadius: 6,
      boxShadow: "0 28px 72px rgba(239, 68, 68, 0.2)",
      filter: "saturate(1.1) contrast(1.06)",
      gradient: "linear-gradient(90deg, #ef4444, #f59e0b)",
      lightLeaks: true,
      starburst: true,
      svgPathMotion: true,
    },
    transitionSystem: {
      default: "white-flash",
      durationFrames: 10,
      posterize: true,
    },
  },
  "dark-data-analysis": {
    styleKey: "dark-data-analysis",
    styleName: "深色数据分析风",
    visualFoundation: {
      background: {
        type: "dark-grid",
        colors: ["#101827", "#18243a", "#0f172a"],
        gridOpacity: 0.3,
        noise: { enabled: false, opacity: 0 },
      },
      palette: {
        primary: "#60a5fa",
        secondary: "#14b8a6",
        accent: "#a78bfa",
        warning: "#fbbf24",
        text: "#e6f0ff",
        muted: "#94a3b8",
        paper: "#0f172a",
        panel: "#111827",
        line: "#334155",
      },
      typography: {
        fontFamily: "Inter, Arial, sans-serif",
        titleWeight: 910,
        captionWeight: 720,
        lineHeight: 1.26,
        maxCharsPerLine: 26,
      },
    },
    motionSystem: {
      intensity: "medium",
      titleEnter: "data-scan",
      cardEnter: "scan-rise",
      keywordHighlight: "glow-scan",
      camera: "data-dolly",
      transformComposer: "makeTransform",
      colorInterpolation: "interpolateColors",
    },
    effectsSystem: {
      borderRadius: 8,
      boxShadow: "0 28px 78px rgba(2, 6, 23, 0.62)",
      filter: "saturate(1.06) contrast(1.04)",
      gradient: "linear-gradient(90deg, #60a5fa, #14b8a6)",
      lightLeaks: false,
      starburst: false,
      svgPathMotion: true,
    },
    transitionSystem: {
      default: "scan-wipe",
      durationFrames: 18,
      posterize: false,
    },
  },
};

export const buildRuntimeStyleProfile = (
  style: VideoStyle = "light-finance-mg",
  aspectRatio: RuntimeStyleProfile["aspectRatio"] = "16:9",
): RuntimeStyleProfile => {
  const profile = profiles[style] ?? profiles["light-finance-mg"];

  return {
    styleProfileVersion: 2,
    styleKey: profile.styleKey,
    styleName: profile.styleName,
    aspectRatio,
    visualFoundation: profile.visualFoundation,
    layoutSystem: baseLayoutSystem,
    motionSystem: profile.motionSystem,
    effectsSystem: profile.effectsSystem,
    transitionSystem: profile.transitionSystem,
    ...buildRecipeSystems(profile.styleKey),
  };
};

export const writeRuntimeStyleProfile = async (
  styleProfilePath: string,
  style: VideoStyle = "light-finance-mg",
  aspectRatio: RuntimeStyleProfile["aspectRatio"] = "16:9",
): Promise<RuntimeStyleProfile> => {
  const profile = buildRuntimeStyleProfile(style, aspectRatio);
  await mkdir(path.dirname(styleProfilePath), { recursive: true });
  await writeFile(styleProfilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  return profile;
};

export const readRuntimeStyleProfile = async (styleProfilePath: string): Promise<RuntimeStyleProfile> => {
  const profile = JSON.parse(await readFile(styleProfilePath, "utf8")) as RuntimeStyleProfile;

  if (!profile.styleProfileVersion) {
    throw new Error("runtime/style-profile.json 缺少 styleProfileVersion，停止渲染");
  }

  if (!profile.visualFoundation?.palette || !profile.motionSystem || !profile.effectsSystem || !profile.transitionSystem) {
    throw new Error("runtime/style-profile.json 缺少 Remotion 可读取的视觉配置，停止渲染");
  }

  return profile;
};
