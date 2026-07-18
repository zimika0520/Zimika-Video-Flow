import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import type { CSSProperties, ReactNode } from "react";
import {
  type CaptionLine,
  defaultStyleProfile,
  type DirectorCompositionLayout,
  type DirectorCompositionMotion,
  type DirectorCompositionProfile,
  type DirectorCompositionTitlePlacement,
  type DirectorSceneType,
  type RenderInput,
  type RuntimeAssetManifest,
  type RuntimeStyleProfile,
  type Scene,
  type SceneType,
  type TransitionAnimation,
} from "../lib/types";
import { resolveDirectorCompositionProfile } from "../lib/director-composition";
import { resolveSceneStageInset } from "../lib/video-layout";
import { type RenderableGeneratedConceptVisual } from "../lib/generated-concept-visual";
import {
  factualCandlesFromScene,
  factualChartPointsFromScene,
  factualGaugeValueFromScene,
  factualHeatmapPointsFromScene,
} from "../lib/factual-visual-data";
import {
  resolveScenePrimaryVisual,
  type ScenePrimaryVisual,
} from "../lib/scene-primary-visual";
import {
  cameraMotionTransform,
  cameraTransform,
  emphasisAnimationStyle,
  entranceAnimationStyle,
  entranceTransform,
  makeTransform,
  visualEase,
} from "./motion/transforms";
import { seededRange } from "./motion/random";
import { clampText, fitChineseText } from "./motion/text-fit";
import { buildSceneGraph } from "./visual-library/scene-graph";
import {
  BarRaceChart,
  ChapterBreak,
  ChipArchitecture,
  ChipHeroFrame,
  CompetitionRings,
  ComputeFlow,
  CostMeterFrame,
  DecisionTree,
  EventCard,
  EvidenceWall,
  GaugeMeter,
  KLineChart,
  LineTrendChart,
  MarketHeatmap,
  MetricCounter,
  MoonCompositionFrame,
  MoonPerceptionFrame,
  NodeGraph,
  ProductEcosystemMap,
  QuoteFocus,
  ReferenceScaleFrame,
  RiskMeter,
  SupplyChainMap,
  TechQuadrantWall,
  TimelineRail,
  TrainingInferenceSplit,
  AngularDiameterFrame,
  AttentionFieldFrame,
  DistanceMythFrame,
  FieldOfViewFrame,
  ZoomCropFrame,
  type CandlePoint,
  type ChartPoint,
  type GraphEdgeItem,
  type GraphNodeItem,
  type MetricItem,
  type TimelineItem,
  type VisualTheme,
} from "./visual-library";

const ink = "#111827";
const muted = "#64748b";
const paper = "#f7f9fc";
const panel = "#ffffff";
const line = "#dbe5f2";
const blue = "#2563eb";
const cyan = "#06b6d4";
const green = "#10b981";
const amber = "#f59e0b";
const red = "#ef4444";

type SceneVariant = "hero" | "data" | "relation" | "evidence" | "closing";
type Theme = {
  styleKey: RuntimeStyleProfile["styleKey"];
  styleName: string;
  ink: string;
  muted: string;
  paper: string;
  panel: string;
  line: string;
  primary: string;
  secondary: string;
  accent: string;
  warning: string;
  gradient: string;
  shadow: string;
  filter: string;
  radius: number;
  fontFamily: string;
  titleWeight: number;
  captionWeight: number;
  motion: number;
  gridOpacity: number;
  backgroundColors: string[];
  transitionFrames: number;
  starburst: boolean;
  noiseEnabled: boolean;
  noiseOpacity: number;
  isDark: boolean;
};

type CaseVisualBrief = NonNullable<Scene["visualBrief"]> & {
  bars?: Array<{ label: string; value: number; color?: string }>;
  flowItems?: string[];
  boardItems?: Array<{ label: string; value: string; note?: string }>;
  heroKicker?: string;
  heroLabel?: string;
  heroMark?: string;
  heroStatus?: string;
  centerKicker?: string;
  centerLabel?: string;
};

const ease = visualEase;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const createTheme = (profile: RuntimeStyleProfile = defaultStyleProfile): Theme => {
  const palette = profile.visualFoundation.palette;
  const intensity = profile.motionSystem.intensity;

  return {
    styleKey: profile.styleKey,
    styleName: profile.styleName,
    ink: palette.text,
    muted: palette.muted,
    paper: palette.paper,
    panel: palette.panel,
    line: palette.line,
    primary: palette.primary,
    secondary: palette.secondary,
    accent: palette.accent,
    warning: palette.warning,
    gradient: profile.effectsSystem.gradient,
    shadow: profile.effectsSystem.boxShadow,
    filter: profile.effectsSystem.filter,
    radius: profile.effectsSystem.borderRadius,
    fontFamily: profile.visualFoundation.typography.fontFamily,
    titleWeight: profile.visualFoundation.typography.titleWeight,
    captionWeight: profile.visualFoundation.typography.captionWeight,
    motion: intensity === "strong" ? 1.32 : intensity === "soft" ? 0.76 : 1,
    gridOpacity: profile.visualFoundation.background.gridOpacity,
    backgroundColors: profile.visualFoundation.background.colors,
    transitionFrames: profile.transitionSystem.durationFrames,
    starburst: profile.effectsSystem.starburst,
    noiseEnabled: profile.visualFoundation.background.noise.enabled,
    noiseOpacity: profile.visualFoundation.background.noise.opacity,
    isDark: profile.styleKey === "dark-data-analysis",
  };
};

const fade = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

const slide = (frame: number, start: number, end: number, from: number) =>
  interpolate(frame, [start, end], [from, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

const splitSentences = (text: string) =>
  text
    .split(/(?<=[。！？!?])|\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

const compactText = (text: string, maxLength: number) => {
  const clean = text.replace(/\s+/g, "");
  return clean.length > maxLength ? clean.slice(0, maxLength) : clean;
};

const getMainLine = (text: string, maxLength = 24) => compactText(splitSentences(text)[0] ?? text, maxLength);

const getSupportLine = (text: string, maxLength = 52) => {
  const sentences = splitSentences(text);
  const support = sentences.length > 1 ? sentences.slice(1).join("") : text;
  return compactText(support, maxLength);
};

const metricPattern = /\d+(?:\.\d+)?\s*(?:%|倍|K|B|元\/百万tokens|元|亿|万|美金|美元|tokens)/gi;
const keywordPattern =
  /腾讯混元|混元|Hy3|MoE|WorkBuddy|CodeBuddy|元宝|Marvis|ima|API|Token|Apache|Huggingface|OpenRouter|优必选|UBTECH|U1Lite|U1Pro|U1|仿生机器人|情感陪伴|智能大模型|预售订单|单身经济|情绪陪伴|定金|付款率|量产难度|宇树|模型|业务|价格|订单|开源|上下文|幻觉率|错误率|成本|能力|办公|代码|金融|任务|增长|下降|提升|降低|结构|链路|影响|市场/g;

const getMetric = (scene: Scene) => {
  if (scene.visualBrief?.primaryMetric?.value) {
    return scene.visualBrief.primaryMetric.value;
  }

  const fromEmphasis = scene.emphasis?.find((value) => /\d+(?:\.\d+)?\s*(?:%|倍|K|B|元\/百万tokens|元|亿|万|美金|美元|tokens)/i.test(value));
  const fromText = scene.subtitle.match(metricPattern)?.[0];
  const fallback = scene.content?.keywords?.[0] ?? scene.visualBrief?.tags?.[0] ?? "核心升级";
  return (fromEmphasis ?? fromText ?? fallback).replace(/\s+/g, "");
};

const getAccent = (index: number, theme?: Theme) =>
  theme ? [theme.primary, theme.secondary, theme.warning, theme.accent, red][index % 5] : [blue, green, amber, cyan, red][index % 5];

const toVisualTheme = (theme: Theme): VisualTheme => ({
  fontFamily: theme.fontFamily,
  radius: theme.radius,
  shadow: theme.shadow,
  palette: {
    bg: theme.paper,
    panel: theme.panel,
    text: theme.ink,
    muted: theme.muted,
    line: theme.line,
    primary: theme.primary,
    secondary: theme.secondary,
    accent: theme.accent,
    danger: red,
    warning: theme.warning,
    success: green,
  },
});

const getVariant = (scene: Scene, index: number, total: number): SceneVariant => {
  if (scene.layout === "ending" || index === total - 1) return "closing";
  if (scene.images.length > 0) return "evidence";

  const text = scene.subtitle.toLowerCase();
  if (index === 0 || /12亿|最大|收入来源/.test(scene.subtitle)) return "hero";
  if (/wlfi|meme|ip|授权|代币|股权|收入/.test(text)) return index % 2 === 0 ? "relation" : "data";
  if (scene.emphasis?.some((value) => /\d/.test(value))) return "data";
  return index % 3 === 0 ? "relation" : "data";
};

const fallbackSceneType = (scene: Scene, index: number, total: number): SceneType => {
  const variant = getVariant(scene, index, total);
  if (variant === "hero") return "impact-hook";
  if (variant === "data") return "data-breakdown";
  if (variant === "relation") return "relationship-map";
  if (variant === "evidence") return "evidence-zoom";
  return "summary-card";
};

const sceneEyebrow: Record<SceneType, string> = {
  "impact-hook": "开场爆点",
  "news-context": "背景交代",
  "data-breakdown": "数据拆解",
  "relationship-map": "关系图谱",
  "risk-contrast": "风险对比",
  timeline: "时间推进",
  "evidence-zoom": "证据放大",
  "concept-steps": "概念拆解",
  "quote-impact": "关键判断",
  "summary-card": "结尾总结",
};

const directorToLegacySceneType: Record<DirectorSceneType, SceneType> = {
  Hero: "impact-hook",
  Timeline: "timeline",
  SystemMap: "relationship-map",
  DataExplosion: "data-breakdown",
  Contrast: "risk-contrast",
  SpecSheet: "evidence-zoom",
  Pricing: "data-breakdown",
  Pause: "quote-impact",
  Summary: "summary-card",
  EvidenceHero: "evidence-zoom",
  KeywordInvestigation: "concept-steps",
  FinancialMeter: "data-breakdown",
  SystemStack: "relationship-map",
  DependencyMap: "relationship-map",
  QuestionPause: "quote-impact",
  BarrierWall: "evidence-zoom",
  EvidenceReturn: "evidence-zoom",
  IndustrySignal: "relationship-map",
  CompetitionLayerStack: "concept-steps",
  FinalJudgement: "summary-card",
};

const emphasisItems = (scene: Scene, fallback: string[] = []) => {
  const items = scene.emphasis?.length ? scene.emphasis : fallback;
  return [...new Set(items.filter(Boolean))].slice(0, 4);
};

const cleanKeyword = (value: string) =>
  value
    .replace(/[，。！？；：、,.!?;:\s]/g, "")
    .replace(/真正|不是|而是|这个|那个|同时|开始|最后|所以/g, "")
    .trim();

const visualKeywords = (scene: Scene, fallback: string[] = [], max = 4) => {
  const fromText = scene.subtitle.match(keywordPattern) ?? [];
  const candidates = [...(scene.emphasis ?? []), ...fromText, ...fallback]
    .map(cleanKeyword)
    .filter((value) => value.length >= 2 && value.length <= 10);

  return [...new Set(candidates)].slice(0, max);
};

const visualPhrase = (scene: Scene, fallback: string, max = 12) => {
  if (scene.visualBrief?.headline) {
    return clampText(scene.visualBrief.headline, max);
  }

  const [first] = visualKeywords(scene, [fallback], 1);
  return clampText(first || fallback, max);
};

const briefTags = (scene: Scene, fallback: string[] = [], max = 4) => {
  const tags = scene.visualBrief?.tags?.length ? scene.visualBrief.tags : fallback;
  return tags.map((tag) => clampText(tag, 10)).filter(Boolean).slice(0, max);
};

const explanationLines = (scene: Scene, fallback: string[] = [], max = 3) => {
  const text = scene.subtitle;
  const candidates: string[] = [];

  if (/优必选|U1|仿生机器人|情感陪伴/.test(text)) {
    candidates.push("表面是机器人发布", "核心是情感陪伴场景开始产品化");
  }
  if (/五官|身材|眨眼|挑眉|微笑|复合表情|智能大模型/.test(text)) {
    candidates.push("拟真外观负责第一眼吸引", "大模型负责互动和表情反应");
  }
  if (/U1Lite|U1Pro|88\s*万|99\s*万|价格|售价/.test(text)) {
    candidates.push("价格带拉开消费分层", "高配版本主打更强仿生体验");
  }
  if (/预售订单|1\.33\s*万|12\s*倍|订单/.test(text)) {
    candidates.push("预售数字制造市场关注", "真正价值要看最终付款和交付");
  }
  if (/单身经济|情绪陪伴|2\.4\s*亿|8\s*万亿/.test(text)) {
    candidates.push("需求来自陪伴缺口", "消费逻辑从工具转向情绪价值");
  }
  if (/宇树|科研|工业|成人消费|陪伴/.test(text)) {
    candidates.push("不拼工业机器人路线", "转向陪伴和情绪消费场景");
  }
  if (/定金|付款率|量产|眉毛|睫毛|人工/.test(text)) {
    candidates.push("定金不等于真实成交", "量产细节决定交付质量");
  }
  if (/9月16日|交付|订单成色/.test(text)) {
    candidates.push("交付才是关键节点", "订单成色要等市场验证");
  }

  if (/Hy3|混元/.test(text)) {
    candidates.push("表面是新模型发布", "本质是基础设施重建后的首个正式成果");
  }
  if (/WorkBuddy|CodeBuddy|元宝|Marvis|ima/.test(text)) {
    candidates.push("不是单点 Demo", "已经进入办公、代码和智能体业务");
  }
  if (/Token|消耗|增长|20\s*倍/.test(text)) {
    candidates.push("真实调用量上升", "市场开始验证实用模型定位");
  }
  if (/幻觉|错误率|RAG/.test(text)) {
    candidates.push("重点不是更会说", "而是减少错答和常识错误");
  }
  if (/MoE|295B|21B|256K/.test(text)) {
    candidates.push("大参数负责能力上限", "激活参数控制推理成本");
  }
  if (/价格|1\s*元|4\s*元|0\.25/.test(text)) {
    candidates.push("价格是放量关键", "缓存命中进一步压低输入成本");
  }
  if (/Apache|开源|商用|Huggingface/.test(text)) {
    candidates.push("商业友好协议", "开发者可以下载并免费商用");
  }

  return [...new Set([...candidates, ...fallback].map((item) => clampText(item, 24)).filter(Boolean))].slice(0, max);
};

const ExplanationStack = ({ lines, theme, delay = 18 }: { lines: string[]; theme: Theme; delay?: number }) => {
  const frame = useCurrentFrame();
  if (!lines.length) return null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {lines.map((line, index) => {
        const local = frame - delay - index * 8;
        const opacity = fade(local, 0, 16);
        const y = slide(local, 0, 22, 18);

        return (
          <div
            key={`${line}-${index}`}
            style={{
              opacity,
              transform: `translateY(${y}px)`,
              padding: "18px 22px",
              borderRadius: theme.radius,
              background: theme.isDark ? "rgba(15,23,42,0.72)" : "rgba(255,255,255,0.82)",
              border: `1px solid ${getAccent(index, theme)}40`,
              boxShadow: `0 18px 54px ${getAccent(index, theme)}12`,
              color: theme.ink,
              fontSize: 27,
              lineHeight: 1.24,
              fontWeight: 840,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};

const TypeRevealText = ({
  text,
  theme,
  delay = 0,
  color,
}: {
  text: string;
  theme: Theme;
  delay?: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const shown = text.slice(0, Math.min(text.length, Math.floor(local / 1.8)));
  const cursor = local < text.length * 1.8 + 18 && Math.floor(local / 10) % 2 === 0;

  return (
    <span style={{ color: color ?? theme.ink }}>
      {shown}
      {cursor ? <span style={{ color: theme.primary }}>｜</span> : null}
    </span>
  );
};

const DefinitionCard = ({
  title,
  lines,
  theme,
  delay = 18,
}: {
  title: string;
  lines: string[];
  theme: Theme;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const enter = entranceTransform({ frame: frame - delay, fps: 30, variant: "scan-rise", pace: "soft" });

  return (
    <div
      style={{
        ...enter,
        padding: "28px 32px",
        borderRadius: theme.radius,
        background: theme.isDark ? "rgba(15,23,42,0.72)" : "rgba(255,255,255,0.86)",
        border: `1px solid ${theme.primary}40`,
        boxShadow: `0 22px 70px ${theme.primary}14`,
      }}
    >
      <div style={{ color: theme.primary, fontSize: 26, fontWeight: 960, marginBottom: 18 }}>{title}</div>
      <div style={{ display: "grid", gap: 14 }}>
        {lines.map((line, index) => (
          <div
            key={`${line}-${index}`}
            style={{
              minHeight: 40,
              color: index === 0 ? theme.ink : theme.muted,
              fontSize: 28,
              lineHeight: 1.28,
              fontWeight: index === 0 ? 900 : 780,
            }}
          >
            <TypeRevealText text={line} theme={theme} delay={delay + 12 + index * 18} color={index === 0 ? theme.ink : theme.muted} />
          </div>
        ))}
      </div>
    </div>
  );
};

const KeywordPills = ({ scene, theme, fallback }: { scene: Scene; theme: Theme; fallback: string[] }) => {
  const frame = useCurrentFrame();
  const keywords = visualKeywords(scene, fallback, 4);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
      {keywords.map((keyword, index) => {
        const local = frame - 10 - index * 5;
        const enter = entranceTransform({ frame: local, fps: 30, variant: "card-stack", pace: scene.pace });

        return (
          <div
            key={`${keyword}-${index}`}
            style={{
              ...enter,
              padding: "12px 18px",
              borderRadius: theme.radius,
              color: getAccent(index, theme),
              background: theme.isDark ? "rgba(15,23,42,0.66)" : `${getAccent(index, theme)}14`,
              border: `1px solid ${getAccent(index, theme)}44`,
              fontSize: 26,
              fontWeight: 920,
            }}
          >
            {keyword}
          </div>
        );
      })}
    </div>
  );
};

const AnimatedBackground = ({ accent = blue, theme }: { accent?: string; theme: Theme }) => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [0, 90], [0.96, 1], { extrapolateRight: "clamp", easing: ease });
  const [start, middle, end] = theme.backgroundColors;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: theme.paper }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: theme.gridOpacity,
          backgroundImage:
            `linear-gradient(${theme.line} 1px, transparent 1px), linear-gradient(90deg, ${theme.line} 1px, transparent 1px)`,
	          backgroundSize: "56px 56px",
		          transform: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(145deg, ${start}, ${middle} 54%, ${end})`,
          opacity: theme.isDark ? 0.96 : 0.72,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 780,
          height: 780,
          right: -180,
          top: -210,
	          borderRadius: "50%",
	          background: `radial-gradient(circle, ${accent}33 0%, ${accent}12 38%, transparent 70%)`,
	          transform: `scale(${glow})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 920,
          height: 280,
          left: -130,
          bottom: 92,
          borderRadius: 999,
	          background: theme.gradient,
	          opacity: theme.isDark ? 0.22 : 0.14,
		          transform: "rotate(-10deg)",
        }}
      />
      {theme.starburst ? (
        <div
          style={{
            position: "absolute",
            right: 160,
            top: 120,
            width: 360,
            height: 360,
	            opacity: 0.16,
	            background: `repeating-conic-gradient(from 18deg, ${theme.primary} 0deg 7deg, transparent 7deg 16deg)`,
            borderRadius: 999,
            filter: "blur(1px)",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const DirectorBackground = ({ scene, accent = blue, theme }: { scene: Scene; accent?: string; theme: Theme }) => {
  const frame = useCurrentFrame();
  const bg = scene.background;
  const [start, middle, end] = theme.backgroundColors;
  const type = bg?.backgroundType ?? "Gradient";
  const directorType = scene.directorType;
  const emotional = bg?.backgroundRole === "emotional";
  const reveal = interpolate(frame, [0, 70], [0, 1], { extrapolateRight: "clamp", easing: ease });
  const gridShift = 0;
  const drift = interpolate(frame, [0, 180], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) });

  if (!bg) {
    return <AnimatedBackground accent={accent} theme={theme} />;
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: type === "Flat" ? theme.paper : `linear-gradient(145deg, ${start}, ${middle} 56%, ${end})` }}>
      {type === "Gradient" || type === "Mesh" || type === "AbstractFlow" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${start}, ${middle} 48%, ${end})`,
            opacity: theme.isDark ? 0.98 : 0.76,
          }}
        />
      ) : null}

      {type === "Grid" || type === "DataField" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: type === "DataField" ? 0.36 : theme.gridOpacity,
            backgroundImage: `linear-gradient(${theme.line} 1px, transparent 1px), linear-gradient(90deg, ${theme.line} 1px, transparent 1px)`,
            backgroundSize: type === "DataField" ? "44px 44px" : "64px 64px",
            transform: `translate(${-(gridShift % 64)}px, ${-(gridShift % 64)}px)`,
          }}
        />
      ) : null}

      {type === "Mesh" || type === "AbstractFlow" ? (
        <>
          {directorType === "Timeline" ? (
            <>
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  style={{
                    position: "absolute",
                    left: 120 + index * 360,
                    top: 176 + index * 72,
                    width: 270,
                    height: 2,
                    background: index % 2 === 0 ? theme.primary : theme.secondary,
                    opacity: 0.1 + reveal * 0.16,
                    transform: `translateX(${drift * 28}px)`,
                  }}
                />
              ))}
            </>
          ) : directorType === "SystemMap" ? (
            <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, opacity: theme.isDark ? 0.22 : 0.16 }}>
              {[0, 1, 2, 3, 4].map((index) => {
                const x1 = 260 + index * 280;
                const y1 = 190 + (index % 2) * 190;
                const x2 = 520 + index * 250;
                const y2 = 620 - (index % 2) * 170;
                return <path key={index} d={`M ${x1} ${y1} C ${x1 + 170} ${y1 + 70}, ${x2 - 120} ${y2 - 90}, ${x2} ${y2}`} fill="none" stroke={index % 2 === 0 ? theme.primary : theme.secondary} strokeWidth="3" strokeDasharray="12 18" strokeLinecap="round" />;
              })}
            </svg>
          ) : directorType === "Contrast" ? (
            <>
              <div style={{ position: "absolute", left: -80, top: 0, width: 960, height: 1080, background: `linear-gradient(135deg, ${theme.panel}88, ${theme.primary}10)`, clipPath: "polygon(0 0, 86% 0, 66% 100%, 0 100%)" }} />
              <div style={{ position: "absolute", right: -80, top: 0, width: 960, height: 1080, background: `linear-gradient(225deg, ${theme.panel}76, ${theme.warning}12)`, clipPath: "polygon(34% 0, 100% 0, 100% 100%, 14% 100%)" }} />
            </>
          ) : (
            <div
              style={{
                position: "absolute",
                width: directorType === "Summary" ? 720 : 900,
                height: directorType === "Summary" ? 720 : 460,
                right: directorType === "Summary" ? 600 : -180,
                top: directorType === "Summary" ? 120 : -120,
                borderRadius: directorType === "Summary" ? 80 : 999,
                background: `radial-gradient(circle, ${accent}26 0%, ${accent}0f 46%, transparent 72%)`,
                opacity: directorType === "Summary" ? 0.58 : 1,
                transform: `rotate(${emotional ? -8 : -10}deg) translate(${drift * 12}px, ${drift * 8}px)`,
              }}
            />
          )}
        </>
      ) : null}

      {type === "DataField" ? (
        <>
          {[0, 1, 2, 3, 4].map((lineIndex) => {
            const y = 190 + lineIndex * 118;
            const progress = Math.min(1, reveal * (1.15 - lineIndex * 0.04));
            return (
              <div
                key={lineIndex}
                style={{
                  position: "absolute",
                  left: 220,
                  top: y,
                  width: 1180 * progress,
                  height: lineIndex % 2 === 0 ? 5 : 3,
                  borderRadius: 999,
                  background: lineIndex % 2 === 0 ? accent : theme.secondary,
                  opacity: 0.11 + lineIndex * 0.02,
                }}
              />
            );
          })}
        </>
      ) : null}

      {type === "Flat" ? (
        <div
          style={{
            position: "absolute",
            left: 130,
            right: 130,
            top: 120,
            height: 1,
            background: theme.line,
            opacity: 0.78,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const KineticHeadline = ({ text, theme, max = 25, size = 76 }: { text: string; theme: Theme; max?: number; size?: number }) => {
  const frame = useCurrentFrame();
  const words = getMainLine(text, max).split(/(?<=，)|(?<=、)|\s+/).filter(Boolean);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 18px", alignItems: "baseline" }}>
      {words.map((word, index) => {
        const local = frame - index * 5;
        const s = spring({ frame: local, fps: 30, config: { damping: 16, stiffness: 130 } });
        const opacity = fade(local, 0, 10);
        const y = interpolate(s, [0, 1], [34 * theme.motion, 0], { extrapolateRight: "clamp" });
        const isStrong = /\d|亿|美金|WLFI|meme|IP/i.test(word);

        return (
          <span
            key={`${word}-${index}`}
            style={{
              opacity,
              transform: `translateY(${y}px) scale(${0.94 + s * 0.06})`,
              color: isStrong ? theme.primary : theme.ink,
              fontSize: isStrong ? size + (theme.motion > 1 ? 14 : 8) : size,
              lineHeight: 1.04,
              fontWeight: theme.titleWeight,
              letterSpacing: 0,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

const splitCaptionChunks = (text: string, maxChars = 24) => {
  const source = text.replace(/\s+/g, " ").trim();
  if (!source) return [];

  const sentences = source
    .split(/(?<=[。！？!?；;])/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];

  for (const sentence of sentences.length ? sentences : [source]) {
    let rest = sentence;
    while (rest.length > maxChars) {
      const windowText = rest.slice(0, maxChars + 1);
      const punctuationBreak = Math.max(windowText.lastIndexOf("，"), windowText.lastIndexOf("、"), windowText.lastIndexOf(","));
      const spaceBreak = windowText.lastIndexOf(" ");
      const breakAt = punctuationBreak >= 10 ? punctuationBreak : spaceBreak;
      const cut = breakAt >= 10 ? breakAt + 1 : maxChars;
      const chunk = rest.slice(0, cut).trim();
      if (chunk) chunks.push(chunk);
      rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push(rest);
  }

  return chunks.filter(Boolean).length ? chunks.filter(Boolean) : [source];
};

const getActiveCaption = (scenes: Scene[], currentSeconds: number, captions?: CaptionLine[]) => {
  const activeCaption = captions?.find((caption) => currentSeconds >= caption.start && currentSeconds < caption.end);
  if (activeCaption) return activeCaption.text.replace(/\s+/g, " ").trim();

  if (captions && captions.length > 0) return "";

  const activeScene =
    scenes.find((scene) => currentSeconds >= scene.start && currentSeconds < scene.end) ??
    scenes.find((scene) => currentSeconds < scene.end) ??
    scenes[scenes.length - 1];

  if (!activeScene) return "";
  return activeScene.subtitle.replace(/\s+/g, " ").trim();
};

const GlobalCaptionLayer = ({ scenes, captions, theme }: { scenes: Scene[]; captions?: CaptionLine[]; theme: Theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentSeconds = frame / fps;
  const text = getActiveCaption(scenes, currentSeconds, captions).trim();
  const opacity = text ? 1 : 0;
  const isPortrait = height > width;
  const baseWidth = isPortrait ? 1080 : 1920;
  const baseHeight = isPortrait ? 1920 : 1080;
  const stageScale = Math.min(width / baseWidth, height / baseHeight);
  const stageLeft = (width - baseWidth * stageScale) / 2;
  const stageTop = (height - baseHeight * stageScale) / 2;
  const boxWidth = isPortrait ? 900 : 1480;
  const captionBottom = isPortrait ? 230 : 166;
  const fontSize = isPortrait
    ? theme.isDark
      ? fitChineseText(text, 43, 36, 24)
      : fitChineseText(text, 46, 38, 25)
    : theme.isDark
      ? fitChineseText(text, 34, 29, 18)
      : fitChineseText(text, 38, 32, 20);

  if (!text) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: stageLeft + (baseWidth * stageScale - boxWidth * stageScale) / 2,
        top: stageTop + (baseHeight - captionBottom) * stageScale,
        width: boxWidth,
        minHeight: isPortrait ? 126 : theme.isDark ? 96 : 112,
        opacity,
        transform: `scale(${stageScale})`,
        transformOrigin: "top left",
        padding: theme.isDark ? "14px 36px" : "18px 44px",
        borderRadius: 14,
        background: "transparent",
        border: "1px solid transparent",
        color: theme.ink,
        fontSize,
        lineHeight: theme.isDark ? 1.18 : 1.2,
        textAlign: "center",
        fontWeight: theme.captionWeight,
        boxShadow: "none",
        textShadow: theme.isDark
          ? "0 3px 18px rgba(0,0,0,0.72), 0 1px 2px rgba(0,0,0,0.9)"
          : "0 2px 0 rgba(255,255,255,0.92), 0 8px 24px rgba(255,255,255,0.82), 0 1px 2px rgba(15,23,42,0.16)",
        whiteSpace: "normal",
        wordBreak: "keep-all",
        overflowWrap: "break-word",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {text}
    </div>
  );
};

const MetricOrb = ({ metric, accent = blue, theme }: { metric: string; accent?: string; theme: Theme }) => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: 30, config: { damping: 18, stiffness: 110 } });

  return (
    <div style={{ position: "relative", width: 520, height: 520, display: "grid", placeItems: "center" }}>
      {[0, 1, 2].map((ring) => (
        <div
          key={ring}
          style={{
            position: "absolute",
            inset: 40 + ring * 46,
            borderRadius: "50%",
            border: `${ring === 0 ? 6 : 3}px solid ${ring === 0 ? `${accent}44` : theme.line}`,
            borderTopColor: ring === 1 ? theme.secondary : accent,
            borderRightColor: ring === 2 ? theme.warning : undefined,
            transform: `rotate(${ring % 2 === 0 ? 8 : -8}deg) scale(${0.82 + s * 0.18})`,
            opacity: 0.95 - ring * 0.18,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 132,
          borderRadius: theme.radius * 3.5,
          background: theme.panel,
          border: `1px solid ${theme.line}`,
          boxShadow: theme.shadow,
          transform: `scale(${0.86 + s * 0.14})`,
        }}
      />
      <div style={{ position: "relative", textAlign: "center", transform: `scale(${0.88 + s * 0.12})` }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: theme.muted, marginBottom: 10 }}>TOTAL</div>
        <div style={{ fontSize: 86, fontWeight: 950, color: accent, lineHeight: 0.96 }}>{metric}</div>
        <div style={{ marginTop: 14, fontSize: 25, fontWeight: 800, color: theme.ink }}>核心数据</div>
      </div>
    </div>
  );
};

const FastImpactFrame = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const explicitMetric = scene.emphasis?.find((value) => /\d/.test(value)) ?? scene.subtitle.match(metricPattern)?.[0];
  const metric = explicitMetric ? explicitMetric.replace(/\s+/g, "") : visualPhrase(scene, "高能点", 6);
  const keyword = visualPhrase(scene, "反常信号", 8);
  const flash = interpolate(frame, [0, 4, 11, 22], [0.82, 0.1, 0.44, 0], { extrapolateRight: "clamp" });
  const slam = spring({ frame: frame - 4, fps: 30, config: { damping: 12, stiffness: 210 } });
  const bars = visualKeywords(scene, [metric, "反常", "影响力"], 3);

  return (
    <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${theme.primary} 0 34%, transparent 34% 100%)`, opacity: 0.12 }} />
      <div style={{ position: "absolute", right: -90, top: 56, width: 620, height: 620, borderRadius: 999, border: `42px solid ${theme.warning}22`, transform: "rotate(18deg)" }} />
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />
      <div style={{ position: "absolute", left: 22, top: 40, right: 22, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 50, alignItems: "center", height: "78%" }}>
        <div>
          <div style={{ display: "inline-flex", padding: "12px 18px", background: theme.ink, color: "#fff", fontSize: 26, fontWeight: 950, marginBottom: 24 }}>
            FAST CUT
          </div>
          <div
            style={{
              color: theme.ink,
              fontSize: fitChineseText(keyword, 132, 20, 74),
              lineHeight: 0.92,
              fontWeight: 980,
              transform: `translateX(${interpolate(slam, [0, 1], [-80, 0], { extrapolateRight: "clamp" })}px) scale(${0.82 + slam * 0.18})`,
            }}
          >
            {keyword}
          </div>
          <div style={{ marginTop: 30, height: 18, width: 520, background: theme.gradient }} />
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ padding: "34px 38px", background: theme.primary, color: "#fff", transform: `rotate(-2deg) scale(${0.9 + slam * 0.1})` }}>
            <div style={{ fontSize: 26, fontWeight: 900, opacity: 0.82 }}>核心数字</div>
            <div style={{ marginTop: 10, fontSize: 92, fontWeight: 980, lineHeight: 0.9 }}>{metric}</div>
          </div>
          {bars.map((item, index) => (
            <div
              key={`${item}-${index}`}
              style={{
                marginLeft: index * 34,
                padding: "18px 24px",
                background: index % 2 === 0 ? theme.warning : theme.ink,
                color: "#fff",
                fontSize: 34,
                fontWeight: 950,
                transform: `translateX(${slide(frame, 9 + index * 5, 22 + index * 5, 90) * -1}px)`,
              }}
            >
              {clampText(item, 9)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const HeroMetricFrame = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const metric = getMetric(scene);
  const textOpacity = fade(frame, 12, 26);
  const y = slide(frame, 12, 34, 30);
  const hook = visualPhrase(scene, "核心爆点");
  const kicker = scene.visualBrief?.kicker ?? "产品发布";
  const subhead = scene.visualBrief?.subhead ?? "";
  const explanations = explanationLines(scene, ["先看产品定位", "再看市场反馈", "最后看交付验证"], 3);
  const definitionTitle = /Hy3|混元/.test(scene.subtitle) ? "Hy3 怎么理解" : /优必选|U1|仿生机器人/.test(scene.subtitle) ? "U1 怎么理解" : "画面补充解释";

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "0.95fr 0.92fr",
        alignItems: "center",
        gap: 48,
      }}
    >
      <div style={{ transform: `translateY(${y}px)`, opacity: textOpacity }}>
        <div style={{ color: theme.primary, fontSize: 28, fontWeight: 900, marginBottom: 22 }}>{kicker}</div>
        <div style={{ color: theme.ink, fontSize: 82, lineHeight: 1.02, fontWeight: theme.titleWeight, letterSpacing: 0 }}>
          {hook}
        </div>
        {subhead ? <div style={{ marginTop: 22, color: theme.muted, fontSize: 32, lineHeight: 1.24, fontWeight: 780 }}>{subhead}</div> : null}
        <div style={{ marginTop: 34 }}>
          <KeywordPills scene={scene} theme={theme} fallback={briefTags(scene, [metric, "产品", "升级"])} />
        </div>
      </div>
      <div style={{ display: "grid", gap: 24 }}>
        <MetricOrb metric={metric} accent={theme.primary} theme={theme} />
        <DefinitionCard
          title={definitionTitle}
          lines={explanations}
          theme={theme}
          delay={22}
        />
      </div>
    </div>
  );
};

const DataCard = ({
  label,
  value,
  color,
  index,
  theme,
  scene,
}: {
  label: string;
  value: string;
  color: string;
  index: number;
  theme: Theme;
  scene?: Scene;
}) => {
  const frame = useCurrentFrame();
  const local = frame - 14 - index * 9;
  const s = spring({ frame: local, fps: 30, config: { damping: 17, stiffness: 120 } });
  const opacity = fade(local, 0, 10);
  const bar = interpolate(local, [4, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const dataAnimation = scene?.animation?.dataAnimation;
  const valueReveal = dataAnimation === "kineticCounter" ? 0.96 + fade(local, 4, 24) * 0.04 : 1;
  const fill = dataAnimation === "liquidFill" ? interpolate(local, [8, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }) : 0;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${interpolate(s, [0, 1], [34, 0], { extrapolateRight: "clamp" })}px)`,
        background: theme.panel,
        border: `1px solid ${theme.line}`,
        borderRadius: theme.radius,
        padding: 28,
        boxShadow: theme.shadow,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {fill ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${fill * 100}%`,
            background: `${color}10`,
          }}
        />
      ) : null}
      {dataAnimation === "particleFormation" ? (
        <div style={{ position: "absolute", right: 22, top: 20, display: "grid", gridTemplateColumns: "repeat(4, 8px)", gap: 7 }}>
          {Array.from({ length: 16 }).map((_, dot) => (
            <span
              key={dot}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: color,
                opacity: fade(local - dot * 1.2, 0, 12) * 0.62,
                transform: `scale(${0.6 + fade(local - dot * 1.2, 0, 12) * 0.4})`,
              }}
            />
          ))}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ color: theme.muted, fontSize: 26, fontWeight: 850 }}>{label}</div>
        <div style={{ color, fontSize: 42, fontWeight: 950, transform: `scale(${valueReveal})`, transformOrigin: "right center" }}>{value}</div>
      </div>
      <div style={{ height: 10, background: theme.isDark ? "#1e293b" : "#edf2f8", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${bar * (72 + index * 8)}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
};

const DarkDataBoardFrame = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const metric = getMetric(scene);
  const keywords = visualKeywords(scene, [metric, "资金", "风险", "链路"], 4);
  const draw = interpolate(frame, [16, 58], [0, 1], { extrapolateRight: "clamp", easing: ease });
  const bars = keywords.map((_, index) => 42 + ((index + 2) * 17) % 44);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 42, alignItems: "stretch", transform: cameraTransform(frame, "data-dolly", scene.pace) }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ color: theme.accent, fontSize: 26, fontWeight: 950, marginBottom: 22 }}>DATA ROOM</div>
        <div style={{ color: theme.ink, fontSize: 76, lineHeight: 1.02, fontWeight: theme.titleWeight }}>指标面板</div>
        <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {keywords.map((keyword, index) => (
            <div
              key={`${keyword}-${index}`}
              style={{
                minHeight: 118,
                padding: 20,
                borderRadius: 8,
                background: "rgba(15,23,42,0.74)",
                border: `1px solid ${getAccent(index, theme)}66`,
                boxShadow: `0 20px 58px ${getAccent(index, theme)}18`,
              }}
            >
              <div style={{ color: getAccent(index, theme), fontSize: 24, fontWeight: 950 }}>0{index + 1}</div>
              <div style={{ marginTop: 16, color: theme.ink, fontSize: 31, lineHeight: 1.08, fontWeight: 900 }}>{clampText(keyword, 8)}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "relative", borderRadius: 10, background: "rgba(2,6,23,0.72)", border: `1px solid ${theme.line}`, overflow: "hidden", padding: 34 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 26 }}>
          {["资金强度", "舆论热度", "风险指数"].map((label, index) => (
            <div key={label} style={{ padding: 18, borderRadius: 8, background: "rgba(15,23,42,0.84)", border: `1px solid ${getAccent(index, theme)}44` }}>
              <div style={{ color: theme.muted, fontSize: 21, fontWeight: 850 }}>{label}</div>
              <div style={{ marginTop: 8, color: getAccent(index, theme), fontSize: 42, fontWeight: 960 }}>{index === 0 ? metric : `${68 + index * 11}%`}</div>
            </div>
          ))}
        </div>
        <div style={{ position: "relative", height: 430, borderRadius: 8, background: "linear-gradient(180deg, rgba(15,23,42,0.72), rgba(15,23,42,0.36))", border: `1px solid ${theme.line}` }}>
          <svg width="100%" height="100%" viewBox="0 0 820 430" style={{ position: "absolute", inset: 0 }}>
            {[80, 160, 240, 320].map((y) => (
              <line key={y} x1="34" x2="790" y1={y} y2={y} stroke={theme.line} strokeWidth="1" opacity="0.45" />
            ))}
            <path
              d="M52 330 C170 250 214 285 318 190 C430 88 510 230 610 150 C690 92 728 120 776 70"
              fill="none"
              stroke={theme.primary}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="1200"
              strokeDashoffset={1200 - draw * 1200}
            />
            <path
              d="M52 352 C170 335 232 260 330 286 C470 326 534 210 626 236 C704 260 742 190 776 210"
              fill="none"
              stroke={theme.accent}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="1200"
              strokeDashoffset={1200 - draw * 1200}
              opacity="0.72"
            />
          </svg>
          <div style={{ position: "absolute", left: 42, right: 42, bottom: 26, display: "grid", gridTemplateColumns: `repeat(${bars.length}, 1fr)`, gap: 18, alignItems: "end", height: 180 }}>
            {bars.map((height, index) => (
              <div key={index} style={{ height: `${height * draw}%`, borderRadius: "8px 8px 0 0", background: getAccent(index, theme), opacity: 0.82 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DataPanelFrame = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const metric = getMetric(scene);
  const cards = scene.visualBrief?.metricCards?.length
    ? scene.visualBrief.metricCards
    : (scene.emphasis?.length ? scene.emphasis : [metric, "关键指标", "业务表现"]).map((value, index) => ({
        label: index === 0 ? "核心指标" : index === 1 ? "补充指标" : "相关线索",
        value,
      }));
  const keywords = briefTags(scene, visualKeywords(scene, [metric, "能力", "成本"], 3), 4);
  const headline = scene.visualBrief?.headline ?? "数据拆解";
  const kicker = scene.visualBrief?.kicker ?? "数据拆解";
  const headlineSize = fitChineseText(headline, 74, 21, 40);

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "0.95fr 1.05fr",
        alignItems: "center",
        gap: 52,
        paddingLeft: scene.directorType ? 28 : 0,
        paddingRight: scene.directorType ? 18 : 0,
        transform: scene.directorType ? undefined : cameraTransform(frame, scene.motionVariant, scene.pace),
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: theme.secondary, fontSize: 28, fontWeight: 900, marginBottom: 22 }}>{kicker}</div>
        <div style={{ color: theme.ink, fontSize: headlineSize, lineHeight: 1.04, fontWeight: theme.titleWeight, letterSpacing: 0 }}>
          {headline}
        </div>
        <div style={{ marginTop: 32 }}>
          <KeywordPills scene={scene} theme={theme} fallback={keywords} />
        </div>
      </div>
      <div style={{ display: "grid", gap: 22 }}>
        {cards.slice(0, 4).map((card, index) => (
          <DataCard
            key={`${card.label}-${card.value}-${index}`}
            label={card.label}
            value={card.value}
            color={getAccent(index, theme)}
            index={index}
            theme={theme}
            scene={scene}
          />
        ))}
      </div>
    </div>
  );
};

const PricingFrame = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const metrics = scene.visualBrief?.metricCards?.length
    ? scene.visualBrief.metricCards
    : (scene.content?.metrics?.length ? scene.content.metrics : []).map((item) => ({ label: item.label, value: item.value, note: item.note }));
  const fallback = scene.emphasis?.filter((item) => /\d/.test(item)).slice(0, 3) ?? [];
  const cards = metrics.length
    ? metrics.slice(0, 3)
    : [
        { label: "输入成本", value: fallback[0] ?? "1元", note: "百万 tokens" },
        { label: "输出成本", value: fallback[1] ?? "4元", note: "百万 tokens" },
        { label: "缓存命中", value: fallback[2] ?? "0.25元", note: "百万 tokens" },
      ];
  const headline = scene.visualBrief?.headline ?? "价格冲击";
  const sweep = interpolate(frame, [18, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 42 }}>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 40 }}>
        <div>
          <div style={{ color: theme.secondary, fontSize: 28, fontWeight: 950, marginBottom: 18 }}>PRICING</div>
          <div style={{ color: theme.ink, fontSize: 78, lineHeight: 1.02, fontWeight: theme.titleWeight }}>{headline}</div>
        </div>
        <div style={{ width: 320, height: 10, borderRadius: 999, background: theme.line, overflow: "hidden" }}>
          <div style={{ width: `${sweep * 100}%`, height: "100%", background: theme.gradient, borderRadius: 999 }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cards.length}, 1fr)`, gap: 26, alignItems: "stretch" }}>
        {cards.map((card, index) => {
          const local = frame - 12 - index * 8;
          const s = spring({ frame: local, fps: 30, config: { damping: 15, stiffness: 150 } });
          const color = index === 0 ? theme.primary : index === 1 ? theme.secondary : theme.warning;
          return (
            <div
              key={`${card.label}-${index}`}
              style={{
                opacity: fade(local, 0, 12),
                transform: `translateY(${interpolate(s, [0, 1], [56, 0], { extrapolateRight: "clamp" })}px) scale(${0.88 + s * 0.12})`,
                borderRadius: theme.radius,
                background: index === 1 ? theme.ink : theme.panel,
                color: index === 1 ? "#fff" : theme.ink,
                border: `1px solid ${color}55`,
                boxShadow: `0 32px 90px ${color}22`,
                padding: "46px 40px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", right: -90, top: -90, width: 260, height: 260, borderRadius: 999, background: `${color}20` }} />
              <div style={{ color: index === 1 ? "#dbeafe" : color, fontSize: 30, fontWeight: 950 }}>{card.label}</div>
              <div style={{ marginTop: 54, color: index === 1 ? "#fff" : color, fontSize: fitChineseText(card.value, 92, 28, 18), lineHeight: 0.94, fontWeight: 980 }}>
                {card.value}
              </div>
              <div style={{ marginTop: 26, color: index === 1 ? "rgba(255,255,255,0.72)" : theme.muted, fontSize: 27, fontWeight: 820 }}>
                {card.note ?? "调用成本"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RelationMapFrame = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const fallbackNodes = graphNodesFromScene(scene).slice(0, 6);
  const graph = buildSceneGraph(scene, fallbackNodes);
  const labels = graph.nodes.map((node) => node.label).slice(0, 5);
  const relationKeywords = briefTags(scene, labels).slice(0, 4);
  const headline = scene.visualBrief?.headline ?? "关系图谱";
  const kicker = scene.visualBrief?.kicker ?? "关系路径";
  const headlineSize = fitChineseText(headline, 66, 28, 40);
  const explanations = explanationLines(scene, ["中心模型", "业务接入", "真实调用验证"], 3);

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "0.82fr 1.18fr",
        alignItems: "center",
        gap: 46,
      }}
    >
      <div style={{ display: "grid", gap: 28 }}>
        <div>
          <div style={{ color: theme.warning, fontSize: 28, fontWeight: 900, marginBottom: 22 }}>{kicker}</div>
          <div style={{ color: theme.ink, fontSize: headlineSize, lineHeight: 1.05, fontWeight: theme.titleWeight, letterSpacing: 0 }}>
            {headline}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {relationKeywords.map((keyword, index) => {
            const local = frame - 10 - index * 6;
            const enter = entranceTransform({ frame: local, fps: 30, variant: "card-stack", pace: scene.pace });

            return (
              <div
                key={`${keyword}-${index}`}
                style={{
                  ...enter,
                  minHeight: 118,
                  borderRadius: theme.radius,
                  background: theme.panel,
                  border: `1px solid ${getAccent(index, theme)}55`,
                  boxShadow: theme.shadow,
                  padding: "20px 22px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 999, background: getAccent(index, theme) }} />
                <div style={{ color: theme.ink, fontSize: 29, lineHeight: 1.08, fontWeight: 930 }}>{clampText(keyword, 8)}</div>
              </div>
            );
          })}
        </div>
        <ExplanationStack lines={explanations} theme={theme} delay={28} />
      </div>
      <div style={{ position: "relative", height: 670, background: theme.isDark ? "rgba(15,23,42,0.64)" : "rgba(255,255,255,0.64)", border: `1px solid ${theme.line}`, borderRadius: theme.radius, overflow: "hidden", padding: 22 }}>
        <NodeGraph
          nodes={graph.nodes}
          edges={graph.edges}
          theme={toVisualTheme(theme)}
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
};

const EvidenceImage = ({ image, index, total, theme }: { image: string; index: number; total: number; theme: Theme }) => {
  const frame = useCurrentFrame();
  const local = frame - index * 8;
  const scale = interpolate(local, [0, 130], [1.04, 1.18], { extrapolateRight: "clamp", easing: ease });
  const opacity = fade(local, 0, 18);
  const cropY = total > 1 ? "50%" : index % 2 === 0 ? "42%" : "56%";
  const highlight = fade(local, 20, 42);

  return (
    <div
      style={{
        position: "relative",
        height: total > 1 ? 292 : 620,
        overflow: "hidden",
        borderRadius: theme.radius,
        background: theme.panel,
        border: `1px solid ${theme.line}`,
        boxShadow: theme.shadow,
        opacity,
      }}
    >
      <Img
        src={staticFile(image)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: total > 1 ? "cover" : "contain",
          objectPosition: `50% ${cropY}`,
          transform: `scale(${scale})`,
          filter: theme.filter,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: total > 1 ? "14%" : "18%",
          top: total > 1 ? "24%" : "20%",
          width: total > 1 ? "62%" : "56%",
          height: total > 1 ? "38%" : "34%",
          border: `7px solid ${index % 2 === 0 ? theme.warning : theme.primary}`,
          borderRadius: theme.radius,
          boxShadow: `0 0 0 999px ${theme.isDark ? "rgba(15,23,42,0.34)" : "rgba(248,250,252,0.28)"}`,
          opacity: highlight,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 22,
          bottom: 22,
          padding: "10px 16px",
          borderRadius: theme.radius,
          color: "#fff",
          background: index % 2 === 0 ? theme.warning : theme.primary,
          fontSize: 23,
          fontWeight: 900,
        }}
      >
        evidence 0{index + 1}
      </div>
    </div>
  );
};

const EvidenceFrame = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.78fr 1.22fr", alignItems: "center", gap: 46, transform: cameraTransform(frame, scene.motionVariant, scene.pace) }}>
      <div>
        <div style={{ color: theme.primary, fontSize: 28, fontWeight: 900, marginBottom: 22 }}>素材证据</div>
        <div style={{ color: theme.ink, fontSize: 72, lineHeight: 1.02, fontWeight: theme.titleWeight, letterSpacing: 0 }}>
          证据放大
          <br />
          重点标注
        </div>
        <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}>
          {visualKeywords(scene, ["证据", "来源", "重点"], 4).map((value, index) => (
            <div
              key={`${value}-${index}`}
              style={{
                borderRadius: theme.radius,
                background: theme.isDark ? "rgba(15,23,42,0.66)" : `${getAccent(index, theme)}16`,
                color: getAccent(index, theme),
                border: `1px solid ${getAccent(index, theme)}44`,
                padding: "10px 15px",
                fontSize: 26,
                fontWeight: 900,
              }}
            >
              {value}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gap: 24 }}>
        {scene.images.map((image, index) => (
          <EvidenceImage key={`${image}-${index}`} image={image} index={index} total={scene.images.length} theme={theme} />
        ))}
      </div>
    </div>
  );
};

const GeneratedConceptFrame = ({
  scene,
  theme,
  concept,
}: {
  scene: Scene;
  theme: Theme;
  concept: RenderableGeneratedConceptVisual;
}) => {
  const frame = useCurrentFrame();
  const image = concept.runtimeImage;
  const keywords = visualKeywords(scene, ["推理成本", "算力控制", "供应约束"], 3);
  const label = (
    <div
      style={{
        position: "absolute",
        left: 24,
        top: 22,
        padding: "9px 14px",
        background: "rgba(17,24,39,0.78)",
        color: "#fff",
        fontSize: 22,
        fontWeight: 900,
        borderRadius: 4,
        zIndex: 4,
      }}
    >
      概念示意
    </div>
  );

  if (concept.treatment === "foreground-subject-plus-motion-graphics") {
    const reveal = interpolate(frame, [8, 32], [0, 1], { extrapolateRight: "clamp", easing: ease });
    return (
      <div style={{ position: "relative", height: "100%", display: "grid", gridTemplateColumns: "1.32fr 0.68fr", gap: 26 }}>
        <div style={{ position: "relative", overflow: "hidden", background: theme.panel, border: `1px solid ${theme.line}`, boxShadow: theme.shadow }}>
          <Img
            src={staticFile(image)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "42% 50%",
              transform: `scale(${interpolate(frame, [0, 170], [1.05, 1.13], { extrapolateRight: "clamp", easing: ease })})`,
              filter: theme.filter,
            }}
          />
          {label}
        </div>
        <div style={{ display: "grid", alignContent: "center", gap: 18 }}>
          {keywords.map((keyword, index) => (
            <div
              key={`${keyword}-${index}`}
              style={{
                position: "relative",
                minHeight: 106,
                display: "flex",
                alignItems: "center",
                padding: "20px 24px 20px 32px",
                background: theme.panel,
                border: `1px solid ${theme.line}`,
                boxShadow: theme.shadow,
                color: theme.ink,
                fontSize: 30,
                lineHeight: 1.15,
                fontWeight: 900,
                opacity: interpolate(frame, [14 + index * 9, 30 + index * 9], [0, 1], { extrapolateRight: "clamp" }),
                transform: `translateX(${(1 - reveal) * (34 + index * 9)}px)`,
              }}
            >
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: getAccent(index, theme) }} />
              {clampText(keyword, 12)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (concept.treatment === "partial-crop-beside-real-evidence") {
    const factReveal = interpolate(frame, [12, 38], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    });
    return (
      <div style={{ position: "relative", height: "100%", display: "grid", gridTemplateColumns: "1.14fr 0.86fr", gap: 28 }}>
        <div style={{ position: "relative", overflow: "hidden", background: theme.panel, border: `1px solid ${theme.line}`, boxShadow: theme.shadow }}>
          <Img
            src={staticFile(image)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "36% 50%",
              transform: `scale(${interpolate(frame, [0, 170], [1.03, 1.1], { extrapolateRight: "clamp", easing: ease })})`,
              filter: theme.filter,
            }}
          />
          {label}
        </div>
        <div
          style={{
            position: "relative",
            display: "grid",
            alignContent: "center",
            gap: 24,
            padding: "48px 44px",
            overflow: "hidden",
            background: theme.panel,
            border: `1px solid ${theme.line}`,
            boxShadow: theme.shadow,
            opacity: factReveal,
            transform: `translateX(${(1 - factReveal) * 28}px)`,
          }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 9, background: theme.primary }} />
          <div style={{ color: theme.primary, fontSize: 23, fontWeight: 900 }}>
            事实口径
          </div>
          <div style={{ color: theme.ink, fontSize: 31, lineHeight: 1.48, fontWeight: 850 }}>
            {clampText(concept.factLabel ?? "", 88)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {keywords.slice(0, 2).map((keyword, index) => (
              <div
                key={`${keyword}-${index}`}
                style={{
                  padding: "9px 13px",
                  background: `${getAccent(index, theme)}18`,
                  color: getAccent(index, theme),
                  fontSize: 21,
                  fontWeight: 850,
                }}
              >
                {clampText(keyword, 10)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (concept.treatment === "layered-parallax") {
    const foregroundX = interpolate(frame, [0, 170], [-12, 22], { extrapolateRight: "clamp", easing: ease });
    return (
      <div style={{ position: "relative", height: "100%", overflow: "hidden", background: theme.panel, boxShadow: theme.shadow }}>
        <Img
          src={staticFile(image)}
          style={{
            position: "absolute",
            inset: -34,
            width: "calc(100% + 68px)",
            height: "calc(100% + 68px)",
            objectFit: "cover",
            transform: `scale(${interpolate(frame, [0, 170], [1.02, 1.09], { extrapolateRight: "clamp", easing: ease })})`,
            filter: `${theme.filter} blur(10px)`,
            opacity: 0.34,
          }}
        />
        <Img
          src={staticFile(image)}
          style={{
            position: "absolute",
            left: "4%",
            top: "3%",
            width: "92%",
            height: "94%",
            objectFit: "contain",
            transform: `translateX(${foregroundX}px) scale(${interpolate(frame, [0, 170], [1, 1.045], { extrapolateRight: "clamp", easing: ease })})`,
            filter: theme.filter,
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent 52%, ${theme.paper}88 100%)` }} />
        {label}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", background: theme.panel, boxShadow: theme.shadow }}>
      <Img
        src={staticFile(image)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${interpolate(frame, [0, 170], [1.04, 1.12], { extrapolateRight: "clamp", easing: ease })})`,
          filter: theme.filter,
        }}
      />
      {label}
    </div>
  );
};

const OrdinaryPrimaryVisualFrame = ({
  scene,
  theme,
  visual,
}: {
  scene: Scene;
  theme: Theme;
  visual: Extract<ScenePrimaryVisual, { sourceKind: "ordinary" }>;
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 150], [0, 1], {
    extrapolateRight: "clamp",
    easing: ease,
  });
  const insights = visualKeywords(scene, ["来源证据", "关键事实", "事件影响"], 3);
  const useSplit =
    scene.layout === "split-image" ||
    scene.evidenceTreatment === "split" ||
    scene.visualTreatment === "evidence-annotated";

  if (useSplit) {
    return (
      <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1.24fr 0.76fr", gap: 30 }}>
        <div style={{ position: "relative", overflow: "hidden", background: theme.panel, border: `1px solid ${theme.line}`, boxShadow: theme.shadow }}>
          <Img
            src={staticFile(visual.runtimeImage)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${1.04 + progress * 0.06}) translateX(${progress * -1.2}%)`,
              filter: theme.filter,
            }}
          />
        </div>
        <div style={{ display: "grid", alignContent: "center", gap: 18 }}>
          {insights.map((item, index) => (
            <div
              key={`${item}-${index}`}
              style={{
                padding: "22px 24px",
                borderLeft: `7px solid ${getAccent(index, theme)}`,
                background: theme.panel,
                borderTop: `1px solid ${theme.line}`,
                borderRight: `1px solid ${theme.line}`,
                borderBottom: `1px solid ${theme.line}`,
                boxShadow: theme.shadow,
                color: theme.ink,
                fontSize: 30,
                lineHeight: 1.16,
                fontWeight: 900,
                opacity: fade(frame, 10 + index * 8, 28 + index * 8),
                transform: `translateX(${interpolate(frame, [8 + index * 8, 28 + index * 8], [34, 0], { extrapolateRight: "clamp", easing: ease })}px)`,
              }}
            >
              {clampText(item, 14)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: theme.panel }}>
      <Img
        src={staticFile(visual.runtimeImage)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${1.06 + progress * 0.07})`,
          filter: theme.filter,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: theme.isDark
            ? "linear-gradient(90deg, rgba(2,6,23,0.7), rgba(2,6,23,0.08) 68%)"
            : "linear-gradient(90deg, rgba(248,250,252,0.92), rgba(248,250,252,0.08) 70%)",
        }}
      />
      <div style={{ position: "absolute", left: 72, top: 90, width: 540 }}>
        <div style={{ color: theme.ink, fontSize: 58, lineHeight: 1.04, fontWeight: theme.titleWeight }}>
          {clampText(scene.content?.headline ?? scene.visualBrief?.headline ?? getMainLine(scene.subtitle, 16), 18)}
        </div>
      </div>
    </div>
  );
};

const NewsDeskScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const keywords = visualKeywords(scene, ["事实", "结构", "评论"], 4);
  const wipe = interpolate(frame, [10, 34], [0, 1], { extrapolateRight: "clamp", easing: ease });

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "94px 1fr 96px", gap: 24, transform: cameraTransform(frame, "locked-column", scene.pace) }}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 18 }}>
        <div style={{ background: theme.primary, color: "#fff", display: "grid", placeItems: "center", fontSize: 32, fontWeight: 960, borderRadius: 4 }}>评论现场</div>
        <div style={{ background: theme.ink, color: "#fff", display: "flex", alignItems: "center", padding: "0 34px", fontSize: 34, fontWeight: 930, borderRadius: 4 }}>
          先确认事实，再判断影响
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 30 }}>
        <div style={{ position: "relative", background: theme.panel, border: `1px solid ${theme.line}`, boxShadow: theme.shadow, borderRadius: 6, padding: 42, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 16, background: theme.primary, transform: `scaleY(${wipe})`, transformOrigin: "top" }} />
          <div style={{ color: theme.primary, fontSize: 28, fontWeight: 950, marginBottom: 26 }}>MAIN TAKE</div>
          <div style={{ color: theme.ink, fontSize: 76, lineHeight: 1.03, fontWeight: theme.titleWeight }}>事件背景</div>
          <div style={{ marginTop: 38, display: "grid", gap: 16 }}>
            {keywords.slice(0, 3).map((keyword, index) => (
              <div key={`${keyword}-${index}`} style={{ display: "grid", gridTemplateColumns: "66px 1fr", alignItems: "center", gap: 18 }}>
                <div style={{ height: 54, background: index === 0 ? theme.primary : theme.ink, color: "#fff", display: "grid", placeItems: "center", fontSize: 24, fontWeight: 950 }}>0{index + 1}</div>
                <div style={{ padding: "14px 18px", borderBottom: `2px solid ${theme.line}`, color: theme.ink, fontSize: 34, fontWeight: 900 }}>{clampText(keyword, 10)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          {["SOURCE", "CONTEXT", "COMMENT"].map((label, index) => {
            const local = frame - 14 - index * 7;
            return (
              <div
                key={label}
                style={{
                  ...entranceTransform({ frame: local, fps: 30, variant: "column-wipe", pace: "medium" }),
                  padding: "28px 30px",
                  borderRadius: 6,
                  background: index === 1 ? theme.ink : theme.panel,
                  border: `1px solid ${index === 1 ? theme.ink : theme.line}`,
                  boxShadow: theme.shadow,
                }}
              >
                <div style={{ color: index === 1 ? "#fff" : theme.primary, fontSize: 24, fontWeight: 950 }}>{label}</div>
                <div style={{ marginTop: 18, color: index === 1 ? "#fff" : theme.ink, fontSize: 36, lineHeight: 1.1, fontWeight: 930 }}>
                  {clampText(keywords[index] ?? ["事实", "结构", "判断"][index], 8)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>
        <div style={{ background: theme.primary, color: "#fff", display: "grid", placeItems: "center", fontSize: 28, fontWeight: 950, borderRadius: 4 }}>BREAKING</div>
        <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, color: theme.muted, display: "flex", alignItems: "center", padding: "0 28px", fontSize: 28, fontWeight: 850, borderRadius: 4 }}>
          关键词：{keywords.map((item) => clampText(item, 7)).join(" / ")}
        </div>
      </div>
    </div>
  );
};

const NewsContextScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const local = entranceTransform({ frame, fps: 30, variant: scene.motionVariant, pace: scene.pace });
  const support = explanationLines(scene, briefTags(scene, visualKeywords(scene, ["事实", "结构", "判断"], 3), 3), 3);
  const headline = scene.visualBrief?.headline ?? "先看背景\n再看结构";

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "330px 1fr", gap: 48, alignItems: "stretch", ...local }}>
      <div
        style={{
          borderRadius: theme.radius,
          background: theme.isDark ? "rgba(15,23,42,0.72)" : "rgba(255,255,255,0.82)",
          border: `1px solid ${theme.line}`,
          boxShadow: theme.shadow,
          padding: 34,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ color: theme.primary, fontSize: 30, fontWeight: 950 }}>NEWS</div>
          <div style={{ marginTop: 12, color: theme.muted, fontSize: 24, fontWeight: 800 }}>{sceneEyebrow["news-context"]}</div>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {["事实", "结构", "判断"].map((label, index) => (
            <div key={label} style={{ padding: "14px 16px", borderRadius: theme.radius, background: `${getAccent(index, theme)}16`, color: getAccent(index, theme), fontSize: 25, fontWeight: 900 }}>
              {String(index + 1).padStart(2, "0")} {label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ color: theme.ink, fontSize: 78, lineHeight: 1.02, fontWeight: theme.titleWeight, letterSpacing: 0 }}>
          {headline}
        </div>
        <div style={{ marginTop: 36 }}>
          <ExplanationStack lines={support} theme={theme} delay={18} />
        </div>
      </div>
    </div>
  );
};

const RiskContrastScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const comparisons = scene.visualBrief?.comparisonCards ?? scene.content?.comparisons;
  const keywords = visualKeywords(scene, ["旧状态", "新结果", "变化", "影响"], 4);
  const left = clampText(comparisons?.[0]?.value ?? keywords[0] ?? "旧状态", 10);
  const right = clampText(comparisons?.[1]?.value ?? keywords[1] ?? "新结果", 10);
  const headline = scene.visualBrief?.headline ?? scene.content?.headline ?? "两面同时看";
  const lines = explanationLines(scene, ["表面是模型发布", "真正看点是基础设施重建", "后续要看真实业务验证"], 3);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 38 }}>
      <div>
        <div style={{ color: theme.warning, fontSize: 28, fontWeight: 950, marginBottom: 20 }}>{sceneEyebrow["risk-contrast"]}</div>
        <div style={{ color: theme.ink, fontSize: 76, lineHeight: 1.02, fontWeight: theme.titleWeight, letterSpacing: 0 }}>
          {headline}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34, alignItems: "stretch", transform: scene.directorType ? undefined : cameraTransform(frame, scene.motionVariant, scene.pace) }}>
        {[
          { label: "表面现象", value: left, color: theme.primary, notes: lines.slice(0, 2) },
          { label: "关键解释", value: right, color: theme.warning, notes: lines.slice(1, 3) },
        ].map((card, index) => {
          const local = frame - 10 - index * 8;
          const enter = entranceTransform({ frame: local, fps: 30, variant: index === 0 ? "column-wipe" : "warning-pulse", pace: index === 0 ? "medium" : "strong" });
          return (
            <div
              key={card.label}
              style={{
                ...enter,
                padding: 42,
                borderRadius: theme.radius,
                background: theme.panel,
                border: `2px solid ${card.color}44`,
                boxShadow: `0 28px 78px ${card.color}22`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", inset: "auto -80px -110px auto", width: 280, height: 280, borderRadius: 999, background: `${card.color}22` }} />
	              <div style={{ color: card.color, fontSize: 32, fontWeight: 950, marginBottom: 24 }}>{card.label}</div>
	              <div style={{ color: theme.ink, fontSize: fitChineseText(card.value, 64, 28, 42), lineHeight: 1.12, fontWeight: theme.titleWeight }}>
	                {card.value}
	              </div>
              <div style={{ marginTop: 42, display: "grid", gap: 14 }}>
                {card.notes.map((note, noteIndex) => {
                  const noteLocal = local - 14 - noteIndex * 7;
                  return (
                    <div
                      key={`${note}-${noteIndex}`}
                      style={{
                        opacity: fade(noteLocal, 0, 14),
                        transform: `translateY(${slide(noteLocal, 0, 18, 14)}px)`,
                        padding: "14px 18px",
                        borderRadius: theme.radius,
                        background: `${card.color}12`,
                        color: theme.muted,
                        fontSize: 26,
                        lineHeight: 1.22,
                        fontWeight: 820,
                      }}
                    >
                      {note}
                    </div>
                  );
                })}
              </div>
	            </div>
	          );
	        })}
      </div>
    </div>
  );
};

const TimelineScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const timelineItems = scene.visualBrief?.timelineItems;
  const keywords = visualKeywords(scene, ["前提", "变化", "结果", "影响"], 4);
  const items = timelineItems?.length ? timelineItems.map((item) => `${item.label} ${item.title}`) : ["前提", keywords[0] ?? "变化", keywords[1] ?? "结果", "影响"].slice(0, 4);
  const progress = interpolate(frame, [16, 70], [0, 1], { extrapolateRight: "clamp", easing: ease });
  const headline = scene.visualBrief?.headline ?? "时间线推进";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ color: theme.secondary, fontSize: 28, fontWeight: 950, marginBottom: 24 }}>{sceneEyebrow.timeline}</div>
      <div style={{ color: theme.ink, fontSize: 70, lineHeight: 1.04, fontWeight: theme.titleWeight, letterSpacing: 0 }}>{headline}</div>
      <div style={{ position: "relative", marginTop: 72, height: 240 }}>
        <div style={{ position: "absolute", left: 40, right: 40, top: 112, height: 8, borderRadius: 999, background: theme.line }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 999, background: theme.gradient }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 26 }}>
          {items.map((item, index) => {
            const local = frame - index * 10;
            const enter = entranceTransform({ frame: local, fps: 30, variant: "line-draw", pace: scene.pace });
            return (
              <div key={`${item}-${index}`} style={{ ...enter, textAlign: "center" }}>
                <div style={{ margin: "0 auto 22px", width: 82, height: 82, borderRadius: 999, background: getAccent(index, theme), color: "#fff", display: "grid", placeItems: "center", fontSize: 30, fontWeight: 950, boxShadow: theme.shadow }}>
                  {index + 1}
                </div>
                <div style={{ padding: "18px 20px", minHeight: 94, borderRadius: theme.radius, background: theme.panel, border: `1px solid ${theme.line}`, color: theme.ink, fontSize: 27, lineHeight: 1.18, fontWeight: 850 }}>
                  {clampText(item, 22)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ExplainerFlowScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const keywords = visualKeywords(scene, ["对象", "路径", "结论"], 3);
  const arrow = interpolate(frame, [20, 62], [0, 1], { extrapolateRight: "clamp", easing: ease });

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "420px 1fr", gap: 54, alignItems: "center", transform: cameraTransform(frame, "guided-pan", scene.pace) }}>
      <div>
        <div style={{ color: theme.primary, fontSize: 28, fontWeight: 950, marginBottom: 22 }}>EXPLAINER</div>
        <div style={{ color: theme.ink, fontSize: 72, lineHeight: 1.04, fontWeight: theme.titleWeight }}>三步拆解</div>
        <div style={{ marginTop: 28, color: theme.muted, fontSize: 29, lineHeight: 1.28, fontWeight: 780 }}>
          把一句复杂判断拆成对象、路径和结论，画面只保留关键词。
        </div>
      </div>
      <div style={{ position: "relative", height: 620 }}>
        <svg width="100%" height="100%" viewBox="0 0 1180 620" style={{ position: "absolute", inset: 0 }}>
          <path
            d="M170 310 C330 120 540 120 690 306 C805 450 960 456 1062 268"
            fill="none"
            stroke={theme.secondary}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="1400"
            strokeDashoffset={1400 - arrow * 1400}
            opacity="0.42"
          />
          <path d="M1032 250 L1070 264 L1046 298" fill="none" stroke={theme.secondary} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity={arrow} />
        </svg>
        {keywords.map((keyword, index) => {
          const positions = [
            { left: 30, top: 198, label: "对象" },
            { left: 430, top: 76, label: "路径" },
            { left: 820, top: 246, label: "结论" },
          ];
          const pos = positions[index];
          const local = frame - 10 - index * 12;
          const enter = entranceTransform({ frame: local, fps: 30, variant: "card-stack", pace: "soft" });
          return (
            <div
              key={`${keyword}-${index}`}
              style={{
                ...enter,
                position: "absolute",
                left: pos.left,
                top: pos.top,
                width: 300,
                minHeight: 188,
                borderRadius: 18,
                background: theme.panel,
                border: `2px solid ${getAccent(index, theme)}4d`,
                boxShadow: theme.shadow,
                padding: 28,
              }}
            >
              <div style={{ width: 58, height: 58, borderRadius: 18, background: `${getAccent(index, theme)}1f`, color: getAccent(index, theme), display: "grid", placeItems: "center", fontSize: 28, fontWeight: 950 }}>
                {index + 1}
              </div>
              <div style={{ marginTop: 22, color: theme.ink, fontSize: 42, lineHeight: 1.05, fontWeight: theme.titleWeight }}>{clampText(keyword, 8)}</div>
              <div style={{ marginTop: 10, color: theme.muted, fontSize: 24, fontWeight: 820 }}>{pos.label}</div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 330, bottom: 26, right: 80, height: 86, borderRadius: 18, background: `${theme.primary}12`, border: `1px solid ${theme.primary}33`, display: "flex", alignItems: "center", padding: "0 28px", color: theme.primary, fontSize: 30, fontWeight: 900 }}>
          先拆关系，再看结果
        </div>
      </div>
    </div>
  );
};

const ConceptStepsScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const keywords = visualKeywords(scene, ["概念", "逻辑", "判断"], 3);
  const guideLabels = ["对象", "路径", "结论"];

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.88fr 1.12fr", gap: 50, alignItems: "center" }}>
      <div>
        <div style={{ color: theme.secondary, fontSize: 28, fontWeight: 950, marginBottom: 20 }}>{sceneEyebrow["concept-steps"]}</div>
        <div style={{ color: theme.ink, fontSize: 74, lineHeight: 1.04, fontWeight: theme.titleWeight, letterSpacing: 0 }}>
          拆成
          <br />
          三步理解
        </div>
        <div style={{ marginTop: 30 }}>
          <KeywordPills scene={scene} theme={theme} fallback={["概念", "逻辑", "判断"]} />
        </div>
      </div>
      <div style={{ display: "grid", gap: 22 }}>
        {keywords.map((keyword, index) => {
          const local = frame - 12 - index * 10;
          const enter = entranceTransform({ frame: local, fps: 30, variant: "card-stack", pace: "soft" });
          return (
            <div
              key={`${keyword}-${index}`}
              style={{
                ...enter,
                padding: "28px 32px",
                borderRadius: theme.radius,
                background: theme.panel,
                border: `1px solid ${getAccent(index, theme)}55`,
                boxShadow: theme.shadow,
                display: "grid",
                gridTemplateColumns: "76px 1fr",
                gap: 22,
                alignItems: "center",
              }}
            >
              <div style={{ width: 76, height: 76, borderRadius: 22, background: `${getAccent(index, theme)}20`, color: getAccent(index, theme), display: "grid", placeItems: "center", fontSize: 34, fontWeight: 950 }}>
                {index + 1}
              </div>
              <div>
                <div style={{ color: theme.ink, fontSize: 38, fontWeight: theme.titleWeight }}>{keyword}</div>
                <div style={{ marginTop: 8, color: theme.muted, fontSize: 24, fontWeight: 760 }}>{guideLabels[index] ?? "判断"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const QuoteImpactScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [0, 5, 16], [0.7, 0.18, 0], { extrapolateRight: "clamp" });
  const text = visualPhrase(scene, "关键判断", 18);
  const fontSize = fitChineseText(text, 86, 24, 54);

  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: theme.gradient, opacity: flash }} />
      <div
        style={{
          width: 1240,
          minHeight: 470,
          borderRadius: theme.radius,
          background: theme.panel,
          border: `1px solid ${theme.line}`,
          boxShadow: theme.shadow,
          padding: "64px 78px",
          transform: cameraTransform(frame, scene.motionVariant, scene.pace),
        }}
      >
        <div style={{ color: theme.warning, fontSize: 30, fontWeight: 950, marginBottom: 30 }}>{sceneEyebrow["quote-impact"]}</div>
        <div style={{ color: theme.ink, fontSize, lineHeight: 1.08, fontWeight: theme.titleWeight }}>{text}</div>
        <div style={{ marginTop: 42, width: 420, height: 14, borderRadius: 999, background: theme.gradient }} />
      </div>
    </div>
  );
};

const ClosingFrame = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: 30, config: { damping: 18, stiffness: 100 } });
  const keywords = scene.visualBrief?.summaryItems?.length ? scene.visualBrief.summaryItems.slice(0, 3) : visualKeywords(scene, ["真实业务", "成本", "开源"], 3);
  const headline = scene.visualBrief?.headline ?? "最后看结构";
  const kicker = scene.visualBrief?.kicker ?? "结尾总结";

  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
      <div
        style={{
          width: 1280,
          minHeight: 520,
          borderRadius: theme.radius,
          background: theme.panel,
          border: `1px solid ${theme.line}`,
          boxShadow: theme.shadow,
          padding: "70px 86px",
          transform: makeTransform([`scale(${0.9 + s * 0.1})`, cameraTransform(frame, scene.motionVariant, scene.pace)]),
        }}
      >
        <div style={{ color: theme.secondary, fontSize: 30, fontWeight: 900, marginBottom: 28 }}>{kicker}</div>
        <div style={{ color: theme.ink, fontSize: 78, lineHeight: 1.04, fontWeight: theme.titleWeight, letterSpacing: 0 }}>{headline}</div>
        <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {keywords.map((keyword, index) => (
            <div key={`${keyword}-${index}`} style={{ padding: "22px 24px", borderRadius: theme.radius, background: `${getAccent(index, theme)}16`, border: `1px solid ${getAccent(index, theme)}44`, color: getAccent(index, theme), fontSize: 34, fontWeight: 930, textAlign: "center" }}>
              {keyword}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 42, height: 12, width: 320, borderRadius: 999, background: theme.gradient }} />
      </div>
    </div>
  );
};

const PauseScreen = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: 30, config: { damping: 20, stiffness: 90 } });
  const line = interpolate(frame, [16, 62], [0, 1], { extrapolateRight: "clamp", easing: ease });

  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", position: "relative" }}>
      <div
        style={{
          width: 980,
          minHeight: 360,
          borderRadius: theme.radius,
          background: theme.isDark ? "rgba(15,23,42,0.5)" : "rgba(255,255,255,0.58)",
          border: `1px solid ${theme.line}`,
          boxShadow: `0 24px 82px ${theme.primary}12`,
          padding: "70px 86px",
          transform: makeTransform([`scale(${0.96 + s * 0.04})`, cameraTransform(frame, "slow-push", "soft")]),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              style={{
                width: 18 + item * 6,
                height: 18 + item * 6,
                borderRadius: 999,
                background: item === 1 ? theme.secondary : theme.primary,
                opacity: 0.34 + item * 0.14,
                transform: `scale(${0.8 + s * 0.2})`,
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 42, color: theme.muted, fontSize: 26, lineHeight: 1.3, fontWeight: 780, textAlign: "center" }}>
          节奏留白
        </div>
        <div style={{ marginTop: 56, width: 520, height: 8, borderRadius: 999, background: theme.line, overflow: "hidden" }}>
          <div style={{ width: `${line * 100}%`, height: "100%", borderRadius: 999, background: theme.gradient }} />
        </div>
      </div>
    </div>
  );
};

const isCaseWorkflowTheme = (theme: Theme) => /案例|工作流|workflow/i.test(theme.styleName);
const isJSpaceTheme = (theme: Theme) => /J-space|Claude|内视|意识工作区/i.test(theme.styleName);
const isTacticalMapTheme = (theme: Theme) => /金融战术地图|Tactical Map/i.test(theme.styleName);

const caseBrief = (scene: Scene): CaseVisualBrief => (scene.visualBrief ?? {}) as CaseVisualBrief;

const tacticalMetricCards = (scene: Scene) => {
  const cards = scene.visualBrief?.metricCards ?? scene.content?.metrics ?? [];
  if (cards.length) return cards.slice(0, 5);
  if (scene.visualBrief?.primaryMetric) {
    return [{ label: scene.visualBrief.primaryMetric.label, value: scene.visualBrief.primaryMetric.value }];
  }
  return emphasisItems(scene, ["规则", "现金", "执行力"]).map((item, index) => ({
    label: ["信号", "动作", "结果", "风险"][index] ?? "指标",
    value: item,
  }));
};

const TacticalBackground = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 180], [0, 42], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const field = scene.background?.backgroundType ?? "Grid";
  const id = scene.id.toLowerCase();
  const isCrisis = id.includes("drawdown") || id.includes("2009") || id.includes("risk") || id.includes("tqqq");
  const isSignal = id.includes("signal") || id.includes("cape") || id.includes("vix") || id.includes("decision");
  const isResult = id.includes("result") || id.includes("summary") || id.includes("execution");
  const mesh =
    isCrisis
      ? `radial-gradient(circle at 18% 28%, ${theme.warning}18, transparent 30%), radial-gradient(circle at 78% 72%, ${theme.primary}14, transparent 34%)`
      : isSignal
        ? `radial-gradient(circle at 22% 72%, ${theme.secondary}18, transparent 32%), radial-gradient(circle at 82% 24%, ${theme.accent}14, transparent 34%)`
        : isResult
          ? `radial-gradient(circle at 30% 28%, ${theme.primary}12, transparent 32%), radial-gradient(circle at 72% 68%, ${theme.secondary}16, transparent 36%)`
          : `radial-gradient(circle at 18% 34%, ${theme.primary}12, transparent 32%), radial-gradient(circle at 78% 26%, ${theme.secondary}12, transparent 34%)`;
  const gridOpacity = field === "DataField" || isSignal ? 0.18 : isCrisis ? 0.08 : 0.12;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${theme.backgroundColors[0]}, ${theme.backgroundColors[1]} 54%, ${theme.backgroundColors[2]})`, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: mesh, transform: `translate3d(${drift * 0.18}px, ${-drift * 0.12}px, 0)` }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: gridOpacity,
          backgroundImage: `linear-gradient(${theme.line} 1px, transparent 1px), linear-gradient(90deg, ${theme.line} 1px, transparent 1px)`,
          backgroundSize: isSignal ? "54px 54px" : "86px 86px",
          transform: `translate3d(${isSignal ? drift * 0.35 : -drift}px, ${drift * 0.2}px, 0)`,
        }}
      />
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id={`tactical-flow-${scene.id}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={theme.primary} stopOpacity="0.18" />
            <stop offset="0.58" stopColor={theme.secondary} stopOpacity="0.15" />
            <stop offset="1" stopColor={theme.accent} stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path
          d={
            isSignal
              ? `M 160 ${850 - drift * 0.14} C 430 ${650}, 620 ${360 + drift * 0.1}, 930 ${510} S 1400 ${720 - drift * 0.08}, 1760 330`
              : isCrisis
                ? `M -80 ${220 + drift * 0.18} C 300 ${360}, 610 ${560 - drift * 0.12}, 910 ${490} S 1450 ${210 + drift * 0.08}, 2040 360`
                : `M -90 ${250 + drift * 0.2} C 340 ${110 + drift * 0.1}, 640 ${430 - drift * 0.16}, 1040 ${250 + drift * 0.08} S 1520 ${130 + drift * 0.18}, 2020 310`
          }
          fill="none"
          stroke={`url(#tactical-flow-${scene.id})`}
          strokeWidth={isCrisis ? 112 : isSignal ? 54 : 76}
          strokeLinecap="round"
        />
        {isSignal ? (
          [0, 1, 2].map((ring) => (
            <circle key={ring} cx={960} cy={540} r={190 + ring * 120 + drift * 0.08} fill="none" stroke={getAccent(ring, theme)} strokeWidth="3" strokeOpacity="0.12" strokeDasharray="18 24" />
          ))
        ) : (
          <path
            d={`M -40 ${760 - drift * 0.16} C 280 620, 620 ${850 - drift * 0.12}, 960 690 S 1500 ${520 + drift * 0.08}, 1980 650`}
            fill="none"
            stroke={isCrisis ? theme.warning : theme.secondary}
            strokeWidth={isResult ? 14 : 8}
            strokeOpacity={isCrisis ? 0.14 : 0.18}
            strokeLinecap="round"
            strokeDasharray={isResult ? "36 20" : "20 26"}
          />
        )}
      </svg>
    </AbsoluteFill>
  );
};

type TacticalSeriesKind = "baseline" | "long-cycle" | "steady" | "leveraged" | "drawdown" | "crisis-v" | "signal" | "strategy";

const tacticalSeriesKind = (scene: Scene, danger: boolean): TacticalSeriesKind => {
  const id = scene.id.toLowerCase();
  if (id.includes("2009")) return "crisis-v";
  if (id.includes("drawdown")) return "drawdown";
  if (id.includes("tqqq")) return "leveraged";
  if (id.includes("qqq-data")) return "steady";
  if (id.includes("kline-terrain")) return "long-cycle";
  if (id.includes("signal") || id.includes("decision")) return "signal";
  if (id.includes("result") || id.includes("summary") || id.includes("execution")) return "strategy";

  const text = `${scene.id} ${scene.title} ${scene.subtitle} ${scene.visualBrief?.kicker ?? ""} ${scene.visualBrief?.headline ?? ""} ${scene.visualBrief?.primaryMetric?.label ?? ""} ${scene.visualBrief?.primaryMetric?.value ?? ""}`;
  if (/2009|进攻窗口|危机/.test(text)) return "crisis-v";
  if (/回撤|-83|-84|-92\.8|生死线/.test(text)) return "drawdown";
  if (/TQQQ|37\.3|58\.7|-84|-92\.8/.test(text)) return "leveraged";
  if (/QQQ|19\.2|-36|稳妥底线/.test(text)) return "steady";
  if (/CAPE|DD|三信号|动态仓位|仓位开关/.test(text)) return "signal";
  if (/结论|现金|弹药|执行力|119\.4|34\.0|-52/.test(text)) return "strategy";
  if (/2000|2026|长周期|起点|周期/.test(text)) return "long-cycle";
  return danger ? "leveraged" : "baseline";
};

const tacticalSeriesValues = (kind: TacticalSeriesKind): number[] => {
  if (kind === "long-cycle") return [122, 84, 58, 66, 74, 96, 118, 88, 116, 142, 168, 126, 155, 190, 218, 176, 205, 236, 268, 248, 284, 314];
  if (kind === "steady") return [76, 80, 86, 91, 98, 104, 96, 108, 118, 125, 136, 128, 142, 154, 166, 158, 176, 190, 206, 198, 220, 238];
  if (kind === "leveraged") return [82, 118, 96, 148, 132, 196, 154, 232, 182, 286, 204, 318, 176, 254, 146, 224, 112, 198, 246, 302, 232, 336];
  if (kind === "drawdown") return [286, 262, 238, 214, 176, 142, 108, 86, 62, 74, 58, 82, 116, 98, 132, 156, 138, 172, 198, 186, 220, 242];
  if (kind === "crisis-v") return [252, 226, 196, 166, 126, 84, 58, 42, 68, 112, 158, 192, 228, 248, 264, 286, 276, 298, 312, 326, 318, 338];
  if (kind === "signal") return [128, 132, 126, 138, 118, 122, 96, 110, 88, 132, 104, 150, 126, 168, 142, 186, 154, 202, 172, 218, 194, 236];
  if (kind === "strategy") return [84, 86, 92, 98, 106, 118, 116, 132, 152, 148, 174, 196, 188, 222, 248, 238, 286, 314, 302, 344, 376, 408];
  return [88, 96, 92, 108, 112, 126, 118, 136, 146, 158, 152, 174, 184, 178, 204, 214, 208, 232, 246, 238, 264, 282];
};

const KLineTerrain = ({ scene, theme, danger = false }: { scene: Scene; theme: Theme; danger?: boolean }) => {
  const frame = useCurrentFrame();
  const progress = fade(frame, 8, 70);
  const kind = tacticalSeriesKind(scene, danger);
  const values = tacticalSeriesValues(kind);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const chartY = (value: number) => 326 - ((value - minValue) / Math.max(1, maxValue - minValue)) * 238;
  const candles = values.map((close, index) => {
    const open = index === 0 ? close - 10 : values[index - 1];
    const bodyTop = Math.min(open, close);
    const bodyBottom = Math.max(open, close);
    const wick = 10 + (index % 4) * 4 + (kind === "leveraged" ? 8 : 0);
    return {
      x: 82 + index * 54,
      open,
      close,
      high: Math.min(maxValue + wick, bodyBottom + wick),
      low: Math.max(minValue - wick, bodyTop - wick),
      up: close >= open,
    };
  });
  const pathData = candles.map((candle, index) => `${index === 0 ? "M" : "L"} ${candle.x} ${chartY(candle.close)}`).join(" ");
  const evolvedPath = evolvePath(progress, pathData);
  const pathLength = getLength(pathData);
  const tracker = getPointAtLength(pathData, pathLength * clamp(progress, 0, 1));
  const areaPath = `${pathData} L ${candles.at(-1)?.x ?? 1240} 344 L ${candles[0]?.x ?? 80} 344 Z`;
  const label = {
    baseline: "NASDAQ TERRAIN",
    "long-cycle": "2000-2026 CYCLE",
    steady: "QQQ STEADY PATH",
    leveraged: "TQQQ HIGH BETA",
    drawdown: "MAX DRAWDOWN MAP",
    "crisis-v": "2009 CRISIS V",
    signal: "CAPE / DD / VIX",
    strategy: "TACTICAL ALLOCATION",
  }[kind];

  return (
    <svg width="1320" height="430" viewBox="0 0 1320 430" style={{ width: "100%", height: "100%" }}>
      <path d="M80 336 H1240" stroke={theme.line} strokeWidth="2" />
      {[0, 1, 2, 3].map((row) => (
        <path key={row} d={`M80 ${110 + row * 56} H1240`} stroke={theme.line} strokeWidth="1" strokeOpacity="0.56" />
      ))}
      <path d={areaPath} fill={danger || kind === "leveraged" ? theme.warning : theme.secondary} opacity={0.08 * progress} />
      <path
        d={pathData}
        fill="none"
        stroke={danger || kind === "leveraged" ? theme.warning : theme.primary}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={evolvedPath.strokeDasharray}
        strokeDashoffset={evolvedPath.strokeDashoffset}
      />
      <circle cx={tracker.x} cy={tracker.y} r="12" fill={danger || kind === "leveraged" ? theme.warning : theme.primary} opacity={progress > 0.04 ? 1 : 0} />
      <circle cx={tracker.x} cy={tracker.y} r="23" fill="none" stroke={danger || kind === "leveraged" ? theme.warning : theme.primary} strokeWidth="4" opacity={progress > 0.08 ? 0.24 : 0} />
      {candles.map((candle, index) => {
        const show = progress > index / candles.length;
        const color = candle.up ? theme.secondary : theme.warning;
        const openY = chartY(candle.open);
        const closeY = chartY(candle.close);
        const top = Math.min(openY, closeY);
        const height = Math.max(9, Math.abs(closeY - openY));
        return (
          <g key={index} opacity={show ? 1 : 0.12}>
            <line x1={candle.x} x2={candle.x} y1={chartY(candle.low)} y2={chartY(candle.high)} stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.72" />
            <rect x={candle.x - 11} y={top} width="22" height={height} rx="3" fill={color} opacity="0.84" />
          </g>
        );
      })}
      <text x="86" y="62" fill={theme.muted} fontSize="20" fontWeight="900" letterSpacing="0">
        {label}
      </text>
    </svg>
  );
};

const FlowRibbon = ({ theme, reverse = false }: { theme: Theme; reverse?: boolean }) => {
  const frame = useCurrentFrame();
  const path = "M40 84 C280 16, 430 136, 620 72 S900 28, 1080 92";
  const pathLength = getLength(path);
  const progress = interpolate(frame, [8, 86], [reverse ? 1 : 0, reverse ? 0 : 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const dash = interpolate(frame, [0, 80], [reverse ? 80 : 0, reverse ? 0 : 80], { extrapolateRight: "clamp" });
  const tracker = getPointAtLength(path, pathLength * clamp(progress, 0, 1));
  return (
    <svg width="100%" height="150" viewBox="0 0 1120 150" style={{ display: "block" }}>
      <path d={path} fill="none" stroke={theme.line} strokeWidth="22" strokeLinecap="round" />
      <path d={path} fill="none" stroke={theme.secondary} strokeWidth="9" strokeLinecap="round" strokeDasharray="42 38" strokeDashoffset={dash} opacity="0.78" />
      <circle cx={tracker.x} cy={tracker.y} r="14" fill={theme.secondary} opacity="0.92" />
      <circle cx={tracker.x} cy={tracker.y} r="27" fill="none" stroke={theme.secondary} strokeWidth="4" opacity="0.24" />
    </svg>
  );
};

const TacticalMetricRail = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const cards = tacticalMetricCards(scene);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(cards.length, 5)}, minmax(0, 1fr))`, gap: 18 }}>
      {cards.map((card, index) => {
        const local = frame - 10 - index * 5;
        const enter = spring({ frame: local, fps: 30, config: { damping: 18, stiffness: 120 } });
        return (
          <div
            key={`${card.label}-${index}`}
            style={{
              opacity: fade(local, 0, 14),
              transform: `translateY(${(1 - enter) * 28}px)`,
              borderRadius: 18,
              border: `1px solid ${getAccent(index, theme)}38`,
              background: "rgba(255,255,255,0.88)",
              boxShadow: `0 18px 48px ${getAccent(index, theme)}12`,
              padding: "22px 24px",
              minHeight: 136,
            }}
          >
            <div style={{ color: theme.muted, fontSize: 22, fontWeight: 850 }}>{card.label}</div>
            <div style={{ marginTop: 14, color: getAccent(index, theme), fontSize: fitChineseText(card.value, 50, 28, 7), lineHeight: 1, fontWeight: 980 }}>{card.value}</div>
            {card.note ? <div style={{ marginTop: 12, color: theme.muted, fontSize: 19, lineHeight: 1.22, fontWeight: 760 }}>{clampText(card.note, 18)}</div> : null}
          </div>
        );
      })}
    </div>
  );
};

const SignalGauge = ({ label, value, color, mutedColor, delay = 0 }: { label: string; value: string; color: string; mutedColor: string; delay?: number }) => {
  const frame = useCurrentFrame();
  const p = spring({ frame: frame - delay, fps: 30, config: { damping: 18, stiffness: 90 } });
  const angle = -130 + 260 * Math.min(1, p);

  return (
    <div style={{ position: "relative", height: 200, borderRadius: 20, border: `1px solid ${color}36`, background: "rgba(255,255,255,0.78)", padding: 18 }}>
      <svg width="100%" height="118" viewBox="0 0 220 126">
        <path d="M30 108 A80 80 0 0 1 190 108" fill="none" stroke="#e5eef7" strokeWidth="18" strokeLinecap="round" />
        <path d="M30 108 A80 80 0 0 1 190 108" fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" strokeDasharray={`${190 * p} 260`} />
        <line x1="110" y1="108" x2="110" y2="44" stroke={color} strokeWidth="7" strokeLinecap="round" style={{ transform: `rotate(${angle}deg)`, transformOrigin: "110px 108px" }} />
      </svg>
      <div style={{ color: mutedColor, fontSize: 20, fontWeight: 880, textAlign: "center" }}>{label}</div>
      <div style={{ marginTop: 4, color, fontSize: 29, fontWeight: 980, textAlign: "center" }}>{value}</div>
    </div>
  );
};

const TacticalSignalNetworkScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const headline = scene.visualBrief?.headline ?? scene.title ?? "三个信号决定仓位";
  const nodes = [
    { label: "CAPE", note: "估值", x: 210, y: 168, color: theme.primary },
    { label: "DD", note: "回撤", x: 650, y: 168, color: theme.warning },
    { label: "VIX", note: "情绪", x: 430, y: 408, color: theme.secondary },
  ];
  const draw = fade(frame, 8, 58);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.66fr 1.34fr", gap: 44, alignItems: "center", paddingBottom: 96 }}>
      <div>
        <div style={{ color: theme.secondary, fontSize: 26, fontWeight: 930 }}>信号网络</div>
        <div style={{ marginTop: 14, color: theme.ink, fontSize: fitChineseText(headline, 68, 44, 16), lineHeight: 1.04, fontWeight: theme.titleWeight }}>{headline}</div>
        <div style={{ marginTop: 28, color: theme.muted, fontSize: 25, lineHeight: 1.32, fontWeight: 760 }}>三个开关不是并列装饰，而是共同决定仓位动作。</div>
      </div>
      <div style={{ position: "relative", height: 580, borderRadius: 34, border: `1px solid ${theme.secondary}26`, background: "rgba(255,255,255,0.56)", boxShadow: theme.shadow, overflow: "hidden" }}>
        <svg width="100%" height="100%" viewBox="0 0 860 580" style={{ position: "absolute", inset: 0 }}>
          <path d="M210 168 C330 86, 530 86, 650 168" stroke={theme.primary} strokeWidth="8" fill="none" strokeDasharray={`${draw * 590} 590`} strokeLinecap="round" opacity="0.52" />
          <path d="M210 168 C260 330, 330 420, 430 408" stroke={theme.warning} strokeWidth="8" fill="none" strokeDasharray={`${draw * 420} 420`} strokeLinecap="round" opacity="0.46" />
          <path d="M650 168 C600 330, 530 420, 430 408" stroke={theme.secondary} strokeWidth="8" fill="none" strokeDasharray={`${draw * 420} 420`} strokeLinecap="round" opacity="0.46" />
          <circle cx="430" cy="282" r={80 + draw * 10} fill={`${theme.secondary}12`} stroke={theme.secondary} strokeWidth="3" strokeOpacity="0.24" />
        </svg>
        {nodes.map((node, index) => {
          const enter = spring({ frame: frame - 12 - index * 8, fps: 30, config: { damping: 18, stiffness: 105 } });
          return (
            <div key={node.label} style={{ position: "absolute", left: node.x - 82, top: node.y - 64, width: 164, minHeight: 128, opacity: fade(frame, 8 + index * 8, 26 + index * 8), transform: `scale(${0.84 + enter * 0.16})`, borderRadius: 28, background: "rgba(255,255,255,0.88)", border: `1px solid ${node.color}44`, boxShadow: `0 22px 54px ${node.color}18`, display: "grid", placeItems: "center", textAlign: "center" }}>
              <div>
                <div style={{ color: node.color, fontSize: 38, fontWeight: 980 }}>{node.label}</div>
                <div style={{ marginTop: 8, color: theme.muted, fontSize: 22, fontWeight: 850 }}>{node.note}</div>
              </div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 310, top: 238, width: 240, padding: "24px 26px", borderRadius: 28, background: "rgba(255,255,255,0.9)", border: `1px solid ${theme.secondary}38`, textAlign: "center", boxShadow: theme.shadow }}>
          <div style={{ color: theme.muted, fontSize: 20, fontWeight: 850 }}>输出</div>
          <div style={{ marginTop: 10, color: theme.secondary, fontSize: 44, fontWeight: 980 }}>仓位动作</div>
        </div>
      </div>
    </div>
  );
};

const TacticalValuationThermometerScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const headline = scene.visualBrief?.headline ?? scene.title ?? "高估时先留现金";
  const fill = spring({ frame: frame - 12, fps: 30, config: { damping: 20, stiffness: 80 } });
  const bands = [
    { label: "低估", value: "<20%", color: theme.secondary },
    { label: "正常", value: "20-70%", color: theme.primary },
    { label: "高估", value: ">70%", color: theme.warning },
    { label: "极热", value: ">85%", color: theme.warning },
  ];

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.72fr 1.28fr", gap: 46, alignItems: "center", paddingBottom: 94 }}>
      <div>
        <div style={{ color: theme.primary, fontSize: 26, fontWeight: 930 }}>估值温度</div>
        <div style={{ marginTop: 14, color: theme.ink, fontSize: fitChineseText(headline, 68, 44, 16), lineHeight: 1.04, fontWeight: theme.titleWeight }}>{headline}</div>
        <div style={{ marginTop: 28, color: theme.muted, fontSize: 25, lineHeight: 1.32, fontWeight: 760 }}>这个镜头只表达估值热度和现金比例，不再复用三仪表盘。</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 34, alignItems: "center" }}>
        <div style={{ height: 560, borderRadius: 999, background: "rgba(255,255,255,0.8)", border: `1px solid ${theme.line}`, boxShadow: theme.shadow, padding: 22, display: "flex", alignItems: "end" }}>
          <div style={{ width: "100%", height: `${32 + fill * 58}%`, borderRadius: 999, background: `linear-gradient(180deg, ${theme.warning}, ${theme.primary}, ${theme.secondary})`, boxShadow: `0 24px 60px ${theme.warning}18` }} />
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          {bands.map((band, index) => (
            <div key={band.label} style={{ display: "grid", gridTemplateColumns: "110px 1fr 110px", alignItems: "center", gap: 18, padding: "22px 26px", borderRadius: 22, background: "rgba(255,255,255,0.78)", border: `1px solid ${band.color}32`, boxShadow: `0 16px 44px ${band.color}10`, opacity: fade(frame, 10 + index * 6, 28 + index * 6) }}>
              <div style={{ color: band.color, fontSize: 28, fontWeight: 960 }}>{band.label}</div>
              <div style={{ height: 16, borderRadius: 999, background: "#eaf2f8", overflow: "hidden" }}>
                <div style={{ width: `${(index + 1) * 23}%`, height: "100%", background: band.color, borderRadius: 999 }} />
              </div>
              <div style={{ color: theme.ink, fontSize: 26, fontWeight: 930, textAlign: "right" }}>{band.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TacticalDrawdownTriggerScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const headline = scene.visualBrief?.headline ?? scene.title ?? "深跌共振时集中打出去";
  const bars = [18, 34, 52, 70, 88, 62, 44];

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 28, paddingBottom: 94 }}>
      <div>
        <div style={{ color: theme.warning, fontSize: 26, fontWeight: 930 }}>回撤触发</div>
        <div style={{ marginTop: 12, color: theme.ink, fontSize: fitChineseText(headline, 70, 44, 16), lineHeight: 1.04, fontWeight: theme.titleWeight }}>{headline}</div>
      </div>
      <div style={{ position: "relative", borderRadius: 34, border: `1px solid ${theme.warning}28`, background: "rgba(255,255,255,0.62)", boxShadow: theme.shadow, overflow: "hidden", padding: 44 }}>
        <svg width="100%" height="100%" viewBox="0 0 1420 520" style={{ position: "absolute", inset: 0 }}>
          <path d="M80 110 H1340 M80 250 H1340 M80 390 H1340" stroke={theme.line} strokeWidth="2" strokeDasharray="16 18" />
          <path d="M120 150 C270 170, 420 310, 560 360 S780 430, 930 330 S1160 180, 1320 210" fill="none" stroke={theme.warning} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${fade(frame, 8, 62) * 1540} 1540`} />
          <path d="M120 150 C270 170, 420 310, 560 360 S780 430, 930 330 S1160 180, 1320 210 L1320 440 L120 440Z" fill={theme.warning} opacity="0.08" />
        </svg>
        <div style={{ position: "absolute", left: 70, right: 70, bottom: 56, display: "grid", gridTemplateColumns: `repeat(${bars.length}, 1fr)`, gap: 18, alignItems: "end", height: 210 }}>
          {bars.map((bar, index) => {
            const p = spring({ frame: frame - 16 - index * 4, fps: 30, config: { damping: 18, stiffness: 90 } });
            return <div key={index} style={{ height: `${bar * p}%`, borderRadius: "14px 14px 6px 6px", background: index < 5 ? theme.warning : theme.secondary, opacity: 0.72 }} />;
          })}
        </div>
        <div style={{ position: "absolute", left: 78, top: 52, display: "flex", gap: 16 }}>
          {["DD >20%", "25日跌幅 >12%", "现金集中打出"].map((tag, index) => (
            <div key={tag} style={{ padding: "14px 18px", borderRadius: 999, background: `${getAccent(index, theme)}14`, border: `1px solid ${getAccent(index, theme)}34`, color: getAccent(index, theme), fontSize: 23, fontWeight: 920 }}>{tag}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TacticalVolatilityWaveScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const headline = scene.visualBrief?.headline ?? scene.title ?? "等危机，再重点买入";
  const p = fade(frame, 8, 72);
  const waves = [0, 1, 2, 3].map((row) => {
    const amp = 28 + row * 18;
    return `M80 ${145 + row * 78} C220 ${145 - amp}, 360 ${145 + amp}, 500 ${145 + row * 78} S780 ${145 - amp}, 920 ${145 + row * 78} S1200 ${145 + amp}, 1360 ${145 + row * 78}`;
  });

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.74fr 1.26fr", gap: 44, alignItems: "center", paddingBottom: 96 }}>
      <div>
        <div style={{ color: theme.warning, fontSize: 26, fontWeight: 930 }}>波动雷达</div>
        <div style={{ marginTop: 14, color: theme.ink, fontSize: fitChineseText(headline, 68, 44, 16), lineHeight: 1.04, fontWeight: theme.titleWeight }}>{headline}</div>
        <div style={{ marginTop: 28, display: "grid", gap: 16 }}>
          {["VIX > 40：恐慌窗口", "VIX < 12：情绪过冷静"].map((item, index) => (
            <div key={item} style={{ padding: "18px 22px", borderRadius: 18, background: "rgba(255,255,255,0.74)", border: `1px solid ${getAccent(index + 1, theme)}30`, color: getAccent(index + 1, theme), fontSize: 26, fontWeight: 920 }}>{item}</div>
          ))}
        </div>
      </div>
      <div style={{ position: "relative", height: 560, borderRadius: 34, background: "rgba(255,255,255,0.56)", border: `1px solid ${theme.warning}24`, boxShadow: theme.shadow, overflow: "hidden" }}>
        <svg width="100%" height="100%" viewBox="0 0 1440 560">
          <path d="M160 430 H1280" stroke={theme.line} strokeWidth="3" />
          <path d="M160 160 H1280" stroke={theme.warning} strokeWidth="3" strokeDasharray="18 18" opacity="0.6" />
          {waves.map((d, index) => (
            <path key={index} d={d} fill="none" stroke={index === 0 ? theme.warning : getAccent(index, theme)} strokeWidth={index === 0 ? 10 : 6} strokeLinecap="round" strokeDasharray={`${p * 1880} 1880`} opacity={0.72 - index * 0.12} />
          ))}
          <circle cx={160 + p * 1120} cy={160} r="16" fill={theme.warning} />
          <circle cx={160 + p * 1120} cy={160} r="36" fill="none" stroke={theme.warning} strokeWidth="5" opacity="0.22" />
        </svg>
      </div>
    </div>
  );
};

const TacticalRuleEngineScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const headline = scene.visualBrief?.headline ?? scene.title ?? "差距来自规则和执行力";
  const steps = ["估值", "回撤", "波动", "仓位", "执行"];

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.66fr 1.34fr", gap: 46, alignItems: "center", paddingBottom: 96 }}>
      <div>
        <div style={{ color: theme.primary, fontSize: 26, fontWeight: 930 }}>规则引擎</div>
        <div style={{ marginTop: 14, color: theme.ink, fontSize: fitChineseText(headline, 70, 46, 16), lineHeight: 1.04, fontWeight: theme.titleWeight }}>{headline}</div>
        <div style={{ marginTop: 28, color: theme.muted, fontSize: 25, lineHeight: 1.32, fontWeight: 760 }}>这里表达流程约束，不再用居中大标题重复字幕。</div>
      </div>
      <div style={{ height: 560, borderRadius: 34, border: `1px solid ${theme.primary}28`, background: "rgba(255,255,255,0.62)", boxShadow: theme.shadow, padding: 42, display: "grid", alignContent: "center", gap: 24 }}>
        {steps.map((step, index) => {
          const enter = spring({ frame: frame - 10 - index * 7, fps: 30, config: { damping: 18, stiffness: 92 } });
          return (
            <div key={step} style={{ display: "grid", gridTemplateColumns: "88px 1fr 118px", alignItems: "center", gap: 22, opacity: fade(frame, 8 + index * 7, 24 + index * 7), transform: `translateX(${(1 - enter) * 34}px)` }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: `${getAccent(index, theme)}16`, color: getAccent(index, theme), display: "grid", placeItems: "center", fontSize: 28, fontWeight: 980 }}>{index + 1}</div>
              <div style={{ height: 24, borderRadius: 999, background: "#eaf2f8", overflow: "hidden" }}>
                <div style={{ width: `${(index + 2) * 17}%`, height: "100%", background: getAccent(index, theme), borderRadius: 999 }} />
              </div>
              <div style={{ color: getAccent(index, theme), fontSize: 30, fontWeight: 960, textAlign: "right" }}>{step}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TacticalInsightCard = ({ label, value, note, color, delay = 0, compact = false }: { label: string; value: string; note?: string; color: string; delay?: number; compact?: boolean }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame: frame - delay, fps: 30, config: { damping: 18, stiffness: 120 } });

  return (
    <div
      style={{
        opacity: fade(frame, delay, delay + 14),
        transform: `translateY(${(1 - enter) * 22}px)`,
        borderRadius: 22,
        border: `1px solid ${color}36`,
        background: "rgba(255,255,255,0.82)",
        boxShadow: `0 18px 44px ${color}12`,
        padding: compact ? "20px 22px" : "26px 28px",
        minHeight: compact ? 112 : 148,
      }}
    >
      <div style={{ color: themeMutedFallback, fontSize: compact ? 18 : 21, fontWeight: 850 }}>{label}</div>
      <div style={{ marginTop: compact ? 10 : 16, color, fontSize: fitChineseText(value, compact ? 38 : 54, compact ? 27 : 34, 8), lineHeight: 0.98, fontWeight: 980 }}>{value}</div>
      {note ? <div style={{ marginTop: 12, color: themeMutedFallback, fontSize: compact ? 17 : 19, lineHeight: 1.25, fontWeight: 760 }}>{note}</div> : null}
    </div>
  );
};

const themeMutedFallback = "#667085";

const TacticalBarPack = ({ items, theme, danger = false }: { items: Array<{ label: string; value: number; text: string }>; theme: Theme; danger?: boolean }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ height: "100%", borderRadius: 24, border: `1px solid ${danger ? theme.warning : theme.primary}28`, background: "rgba(255,255,255,0.78)", padding: 28, display: "grid", alignContent: "end", gap: 20 }}>
      {items.map((item, index) => {
        const p = spring({ frame: frame - 10 - index * 7, fps: 30, config: { damping: 20, stiffness: 95 } });
        const color = danger && index > 0 ? theme.warning : getAccent(index, theme);
        return (
          <div key={item.label}>
            <div style={{ display: "flex", justifyContent: "space-between", color: theme.muted, fontSize: 19, fontWeight: 820 }}>
              <span>{item.label}</span>
              <span style={{ color, fontWeight: 940 }}>{item.text}</span>
            </div>
            <div style={{ marginTop: 10, height: 22, borderRadius: 999, background: "#eaf2f8", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, item.value * p)}%`, height: "100%", borderRadius: 999, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DrawdownDepthMap = ({ theme }: { theme: Theme }) => {
  const frame = useCurrentFrame();
  const p = spring({ frame: frame - 8, fps: 30, config: { damping: 18, stiffness: 86 } });
  const depth = 78 * p;

  return (
    <div style={{ height: "100%", borderRadius: 24, border: `1px solid ${theme.warning}34`, background: "rgba(255,255,255,0.78)", padding: 30, position: "relative", overflow: "hidden" }}>
      <div style={{ color: theme.muted, fontSize: 20, fontWeight: 860 }}>最大回撤深度</div>
      <div style={{ marginTop: 14, color: theme.warning, fontSize: 60, lineHeight: 1, fontWeight: 980 }}>-83.7%</div>
      <svg width="100%" height="260" viewBox="0 0 420 260" style={{ marginTop: 18 }}>
        <path d="M34 42 C110 70, 138 96, 176 156 S286 214, 386 112" fill="none" stroke={theme.warning} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${480 * p} 480`} />
        <path d={`M34 42 C110 70, 138 96, 176 156 S286 214, 386 112 L386 236 L34 236 Z`} fill={theme.warning} opacity="0.1" />
        <line x1="56" x2="364" y1={52 + depth * 2.1} y2={52 + depth * 2.1} stroke={theme.warning} strokeWidth="3" strokeDasharray="12 12" opacity="0.65" />
        <text x="64" y={44 + depth * 2.1} fill={theme.warning} fontSize="24" fontWeight="900">风险线</text>
      </svg>
      <div style={{ position: "absolute", left: 30, right: 30, bottom: 28, color: theme.muted, fontSize: 20, lineHeight: 1.25, fontWeight: 760 }}>收益弹性越强，心理和现金流压力越大。</div>
    </div>
  );
};

const VixTemperatureBand = ({ theme }: { theme: Theme }) => {
  const frame = useCurrentFrame();
  const p = spring({ frame: frame - 8, fps: 30, config: { damping: 20, stiffness: 90 } });
  return (
    <div style={{ height: "100%", borderRadius: 24, border: `1px solid ${theme.warning}30`, background: "rgba(255,255,255,0.78)", padding: 30, display: "grid", gridTemplateRows: "auto 1fr auto", gap: 18 }}>
      <div>
        <div style={{ color: theme.muted, fontSize: 20, fontWeight: 860 }}>市场情绪温度计</div>
        <div style={{ marginTop: 10, color: theme.ink, fontSize: 36, lineHeight: 1.08, fontWeight: 940 }}>冷静不是安全，恐慌才给折扣</div>
      </div>
      <div style={{ position: "relative", borderRadius: 26, background: `linear-gradient(180deg, ${theme.warning} 0%, ${theme.secondary} 56%, ${theme.primary} 100%)`, opacity: 0.9, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 22, right: 22, top: `${62 - p * 44}%`, height: 5, borderRadius: 999, background: "white", boxShadow: "0 0 22px rgba(255,255,255,.75)" }} />
        <div style={{ position: "absolute", inset: 22, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "white", fontWeight: 940, fontSize: 27 }}>
          <span>{">40 恐慌"}</span>
          <span>{"12-40 中性"}</span>
          <span>{"<12 过冷静"}</span>
        </div>
      </div>
      <div style={{ color: theme.muted, fontSize: 20, lineHeight: 1.25, fontWeight: 760 }}>这个镜头只看情绪阈值，不再重复 CAPE / DD 仪表。</div>
    </div>
  );
};

const SignalSwitchPanel = ({ theme }: { theme: Theme }) => {
  const frame = useCurrentFrame();
  const switches = [
    { label: "估值便宜", action: "加速", color: theme.primary },
    { label: "深度回撤", action: "进攻", color: theme.secondary },
    { label: "恐慌升温", action: "确认", color: theme.warning },
  ];
  return (
    <div style={{ height: "100%", borderRadius: 24, border: `1px solid ${theme.secondary}32`, background: "rgba(255,255,255,0.78)", padding: 28, display: "grid", gap: 18 }}>
      {switches.map((item, index) => {
        const on = spring({ frame: frame - 10 - index * 10, fps: 30, config: { damping: 18, stiffness: 100 } });
        return (
          <div key={item.label} style={{ borderRadius: 18, background: `${item.color}12`, border: `1px solid ${item.color}36`, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18 }}>
              <div>
                <div style={{ color: theme.muted, fontSize: 18, fontWeight: 820 }}>{item.label}</div>
                <div style={{ marginTop: 8, color: item.color, fontSize: 31, fontWeight: 960 }}>{item.action}</div>
              </div>
              <div style={{ width: 94, height: 44, borderRadius: 999, background: `linear-gradient(90deg, #e8eef5, ${item.color})`, position: "relative" }}>
                <div style={{ position: "absolute", top: 5, left: 5 + on * 49, width: 34, height: 34, borderRadius: 999, background: "white", boxShadow: `0 8px 18px ${item.color}28` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ResultComparisonPanel = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const cards = tacticalMetricCards(scene);
  const values = cards.map((card) => Number.parseFloat(String(card.value).replace(/[^\d.-]/g, ""))).filter((value) => Number.isFinite(value));
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));
  return (
    <div style={{ height: "100%", borderRadius: 24, border: `1px solid ${theme.primary}28`, background: "rgba(255,255,255,0.78)", padding: 28, display: "grid", alignContent: "center", gap: 16 }}>
      {cards.slice(0, 5).map((card, index) => {
        const raw = Number.parseFloat(String(card.value).replace(/[^\d.-]/g, ""));
        const width = Number.isFinite(raw) ? Math.max(18, (Math.abs(raw) / max) * 100) : 46;
        const color = raw < 0 ? theme.warning : getAccent(index, theme);
        const p = spring({ frame: frame - 8 - index * 5, fps: 30, config: { damping: 20, stiffness: 92 } });
        return (
          <div key={`${card.label}-${index}`}>
            <div style={{ display: "flex", justifyContent: "space-between", color: theme.muted, fontSize: 18, fontWeight: 820 }}>
              <span>{card.label}</span>
              <span style={{ color, fontWeight: 940 }}>{card.value}</span>
            </div>
            <div style={{ marginTop: 8, height: 20, borderRadius: 999, background: "#eaf2f8", overflow: "hidden" }}>
              <div style={{ width: `${width * p}%`, height: "100%", borderRadius: 999, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TacticalSideVisual = ({ scene, theme, hasRisk }: { scene: Scene; theme: Theme; hasRisk: boolean }) => {
  const id = scene.id.toLowerCase();
  if (id.includes("result")) {
    return <ResultComparisonPanel scene={scene} theme={theme} />;
  }
  if (id.includes("vix")) {
    return <VixTemperatureBand theme={theme} />;
  }
  if (id.includes("tqqq")) {
    return <TacticalBarPack theme={theme} danger items={[{ label: "收益弹性", value: 92, text: "强" }, { label: "波动压力", value: 86, text: "高" }, { label: "回撤风险", value: 84, text: "-83.7%" }]} />;
  }
  if (id.includes("qqq-data")) {
    return <TacticalBarPack theme={theme} items={[{ label: "长期稳定性", value: 78, text: "高" }, { label: "收益上限", value: 46, text: "中" }, { label: "最大回撤", value: 36, text: "-36%" }]} />;
  }
  if (id.includes("drawdown") || hasRisk) {
    return <DrawdownDepthMap theme={theme} />;
  }
  if (id.includes("dd-signal") || id.includes("cape") || id.includes("signal")) {
    return <SignalSwitchPanel theme={theme} />;
  }

  const cards = tacticalMetricCards(scene);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {cards.slice(0, 3).map((card, index) => (
        <TacticalInsightCard key={`${card.label}-${index}`} label={card.label} value={card.value} note={card.note} color={getAccent(index, theme)} delay={8 + index * 7} />
      ))}
    </div>
  );
};

const TacticalHeroScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const headline = scene.visualBrief?.headline ?? scene.title ?? getMainLine(scene.subtitle, 18);
  const subhead = scene.visualBrief?.subhead;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 46, alignItems: "center", height: "100%" }}>
      <div>
        <div style={{ color: theme.primary, fontSize: 28, fontWeight: 930, marginBottom: 20 }}>{scene.visualBrief?.kicker ?? "TACTICAL MAP"}</div>
        <div style={{ color: theme.ink, fontSize: fitChineseText(headline, 82, 54, 16), lineHeight: 1.05, fontWeight: theme.titleWeight }}>{headline}</div>
        {subhead ? <div style={{ marginTop: 24, color: theme.muted, fontSize: 30, lineHeight: 1.28, fontWeight: 780 }}>{subhead}</div> : null}
        <div style={{ marginTop: 34 }}>
          <FlowRibbon theme={theme} />
        </div>
      </div>
      <div style={{ height: 520, borderRadius: 28, border: `1px solid ${theme.line}`, background: "rgba(255,255,255,0.72)", boxShadow: theme.shadow, padding: 30 }}>
        <KLineTerrain scene={scene} theme={theme} danger={scene.id.includes("drawdown")} />
        <div style={{ display: "flex", gap: 14, marginTop: -32 }}>
          {briefTags(scene, ["QQQ", "TQQQ", "现金"]).map((tag, index) => (
            <div key={tag} style={{ padding: "12px 16px", borderRadius: 999, background: `${getAccent(index, theme)}16`, color: getAccent(index, theme), border: `1px solid ${getAccent(index, theme)}34`, fontSize: 22, fontWeight: 900, opacity: fade(frame, 14 + index * 5, 28 + index * 5) }}>
              {tag}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TacticalTimelineScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const items = scene.visualBrief?.timelineItems ?? scene.content?.timelineItems ?? [];
  const progress = fade(frame, 8, 78);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 34 }}>
      <div>
        <div style={{ color: theme.secondary, fontSize: 26, fontWeight: 930 }}>{scene.visualBrief?.kicker ?? "TIMELINE"}</div>
        <div style={{ marginTop: 12, color: theme.ink, fontSize: fitChineseText(scene.visualBrief?.headline ?? scene.title ?? "时间线", 68, 44, 20), lineHeight: 1.04, fontWeight: theme.titleWeight }}>
          {scene.visualBrief?.headline ?? scene.title}
        </div>
      </div>
      <div style={{ position: "relative", borderRadius: 28, border: `1px solid ${theme.line}`, background: "rgba(255,255,255,0.72)", boxShadow: theme.shadow, padding: 42 }}>
        <div style={{ height: 340 }}>
          <KLineTerrain scene={scene} theme={theme} danger={scene.id.includes("2009")} />
        </div>
        <div style={{ position: "absolute", left: 70, right: 70, bottom: 48, height: 6, borderRadius: 999, background: theme.line }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 999, background: theme.gradient }} />
        </div>
        <div style={{ position: "absolute", left: 70, right: 70, bottom: 26, display: "grid", gridTemplateColumns: `repeat(${Math.max(1, items.length)}, 1fr)`, gap: 14 }}>
          {items.map((item, index) => {
            const on = progress >= (index + 0.2) / Math.max(1, items.length);
            return (
              <div key={`${item.label}-${index}`} style={{ opacity: on ? 1 : 0.28, transform: `translateY(${on ? 0 : 14}px)` }}>
                <div style={{ color: getAccent(index, theme), fontSize: 25, fontWeight: 980 }}>{item.label}</div>
                <div style={{ marginTop: 6, color: theme.ink, fontSize: 24, fontWeight: 900 }}>{clampText(item.title, 10)}</div>
                {item.note ? <div style={{ marginTop: 4, color: theme.muted, fontSize: 17, fontWeight: 760 }}>{clampText(item.note, 14)}</div> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TacticalDataScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const headline = scene.visualBrief?.headline ?? scene.title ?? "数据拆解";
  const hasRisk = /回撤|风险|-83|-84|-92|-52/.test(JSON.stringify(scene.visualBrief ?? scene.content ?? {}));

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 40, alignItems: "end" }}>
        <div>
          <div style={{ color: theme.primary, fontSize: 26, fontWeight: 930 }}>{scene.visualBrief?.kicker ?? "DATA SIGNAL"}</div>
          <div style={{ marginTop: 12, color: theme.ink, fontSize: fitChineseText(headline, 64, 42, 18), lineHeight: 1.04, fontWeight: theme.titleWeight }}>{headline}</div>
        </div>
        {scene.visualBrief?.primaryMetric ? (
          <div style={{ minWidth: 260, textAlign: "right" }}>
            <div style={{ color: theme.muted, fontSize: 22, fontWeight: 840 }}>{scene.visualBrief.primaryMetric.label}</div>
            <div style={{ color: theme.primary, fontSize: 66, lineHeight: 1, fontWeight: 980 }}>{scene.visualBrief.primaryMetric.value}</div>
          </div>
        ) : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.28fr 0.72fr", gap: 26, minHeight: 0 }}>
        <div style={{ borderRadius: 26, border: `1px solid ${theme.line}`, background: "rgba(255,255,255,0.74)", boxShadow: theme.shadow, padding: 28 }}>
          <KLineTerrain scene={scene} theme={theme} danger={hasRisk} />
        </div>
        <TacticalSideVisual scene={scene} theme={theme} hasRisk={hasRisk} />
      </div>
      <TacticalMetricRail scene={scene} theme={theme} />
    </div>
  );
};

const TacticalSystemScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const nodes = (scene.visualBrief?.nodes ?? scene.content?.nodes ?? []).map((node) =>
    typeof node === "string" ? { label: node } : node,
  );
  const positions = [
    { left: "7%", top: "16%" },
    { left: "39%", top: "5%" },
    { left: "70%", top: "18%" },
    { left: "39%", top: "58%" },
  ];

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.78fr 1.22fr", gap: 42, alignItems: "center" }}>
      <div>
        <div style={{ color: theme.secondary, fontSize: 26, fontWeight: 930 }}>{scene.visualBrief?.kicker ?? "SIGNAL MAP"}</div>
        <div style={{ marginTop: 14, color: theme.ink, fontSize: fitChineseText(scene.visualBrief?.headline ?? scene.title ?? "信号地图", 66, 42, 16), lineHeight: 1.05, fontWeight: theme.titleWeight }}>
          {scene.visualBrief?.headline ?? scene.title}
        </div>
        <div style={{ marginTop: 34 }}>
          <FlowRibbon theme={theme} reverse />
        </div>
      </div>
      <div style={{ position: "relative", height: 620, borderRadius: 30, border: `1px solid ${theme.line}`, background: "rgba(255,255,255,0.72)", boxShadow: theme.shadow, overflow: "hidden" }}>
        <svg width="100%" height="100%" viewBox="0 0 760 620" style={{ position: "absolute", inset: 0 }}>
          <path d="M170 180 C280 90, 480 90, 585 190" stroke={theme.primary} strokeWidth="8" fill="none" strokeDasharray={`${fade(frame, 10, 52) * 650} 650`} strokeLinecap="round" opacity="0.62" />
          <path d="M170 180 C300 350, 480 350, 585 190" stroke={theme.secondary} strokeWidth="8" fill="none" strokeDasharray={`${fade(frame, 18, 60) * 680} 680`} strokeLinecap="round" opacity="0.62" />
          <path d="M380 410 L380 190" stroke={theme.warning} strokeWidth="8" fill="none" strokeDasharray={`${fade(frame, 26, 68) * 360} 360`} strokeLinecap="round" opacity="0.54" />
        </svg>
        {nodes.slice(0, 4).map((node, index) => {
          const pos = positions[index] ?? positions[0];
          const enter = fade(frame, 16 + index * 7, 34 + index * 7);
          return (
            <div key={`${node.label}-${index}`} style={{ position: "absolute", ...pos, width: 182, minHeight: 128, opacity: enter, transform: `scale(${0.92 + enter * 0.08})`, borderRadius: 22, border: `1px solid ${getAccent(index, theme)}44`, background: "rgba(255,255,255,0.88)", boxShadow: `0 18px 52px ${getAccent(index, theme)}13`, padding: 22 }}>
              <div style={{ color: getAccent(index, theme), fontSize: 24, fontWeight: 980 }}>{clampText(node.label, 9)}</div>
              {node.role ? <div style={{ marginTop: 12, color: theme.muted, fontSize: 20, lineHeight: 1.2, fontWeight: 760 }}>{clampText(node.role, 12)}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TacticalContrastScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const cards = scene.visualBrief?.comparisonCards ?? scene.content?.comparisons ?? [];
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 30 }}>
      <div>
        <div style={{ color: theme.warning, fontSize: 26, fontWeight: 930 }}>{scene.visualBrief?.kicker ?? "RISK MAP"}</div>
        <div style={{ marginTop: 12, color: theme.ink, fontSize: fitChineseText(scene.visualBrief?.headline ?? scene.title ?? "风险对比", 66, 42, 18), lineHeight: 1.04, fontWeight: theme.titleWeight }}>
          {scene.visualBrief?.headline ?? scene.title}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, minHeight: 0 }}>
        {cards.slice(0, 2).map((card, index) => (
          <div key={card.label} style={{ position: "relative", overflow: "hidden", borderRadius: 28, border: `1px solid ${index === 0 ? theme.primary : theme.warning}42`, background: "rgba(255,255,255,0.76)", boxShadow: theme.shadow, padding: 40 }}>
            <div style={{ color: theme.muted, fontSize: 27, fontWeight: 880 }}>{card.label}</div>
            <div style={{ marginTop: 28, color: index === 0 ? theme.primary : theme.warning, fontSize: fitChineseText(card.value, 86, 56, 8), lineHeight: 0.95, fontWeight: 980 }}>{card.value}</div>
            <div style={{ position: "absolute", left: 40, right: 40, bottom: 44, height: 190, borderRadius: "18px 18px 40px 40px", background: `linear-gradient(180deg, transparent, ${index === 0 ? theme.primary : theme.warning}24)` }}>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: index === 0 ? "48%" : "86%", borderRadius: "18px 18px 40px 40px", background: index === 0 ? `${theme.primary}45` : `${theme.warning}48` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TacticalSummaryScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const items = scene.visualBrief?.summaryItems ?? scene.content?.summaryItems ?? briefTags(scene, ["规则", "现金", "执行力"]);
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44, alignItems: "center" }}>
      <div>
        <div style={{ color: theme.secondary, fontSize: 27, fontWeight: 930 }}>{scene.visualBrief?.kicker ?? "SUMMARY"}</div>
        <div style={{ marginTop: 14, color: theme.ink, fontSize: fitChineseText(scene.visualBrief?.headline ?? scene.title ?? "结论", 72, 46, 16), lineHeight: 1.04, fontWeight: theme.titleWeight }}>
          {scene.visualBrief?.headline ?? scene.title}
        </div>
        <div style={{ marginTop: 34 }}>
          <FlowRibbon theme={theme} />
        </div>
      </div>
      <div style={{ display: "grid", gap: 18 }}>
        {items.slice(0, 4).map((item, index) => (
          <div key={item} style={{ padding: "28px 32px", borderRadius: 22, border: `1px solid ${getAccent(index, theme)}38`, background: "rgba(255,255,255,0.82)", boxShadow: `0 18px 50px ${getAccent(index, theme)}12`, color: getAccent(index, theme), fontSize: 34, lineHeight: 1.12, fontWeight: 940 }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

const TacticalQuestionScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const headline = scene.visualBrief?.headline ?? scene.title ?? getMainLine(scene.subtitle, 18);
  const tags = briefTags(scene, ["不是二选一", "规则", "执行"]);
  const pulse = 0.94 + fade(frame, 14, 58) * 0.06;

  return (
    <div style={{ height: "100%", position: "relative", display: "grid", placeItems: "center", paddingBottom: 84 }}>
      <div style={{ position: "absolute", width: 720, height: 720, borderRadius: "50%", border: `2px solid ${theme.primary}20`, transform: `scale(${pulse})`, boxShadow: `0 0 0 80px ${theme.secondary}08` }} />
      <div style={{ position: "relative", textAlign: "center", maxWidth: 1180 }}>
        <div style={{ color: theme.primary, fontSize: 28, fontWeight: 930, marginBottom: 24 }}>{scene.visualBrief?.kicker ?? "核心问题"}</div>
        <div style={{ color: theme.ink, fontSize: fitChineseText(headline, 96, 62, 16), lineHeight: 1.02, fontWeight: theme.titleWeight }}>{headline}</div>
        <div style={{ margin: "42px auto 0", display: "flex", justifyContent: "center", gap: 18 }}>
          {tags.slice(0, 3).map((tag, index) => {
            const p = fade(frame, 20 + index * 8, 38 + index * 8);
            return (
              <div key={tag} style={{ opacity: p, transform: `translateY(${(1 - p) * 18}px)`, padding: "16px 22px", borderRadius: 999, border: `1px solid ${getAccent(index, theme)}34`, color: getAccent(index, theme), background: `${getAccent(index, theme)}12`, fontSize: 25, fontWeight: 900 }}>
                {tag}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TacticalWideMarketScene = ({ scene, theme, danger = false }: { scene: Scene; theme: Theme; danger?: boolean }) => {
  const frame = useCurrentFrame();
  const headline = scene.visualBrief?.headline ?? scene.title ?? "市场路径";
  const metric = scene.visualBrief?.primaryMetric;
  const lift = spring({ frame: frame - 8, fps: 30, config: { damping: 22, stiffness: 88 } });

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 24, paddingBottom: 94 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 40 }}>
        <div>
          <div style={{ color: danger ? theme.warning : theme.primary, fontSize: 26, fontWeight: 930 }}>{scene.visualBrief?.kicker ?? "MARKET TERRAIN"}</div>
          <div style={{ marginTop: 12, color: theme.ink, fontSize: fitChineseText(headline, 70, 46, 18), lineHeight: 1.03, fontWeight: theme.titleWeight }}>{headline}</div>
        </div>
        {metric ? (
          <div style={{ minWidth: 310, textAlign: "right", transform: `translateY(${(1 - lift) * 18}px)`, opacity: fade(frame, 10, 26) }}>
            <div style={{ color: theme.muted, fontSize: 22, fontWeight: 850 }}>{metric.label}</div>
            <div style={{ color: danger ? theme.warning : theme.primary, fontSize: 76, lineHeight: 1, fontWeight: 980 }}>{metric.value}</div>
          </div>
        ) : null}
      </div>
      <div style={{ minHeight: 0, position: "relative", borderRadius: 34, overflow: "hidden", border: `1px solid ${danger ? theme.warning : theme.primary}22`, background: "rgba(255,255,255,0.34)" }}>
        <div style={{ position: "absolute", inset: 34 }}>
          <KLineTerrain scene={scene} theme={theme} danger={danger} />
        </div>
        <div style={{ position: "absolute", left: 42, bottom: 34, display: "flex", gap: 14 }}>
          {briefTags(scene, danger ? ["风险", "回撤", "仓位"] : ["周期", "趋势", "节奏"]).slice(0, 3).map((tag, index) => (
            <div key={tag} style={{ padding: "12px 16px", borderRadius: 999, background: "rgba(255,255,255,0.72)", border: `1px solid ${getAccent(index, theme)}30`, color: getAccent(index, theme), fontSize: 21, fontWeight: 900 }}>
              {tag}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TacticalSignalDashboardScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const id = scene.id.toLowerCase();
  const headline = scene.visualBrief?.headline ?? scene.title ?? "信号面板";
  const gauges = id.includes("vix")
    ? [
        { label: "VIX", value: ">40", color: theme.warning },
        { label: "恐慌", value: "高", color: theme.secondary },
        { label: "动作", value: "等待", color: theme.primary },
      ]
    : id.includes("cape")
      ? [
          { label: "估值", value: ">70%", color: theme.warning },
          { label: "现金", value: "提高", color: theme.primary },
          { label: "买入", value: "放慢", color: theme.secondary },
        ]
      : [
          { label: "回撤", value: ">20%", color: theme.warning },
          { label: "恐慌", value: "共振", color: theme.secondary },
          { label: "仓位", value: "加速", color: theme.primary },
        ];

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.72fr 1.28fr", gap: 42, alignItems: "center", paddingBottom: 92 }}>
      <div>
        <div style={{ color: theme.secondary, fontSize: 26, fontWeight: 930 }}>{scene.visualBrief?.kicker ?? "SIGNAL CONTROL"}</div>
        <div style={{ marginTop: 14, color: theme.ink, fontSize: fitChineseText(headline, 68, 44, 16), lineHeight: 1.04, fontWeight: theme.titleWeight }}>{headline}</div>
        <div style={{ marginTop: 28, color: theme.muted, fontSize: 25, lineHeight: 1.32, fontWeight: 760 }}>{clampText(scene.visualBrief?.subhead ?? scene.content?.headline ?? "用信号决定仓位，而不是用情绪追涨杀跌。", 42)}</div>
      </div>
      <div style={{ position: "relative", height: 560 }}>
        <svg width="100%" height="100%" viewBox="0 0 900 560" style={{ position: "absolute", inset: 0 }}>
          <path d="M130 280 C260 110, 610 110, 760 280 C610 450, 260 450, 130 280Z" fill="none" stroke={theme.primary} strokeWidth="7" strokeDasharray={`${fade(frame, 10, 54) * 1440} 1440`} opacity="0.42" />
          <path d="M450 104 V456 M130 280 H760" stroke={theme.line} strokeWidth="3" strokeDasharray="16 18" opacity="0.7" />
        </svg>
        {gauges.map((item, index) => {
          const positions = [
            { left: 40, top: 150 },
            { left: 332, top: 20 },
            { left: 622, top: 150 },
          ];
          return (
            <div key={item.label} style={{ position: "absolute", width: 238, ...positions[index] }}>
              <SignalGauge label={item.label} value={item.value} color={item.color} mutedColor={theme.muted} delay={12 + index * 8} />
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 304, top: 308, width: 292, borderRadius: 28, padding: 28, background: "rgba(255,255,255,0.82)", border: `1px solid ${theme.secondary}32`, boxShadow: theme.shadow, textAlign: "center" }}>
          <div style={{ color: theme.muted, fontSize: 20, fontWeight: 850 }}>最终动作</div>
          <div style={{ marginTop: 12, color: theme.secondary, fontSize: 44, fontWeight: 980 }}>仓位调整</div>
        </div>
      </div>
    </div>
  );
};

const TacticalComparisonBoardScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const cards = scene.visualBrief?.comparisonCards ?? scene.content?.comparisons ?? tacticalMetricCards(scene);
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.72fr 1.28fr", gap: 40, alignItems: "center", paddingBottom: 96 }}>
      <div>
        <div style={{ color: theme.warning, fontSize: 26, fontWeight: 930 }}>{scene.visualBrief?.kicker ?? "CONTRAST"}</div>
        <div style={{ marginTop: 14, color: theme.ink, fontSize: fitChineseText(scene.visualBrief?.headline ?? scene.title ?? "对比", 68, 44, 16), lineHeight: 1.04, fontWeight: theme.titleWeight }}>{scene.visualBrief?.headline ?? scene.title}</div>
      </div>
      <div style={{ display: "grid", gap: 22 }}>
        {cards.slice(0, 3).map((card, index) => {
          const color = index === 0 ? theme.primary : index === 1 ? theme.warning : theme.secondary;
          return (
            <div key={`${card.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "230px 1fr 210px", alignItems: "center", gap: 22, padding: "26px 30px", borderRadius: 24, background: "rgba(255,255,255,0.78)", border: `1px solid ${color}32`, boxShadow: `0 18px 48px ${color}12` }}>
              <div style={{ color: theme.muted, fontSize: 24, fontWeight: 860 }}>{card.label}</div>
              <div style={{ height: 24, borderRadius: 999, background: "#eaf2f8", overflow: "hidden" }}>
                <div style={{ width: `${index === 0 ? 54 : index === 1 ? 88 : 72}%`, height: "100%", borderRadius: 999, background: color }} />
              </div>
              <div style={{ color, textAlign: "right", fontSize: fitChineseText(card.value, 48, 34, 8), fontWeight: 980 }}>{card.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TacticalSceneVisual = ({ scene, directorType, theme }: { scene: Scene; directorType?: DirectorSceneType; theme: Theme }) => {
  const id = scene.id.toLowerCase();
  if (id.includes("signal-overview")) return <TacticalSignalNetworkScene scene={scene} theme={theme} />;
  if (id.includes("cape")) return <TacticalValuationThermometerScene scene={scene} theme={theme} />;
  if (id.includes("dd-signal")) return <TacticalDrawdownTriggerScene scene={scene} theme={theme} />;
  if (id.includes("vix")) return <TacticalVolatilityWaveScene scene={scene} theme={theme} />;
  if (id.includes("execution")) return <TacticalRuleEngineScene scene={scene} theme={theme} />;
  if (id.includes("kline-terrain") || id.includes("2009") || id.includes("drawdown")) return <TacticalWideMarketScene scene={scene} theme={theme} danger={id.includes("drawdown") || id.includes("2009")} />;
  if (id.includes("decision")) return <TacticalTimelineScene scene={scene} theme={theme} />;
  if (id.includes("signal")) return <TacticalSignalDashboardScene scene={scene} theme={theme} />;
  if (id.includes("result") || id.includes("tqqq-return") || id.includes("strategy-lineup")) return <TacticalComparisonBoardScene scene={scene} theme={theme} />;
  if (id.includes("opening") || id.includes("turning") || id.includes("ammo") || id.includes("execution")) return <TacticalQuestionScene scene={scene} theme={theme} />;
  if (directorType === "Hero") return <TacticalHeroScene scene={scene} theme={theme} />;
  if (directorType === "Timeline") return <TacticalTimelineScene scene={scene} theme={theme} />;
  if (directorType === "SystemMap") return <TacticalSystemScene scene={scene} theme={theme} />;
  if (directorType === "DataExplosion" || directorType === "Pricing" || directorType === "SpecSheet") return <TacticalDataScene scene={scene} theme={theme} />;
  if (directorType === "Contrast") return <TacticalContrastScene scene={scene} theme={theme} />;
  if (directorType === "Summary") return <TacticalSummaryScene scene={scene} theme={theme} />;
  return <TacticalDataScene scene={scene} theme={theme} />;
};

const JSpaceBackground = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 180], [0, 1], { extrapolateRight: "clamp", easing: ease });
  const accent = scene.directorType === "Hero" ? "#7c3aed" : "#0ea5e9";

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "linear-gradient(135deg,#fbfbff 0%,#eef7ff 52%,#f6fff8 100%)" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 18% 28%, rgba(124,58,237,0.16), transparent 32%), radial-gradient(circle at 76% 34%, rgba(14,165,233,0.14), transparent 30%), radial-gradient(circle at 54% 82%, rgba(16,185,129,0.12), transparent 34%)",
          transform: `translate3d(${drift * 18}px, ${drift * -10}px, 0)`,
        }}
      />
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, opacity: 0.58 }}>
        {[0, 1, 2, 3, 4].map((index) => {
          const y = 190 + index * 145;
          const dash = 520 - fade(frame - index * 12, 0, 50) * 520;
          return (
            <path
              key={index}
              d={`M${180 + index * 42} ${y} C ${520 + index * 26} ${y - 120}, ${900 - index * 38} ${y + 110}, ${1340 + index * 48} ${y - 18} S ${1660} ${y + 86}, 1810 ${y - 42}`}
              fill="none"
              stroke={index % 2 === 0 ? accent : "#14b8a6"}
              strokeWidth={index === 0 ? 3 : 2}
              strokeDasharray="520"
              strokeDashoffset={dash}
              strokeLinecap="round"
              opacity={0.2 + index * 0.055}
            />
          );
        })}
      </svg>
      {[0, 1, 2, 3, 4, 5, 6].map((index) => {
        const left = [250, 520, 760, 1080, 1380, 1580, 910][index];
        const top = [220, 690, 360, 760, 250, 610, 160][index];
        const pulse = 0.86 + fade(frame - index * 8, 0, 34) * 0.14;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left,
              top,
              width: 12 + (index % 3) * 5,
              height: 12 + (index % 3) * 5,
              borderRadius: 999,
              background: index % 2 === 0 ? accent : "#14b8a6",
              boxShadow: `0 0 34px ${index % 2 === 0 ? "rgba(124,58,237,0.28)" : "rgba(20,184,166,0.26)"}`,
              opacity: 0.4,
              transform: `scale(${pulse})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const JSpaceToken = ({ text, index }: { text: string; index: number }) => {
  const frame = useCurrentFrame();
  const local = frame - 20 - index * 10;
  const show = fade(local, 0, 20);
  const y = slide(local, 0, 28, 34);
  const colors = ["#7c3aed", "#0ea5e9", "#ef4444"];

  return (
    <div
      style={{
        opacity: show,
        transform: `translateY(${y}px)`,
        padding: "14px 22px",
        borderRadius: 999,
        background: "#ffffffcc",
        border: `1px solid ${colors[index % colors.length]}55`,
        color: colors[index % colors.length],
        fontSize: 27,
        fontWeight: 920,
        boxShadow: "0 18px 42px rgba(31,41,55,0.10)",
        backdropFilter: "blur(10px)",
      }}
    >
      {text}
    </div>
  );
};

const JSpaceHeroScene = ({ scene }: { scene: Scene }) => {
  const frame = useCurrentFrame();
  const brief = caseBrief(scene);
  const headline = brief.headline ?? scene.title ?? "Claude 没说出口的念头";
  const subhead = brief.subhead ?? "主画面只解释内部信号，不复述整句字幕";
  const tags = brief.tags?.length ? brief.tags : scene.emphasis?.slice(1, 4) ?? ["关键词", "信号", "结论"];
  const core = spring({ frame: frame - 8, fps: 30, config: { damping: 18, stiffness: 120 } });
  const ring = interpolate(frame, [0, 150], [0, 12], { extrapolateRight: "clamp", easing: ease });

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 0.92fr", alignItems: "center", gap: 70 }}>
      <div>
        <div style={{ color: "#7c3aed", fontSize: 28, fontWeight: 950, letterSpacing: 0, marginBottom: 22 }}>CONSCIOUS ACCESS</div>
        <div style={{ color: "#111827", fontSize: 88, lineHeight: 1.02, fontWeight: 960, maxWidth: 760 }}>{headline}</div>
        <div style={{ marginTop: 30, color: "#475569", fontSize: 30, lineHeight: 1.34, fontWeight: 760, maxWidth: 740 }}>{subhead}</div>
        <div style={{ marginTop: 44, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {tags.map((tag, index) => (
            <JSpaceToken key={tag} text={tag} index={index} />
          ))}
        </div>
      </div>
      <div style={{ position: "relative", height: 640 }}>
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 70,
            width: 520,
            height: 520,
            borderRadius: 999,
            background: "linear-gradient(145deg,rgba(255,255,255,0.86),rgba(238,242,255,0.68))",
            border: "1px solid rgba(124,58,237,0.22)",
            boxShadow: "0 40px 120px rgba(79,70,229,0.16)",
            transform: `scale(${0.82 + core * 0.18})`,
          }}
        />
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: 72 + index * 46,
              top: 70 + index * 46,
              width: 520 - index * 92,
              height: 520 - index * 92,
              borderRadius: 999,
              border: `${index === 0 ? 3 : 2}px solid ${index === 0 ? "rgba(124,58,237,0.30)" : "rgba(14,165,233,0.22)"}`,
              transform: `rotate(${ring * (index % 2 === 0 ? 1 : -1)}deg)`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 205,
            top: 218,
            width: 260,
            height: 220,
            borderRadius: 36,
            background: "#111827",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 30px 90px rgba(17,24,39,0.26)",
            transform: `translateY(${slide(frame, 8, 32, 24)}px)`,
            opacity: fade(frame, 6, 24),
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#93c5fd", fontSize: 24, fontWeight: 880 }}>CLAUDE</div>
            <div style={{ marginTop: 14, color: "#fff", fontSize: 54, fontWeight: 960 }}>J-space</div>
            <div style={{ marginTop: 12, color: "#a7f3d0", fontSize: 22, fontWeight: 880 }}>silent layer</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const JSpaceMapScene = ({ scene }: { scene: Scene }) => {
  const frame = useCurrentFrame();
  const brief = caseBrief(scene);
  const nodes = (brief.nodes?.length ? brief.nodes : [
    { label: "输入文本", role: "visible" },
    { label: "J-space", role: "workspace" },
    { label: "内部激活", role: "silent" },
    { label: "可报告词语", role: "output-ready" },
  ]).slice(0, 5);
  const path = fade(frame, 10, 62);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.78fr 1.22fr", alignItems: "center", gap: 72 }}>
      <div>
        <div style={{ color: "#0ea5e9", fontSize: 28, fontWeight: 950, marginBottom: 22 }}>INTERNAL WORKSPACE</div>
        <div style={{ color: "#111827", fontSize: 74, lineHeight: 1.02, fontWeight: 960 }}>{brief.headline ?? "J-space：负责“想”的区域"}</div>
        <div style={{ marginTop: 28, color: "#475569", fontSize: 30, lineHeight: 1.34, fontWeight: 760 }}>{brief.subhead ?? "不是输出文本，也不是思维链。"}</div>
      </div>
      <div style={{ position: "relative", height: 700 }}>
        <svg width="100%" height="100%" viewBox="0 0 1080 700" style={{ position: "absolute", inset: 0 }}>
          <path
            d="M110 355 C 330 120, 600 120, 820 350 C 610 590, 330 590, 110 355"
            fill="rgba(255,255,255,0.42)"
            stroke="rgba(14,165,233,0.30)"
            strokeWidth="3"
          />
          <path
            d="M120 350 C 325 245, 530 245, 730 350 S 940 455, 1010 350"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="5"
            strokeDasharray="980"
            strokeDashoffset={980 - path * 980}
            strokeLinecap="round"
          />
          <path
            d="M160 430 C 380 520, 610 520, 880 410"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="4"
            strokeDasharray="820"
            strokeDashoffset={820 - path * 820}
            strokeLinecap="round"
            opacity="0.72"
          />
        </svg>
        <div style={{ position: "absolute", left: 360, top: 210, width: 340, height: 260, borderRadius: 44, background: "#ffffffd9", border: "1px solid rgba(14,165,233,0.24)", boxShadow: "0 34px 100px rgba(14,165,233,0.16)", display: "grid", placeItems: "center", opacity: fade(frame, 6, 22) }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#0ea5e9", fontSize: 24, fontWeight: 900 }}>WORKSPACE</div>
            <div style={{ marginTop: 18, color: "#111827", fontSize: 62, fontWeight: 970 }}>J-space</div>
          </div>
        </div>
        {nodes.filter((node) => node.label !== "J-space").map((node, index) => {
          const positions = [
            { left: 20, top: 115 },
            { left: 775, top: 95 },
            { left: 780, top: 500 },
            { left: 80, top: 500 },
          ];
          const pos = positions[index] ?? positions[0];
          const local = frame - 22 - index * 9;
          return (
            <div
              key={`${node.label}-${index}`}
              style={{
                position: "absolute",
                left: pos.left,
                top: pos.top,
                width: 250,
                minHeight: 118,
                padding: "22px 24px",
                borderRadius: 28,
                background: "#ffffffd9",
                border: "1px solid rgba(15,23,42,0.10)",
                boxShadow: "0 20px 54px rgba(15,23,42,0.10)",
                opacity: fade(local, 0, 18),
                transform: `translateY(${slide(local, 0, 22, 22)}px)`,
              }}
            >
              <div style={{ color: index % 2 === 0 ? "#7c3aed" : "#14b8a6", fontSize: 21, fontWeight: 900 }}>{node.role}</div>
              <div style={{ marginTop: 10, color: "#111827", fontSize: 31, lineHeight: 1.08, fontWeight: 930 }}>{node.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const JSpaceSceneVisual = ({ scene, directorType }: { scene: Scene; directorType?: DirectorSceneType }) => {
  if (directorType === "SystemMap" || scene.sceneType === "relationship-map") return <JSpaceMapScene scene={scene} />;
  return <JSpaceHeroScene scene={scene} />;
};

const CaseWorkflowBackground = ({ theme }: { theme: Theme }) => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [0, 90], [0.86, 1], { extrapolateRight: "clamp", easing: ease });
  const sweep = interpolate(frame, [0, 150], [-260, 1920], { extrapolateRight: "clamp", easing: ease });

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#050b13" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 35% 38%, rgba(20,184,166,0.22), transparent 33%), radial-gradient(circle at 68% 45%, rgba(251,191,36,0.14), transparent 34%), linear-gradient(135deg, #050b13 0%, #071622 52%, #030711 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.18,
          backgroundImage: "linear-gradient(rgba(148,163,184,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)",
          backgroundSize: "88px 88px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -120,
          top: 110,
          width: 760,
          height: 760,
          borderRadius: 999,
          border: "1px solid rgba(20,184,166,0.16)",
          transform: `scale(${glow})`,
          boxShadow: "0 0 120px rgba(20,184,166,0.16)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: sweep,
          top: 0,
          width: 280,
          height: 1080,
          transform: "skewX(-18deg)",
          background: "linear-gradient(90deg, transparent, rgba(20,184,166,0.1), transparent)",
          filter: "blur(14px)",
        }}
      />
    </AbsoluteFill>
  );
};

const CasePanel = ({
  children,
  style,
  delay = 0,
  accent,
}: {
  children: ReactNode;
  style?: CSSProperties;
  delay?: number;
  accent?: string;
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const opacity = fade(local, 0, 18);
  const y = slide(local, 0, 22, 22);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        borderRadius: 26,
        background: "linear-gradient(180deg, rgba(10,20,32,0.92), rgba(6,14,24,0.84))",
        border: `1px solid ${accent ?? "rgba(94,234,212,0.22)"}`,
        boxShadow: "0 30px 110px rgba(0,0,0,0.42)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const CaseProgress = ({ value, color = "#5eead4", delay = 0 }: { value: number; color?: string; delay?: number }) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame - delay, [0, 38], [0, clamp(value, 8, 100)], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return (
    <div style={{ height: 12, borderRadius: 999, background: "rgba(148,163,184,0.16)", overflow: "hidden" }}>
      <div style={{ width: `${width}%`, height: "100%", borderRadius: 999, background: color, boxShadow: `0 0 24px ${color}66` }} />
    </div>
  );
};

const CaseHeroScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const brief = caseBrief(scene);
  const title = brief.headline ?? scene.title ?? "核心观点";
  const subhead = brief.subhead ?? "关键信息解读";
  const heroKicker = brief.heroKicker ?? "MODEL RELEASE";
  const heroLabel = brief.heroLabel ?? "TOPIC";
  const heroMark = brief.heroMark ?? "KEY";
  const heroStatus = brief.heroStatus ?? "FOCUS";
  const logo = spring({ frame: frame - 8, fps: 30, config: { damping: 15, stiffness: 120 } });
  const titleY = slide(frame, 12, 34, 34);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.92fr 1.08fr", alignItems: "center", gap: 70 }}>
      <div style={{ opacity: fade(frame, 10, 26), transform: `translateY(${titleY}px)` }}>
        <div style={{ color: "#5eead4", fontSize: 30, fontWeight: 900, marginBottom: 24 }}>{heroKicker}</div>
        <div style={{ color: "#f8fafc", fontSize: 86, lineHeight: 1.02, fontWeight: 940 }}>{title}</div>
        <div style={{ marginTop: 22, color: "#cbd5e1", fontSize: 34, lineHeight: 1.22, fontWeight: 760 }}>{subhead}</div>
        <div style={{ marginTop: 44, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {(brief.tags ?? ["基础设施重建", "真实业务打磨", "正式发布"]).slice(0, 3).map((tag, index) => (
            <div key={tag} style={{ padding: "12px 18px", borderRadius: 999, background: `${getAccent(index, theme)}1f`, border: `1px solid ${getAccent(index, theme)}55`, color: getAccent(index, theme), fontSize: 25, fontWeight: 880 }}>
              {tag}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "relative", height: 610, display: "grid", placeItems: "center" }}>
        <div style={{ position: "absolute", width: 430, height: 430, borderRadius: 999, border: "2px solid rgba(94,234,212,0.22)", boxShadow: "0 0 80px rgba(20,184,166,0.2)" }} />
        <div style={{ position: "absolute", width: 560, height: 560, borderRadius: 999, border: "1px dashed rgba(96,165,250,0.32)" }} />
        <CasePanel
          delay={8}
          accent="rgba(94,234,212,0.36)"
          style={{
            width: 390,
            height: 390,
            display: "grid",
            placeItems: "center",
            transform: `scale(${0.86 + logo * 0.14})`,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#5eead4", fontSize: 30, fontWeight: 920, marginBottom: 18 }}>{heroLabel}</div>
            <div style={{ color: "#f8fafc", fontSize: 92, lineHeight: 0.94, fontWeight: 960 }}>{heroMark}</div>
            <div style={{ marginTop: 24, color: "#fbbf24", fontSize: 28, fontWeight: 860 }}>{heroStatus}</div>
          </div>
        </CasePanel>
      </div>
    </div>
  );
};

const CaseTimelineScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const brief = caseBrief(scene);
  const items = (brief.timelineItems?.length ? brief.timelineItems : [
    { label: "1月底", title: "重建基础设施", note: "预训练 / 强化学习" },
    { label: "4月", title: "Preview 上线", note: "首个阶段成果" },
    { label: "7月6日", title: "正式版发布", note: "真实场景打磨" },
  ]).slice(0, 4);
  const progress = interpolate(frame, [12, 68], [0, 1], { extrapolateRight: "clamp", easing: ease });

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 54 }}>
      <div>
        <div style={{ color: "#5eead4", fontSize: 28, fontWeight: 900, marginBottom: 16 }}>{brief.kicker ?? "RELEASE PATH"}</div>
        <div style={{ color: "#f8fafc", fontSize: 70, lineHeight: 1.05, fontWeight: 930 }}>{brief.headline ?? "从重建到正式发布"}</div>
      </div>
      <CasePanel style={{ padding: "52px 66px", position: "relative" }} delay={8}>
        <div style={{ position: "absolute", left: 84, right: 84, top: 174, height: 8, borderRadius: 999, background: "rgba(148,163,184,0.18)" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#60a5fa,#5eead4,#fbbf24)" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 32 }}>
          {items.map((item, index) => {
            const local = frame - 18 - index * 10;
            const active = fade(local, 0, 18);
            return (
              <div key={`${item.label}-${item.title}`} style={{ opacity: active, transform: `translateY(${slide(local, 0, 24, 20)}px)`, textAlign: "center" }}>
                <div style={{ color: getAccent(index, theme), fontSize: 28, lineHeight: 1.05, fontWeight: 930 }}>{item.label}</div>
                <div style={{ margin: "38px auto 32px", width: 86, height: 86, borderRadius: 999, background: getAccent(index, theme), boxShadow: `0 0 34px ${getAccent(index, theme)}55` }} />
                <div style={{ color: "#f8fafc", fontSize: 34, lineHeight: 1.1, fontWeight: 900 }}>{item.title}</div>
                <div style={{ marginTop: 14, color: "#94a3b8", fontSize: 23, lineHeight: 1.25, fontWeight: 720 }}>{item.note}</div>
              </div>
            );
          })}
        </div>
      </CasePanel>
    </div>
  );
};

const CaseSystemMapScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const brief = caseBrief(scene);
  const nodes = (brief.nodes?.length ? brief.nodes : ["输入", "处理", "判断", "输出", "影响"].map((label) => ({ label, role: "信息节点" }))).slice(0, 5);
  const centerKicker = brief.centerKicker ?? (brief.nodes?.some((node) => node.label === "J-space") ? "WORKSPACE" : "CORE");
  const centerLabel = brief.centerLabel ?? (brief.nodes?.some((node) => node.label === "J-space") ? "J-space" : "主题");
  const draw = interpolate(frame, [16, 58], [0, 1], { extrapolateRight: "clamp", easing: ease });
  const positions = [
    { left: 170, top: 110 },
    { left: 760, top: 110 },
    { left: 1000, top: 350 },
    { left: 610, top: 565 },
    { left: 230, top: 470 },
  ];

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "420px 1fr", gap: 50, alignItems: "center" }}>
      <div>
        <div style={{ color: "#fbbf24", fontSize: 28, fontWeight: 900, marginBottom: 18 }}>{brief.kicker ?? "ECOSYSTEM"}</div>
        <div style={{ color: "#f8fafc", fontSize: 68, lineHeight: 1.05, fontWeight: 930 }}>{brief.headline ?? "业务接入网络"}</div>
        <div style={{ marginTop: 32, color: "#94a3b8", fontSize: 28, lineHeight: 1.34, fontWeight: 760 }}>{brief.subhead ?? "画面只展示业务节点，不重复口播句子。"}</div>
      </div>
      <div style={{ position: "relative", height: 720 }}>
        <svg width="100%" height="100%" viewBox="0 0 1220 720" style={{ position: "absolute", inset: 0 }}>
          {positions.map((pos, index) => (
            <path
              key={index}
              d={`M610 360 C ${pos.left + 80} ${pos.top + 70}, ${pos.left + 120} ${pos.top + 40}, ${pos.left + 150} ${pos.top + 70}`}
              fill="none"
              stroke={getAccent(index, theme)}
              strokeWidth="5"
              strokeDasharray="800"
              strokeDashoffset={800 - draw * 800}
              opacity="0.68"
              strokeLinecap="round"
            />
          ))}
        </svg>
        <CasePanel delay={8} accent="rgba(94,234,212,0.42)" style={{ position: "absolute", left: 450, top: 245, width: 320, height: 230, display: "grid", placeItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#5eead4", fontSize: 26, fontWeight: 930 }}>{centerKicker}</div>
            <div style={{ marginTop: 18, color: "#f8fafc", fontSize: 58, fontWeight: 960 }}>{centerLabel}</div>
          </div>
        </CasePanel>
        {nodes.map((node, index) => {
          const pos = positions[index];
          return (
            <CasePanel key={node.label} delay={20 + index * 7} accent={`${getAccent(index, theme)}66`} style={{ position: "absolute", left: pos.left, top: pos.top, width: 260, minHeight: 122, padding: "24px 28px" }}>
              <div style={{ color: getAccent(index, theme), fontSize: 24, fontWeight: 920 }}>{node.role ?? "业务节点"}</div>
              <div style={{ marginTop: 12, color: "#f8fafc", fontSize: 34, lineHeight: 1.05, fontWeight: 910 }}>{node.label}</div>
            </CasePanel>
          );
        })}
      </div>
    </div>
  );
};

const CaseDataScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const brief = caseBrief(scene);
  const cards = (brief.metricCards?.length ? brief.metricCards : scene.content?.metrics ?? [{ label: "核心指标", value: getMetric(scene), note: "业务验证" }]).slice(0, 4);
  const bars: Array<{ label: string; value: number; color?: string }> = brief.bars ?? cards.map((card, index) => ({ label: card.label, value: 50 + index * 12 }));

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "0.88fr 1.12fr", gap: 46, alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ color: "#5eead4", fontSize: 28, fontWeight: 900, marginBottom: 18 }}>{brief.kicker ?? "DATA BOARD"}</div>
        <div style={{ color: "#f8fafc", fontSize: 68, lineHeight: 1.05, fontWeight: 930 }}>{brief.headline ?? "关键指标放大"}</div>
        <div style={{ marginTop: 34, display: "grid", gap: 16 }}>
          {cards.map((card, index) => (
            <CasePanel key={`${card.label}-${card.value}`} delay={14 + index * 8} accent={`${getAccent(index, theme)}55`} style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
                <div>
                  <div style={{ color: "#94a3b8", fontSize: 23, fontWeight: 780 }}>{card.label}</div>
                  <div style={{ marginTop: 8, color: "#f8fafc", fontSize: 35, fontWeight: 900 }}>{card.note ?? "真实业务场景"}</div>
                </div>
                <div style={{ color: getAccent(index, theme), fontSize: 52, lineHeight: 0.9, fontWeight: 960 }}>{card.value}</div>
              </div>
            </CasePanel>
          ))}
        </div>
      </div>
      <CasePanel delay={10} style={{ padding: "38px 42px 42px", display: "grid", gridTemplateRows: "auto 1fr", gap: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#f8fafc", fontSize: 34, fontWeight: 910 }}>指标仪表</div>
          <div style={{ color: "#fbbf24", fontSize: 24, fontWeight: 860 }}>LIVE SIGNAL</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${bars.length}, 1fr)`, gap: 24, alignItems: "stretch", paddingTop: 18 }}>
          {bars.map((bar, index) => {
            const h = interpolate(frame - 18 - index * 6, [0, 42], [8, Math.min(bar.value, 86)], { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: ease });
            return (
              <div key={`${bar.label}-${index}`} style={{ height: "100%", display: "grid", gridTemplateRows: "58px 1fr", gap: 18 }}>
                <div style={{ color: "#cbd5e1", fontSize: 22, lineHeight: 1.14, fontWeight: 820, textAlign: "center", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>{bar.label}</div>
                <div style={{ height: "100%", display: "flex", alignItems: "end" }}>
                  <div style={{ width: "100%", height: `${h}%`, minHeight: 40, borderRadius: "18px 18px 8px 8px", background: bar.color ?? getAccent(index, theme), boxShadow: `0 0 32px ${(bar.color ?? getAccent(index, theme))}44` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CasePanel>
    </div>
  );
};

const CaseSpecScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const brief = caseBrief(scene);
  const items = (brief.boardItems?.length ? brief.boardItems : brief.metricCards ?? [
    { label: "架构", value: "MoE", note: "快慢思考融合" },
    { label: "总参数", value: "295B", note: "能力上限" },
    { label: "激活参数", value: "21B", note: "控制推理成本" },
    { label: "上下文", value: "256K", note: "长文任务" },
  ]).slice(0, 6);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "430px 1fr", gap: 46, alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ color: "#60a5fa", fontSize: 28, fontWeight: 900, marginBottom: 18 }}>{brief.kicker ?? "SPEC SHEET"}</div>
        <div style={{ color: "#f8fafc", fontSize: 66, lineHeight: 1.05, fontWeight: 930 }}>{brief.headline ?? "技术参数面板"}</div>
      </div>
      <CasePanel delay={10} style={{ padding: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 22 }}>
          {items.map((item, index) => (
            <CasePanel key={`${item.label}-${item.value}`} delay={18 + index * 6} accent={`${getAccent(index, theme)}55`} style={{ padding: "28px 30px", minHeight: 164, background: "rgba(15,23,42,0.66)" }}>
              <div style={{ color: getAccent(index, theme), fontSize: 24, fontWeight: 900 }}>{item.label}</div>
              <div style={{ marginTop: 16, color: "#f8fafc", fontSize: 50, lineHeight: 0.98, fontWeight: 960 }}>{item.value}</div>
              <div style={{ marginTop: 16, color: "#94a3b8", fontSize: 23, lineHeight: 1.18, fontWeight: 760 }}>{item.note}</div>
            </CasePanel>
          ))}
        </div>
      </CasePanel>
    </div>
  );
};

const CaseContrastScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const brief = caseBrief(scene);
  const cards = (brief.comparisonCards?.length ? brief.comparisonCards : [
    { label: "外层变化", value: "模型发布" },
    { label: "内层价值", value: "业务可用性" },
  ]).slice(0, 2);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 42 }}>
      <div>
        <div style={{ color: "#fbbf24", fontSize: 28, fontWeight: 900, marginBottom: 18 }}>{brief.kicker ?? "CONTRAST"}</div>
        <div style={{ color: "#f8fafc", fontSize: 68, lineHeight: 1.05, fontWeight: 930 }}>{brief.headline ?? "真正差异"}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34 }}>
        {cards.map((card, index) => (
          <CasePanel key={card.label} delay={12 + index * 12} accent={`${getAccent(index, theme)}66`} style={{ padding: "58px 60px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ color: getAccent(index, theme), fontSize: 30, fontWeight: 920 }}>{card.label}</div>
            <div style={{ color: "#f8fafc", fontSize: 72, lineHeight: 1.06, fontWeight: 940 }}>{card.value}</div>
            <CaseProgress value={index === 0 ? 58 : 92} color={getAccent(index, theme)} delay={28 + index * 10} />
          </CasePanel>
        ))}
      </div>
    </div>
  );
};

const CasePricingScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const brief = caseBrief(scene);
  const cards = (brief.metricCards?.length ? brief.metricCards : [
    { label: "输入", value: "¥1", note: "百万 tokens" },
    { label: "输出", value: "¥4", note: "百万 tokens" },
    { label: "缓存命中", value: "¥0.25", note: "百万 tokens" },
  ]).slice(0, 3);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 44 }}>
      <div>
        <div style={{ color: "#fbbf24", fontSize: 28, fontWeight: 900, marginBottom: 18 }}>{brief.kicker ?? "PRICING"}</div>
        <div style={{ color: "#f8fafc", fontSize: 70, lineHeight: 1.04, fontWeight: 930 }}>{brief.headline ?? "价格面板"}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
        {cards.map((card, index) => (
          <CasePanel key={card.label} delay={12 + index * 9} accent={`${getAccent(index, theme)}66`} style={{ padding: "46px 42px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ color: getAccent(index, theme), fontSize: 30, fontWeight: 920 }}>{card.label}</div>
            <div style={{ color: "#f8fafc", fontSize: 92, lineHeight: 0.9, fontWeight: 970 }}>{card.value}</div>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 27, fontWeight: 780, marginBottom: 18 }}>{card.note}</div>
              <CaseProgress value={[72, 92, 36][index] ?? 60} color={getAccent(index, theme)} delay={32 + index * 8} />
            </div>
          </CasePanel>
        ))}
      </div>
    </div>
  );
};

const CaseSummaryScene = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const brief = caseBrief(scene);
  const items = brief.summaryItems?.length ? brief.summaryItems : ["真实业务验证", "成本更低", "开源可商用"];

  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
      <CasePanel delay={8} accent="rgba(94,234,212,0.38)" style={{ width: 1320, minHeight: 580, padding: "72px 82px" }}>
        <div style={{ color: "#5eead4", fontSize: 30, fontWeight: 920, marginBottom: 24 }}>{brief.kicker ?? "FINAL BOARD"}</div>
        <div style={{ color: "#f8fafc", fontSize: 76, lineHeight: 1.04, fontWeight: 940 }}>{brief.headline ?? "一次实用主义升级"}</div>
        <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
          {items.slice(0, 3).map((item, index) => (
            <CasePanel key={item} delay={24 + index * 8} accent={`${getAccent(index, theme)}55`} style={{ padding: "30px 28px", background: "rgba(15,23,42,0.66)" }}>
              <div style={{ width: 46, height: 46, borderRadius: 999, background: getAccent(index, theme), boxShadow: `0 0 28px ${getAccent(index, theme)}55`, marginBottom: 26 }} />
              <div style={{ color: "#f8fafc", fontSize: 36, lineHeight: 1.12, fontWeight: 900 }}>{item}</div>
            </CasePanel>
          ))}
        </div>
      </CasePanel>
    </div>
  );
};

const CaseSceneVisual = ({ scene, directorType, theme }: { scene: Scene; directorType?: DirectorSceneType; theme: Theme }) => {
  if (directorType === "Hero") return <CaseHeroScene scene={scene} theme={theme} />;
  if (directorType === "Timeline") return <CaseTimelineScene scene={scene} theme={theme} />;
  if (directorType === "SystemMap") return <CaseSystemMapScene scene={scene} theme={theme} />;
  if (directorType === "DataExplosion") return <CaseDataScene scene={scene} theme={theme} />;
  if (directorType === "Contrast") return <CaseContrastScene scene={scene} theme={theme} />;
  if (directorType === "SpecSheet") return <CaseSpecScene scene={scene} theme={theme} />;
  if (directorType === "Pricing") return <CasePricingScene scene={scene} theme={theme} />;
  if (directorType === "Summary") return <CaseSummaryScene scene={scene} theme={theme} />;
  return <CaseDataScene scene={scene} theme={theme} />;
};

const normalizeComponentName = (value: string) => value.replace(/[\s_-]/g, "").toLowerCase();

const sceneText = (scene: Scene) =>
  [
    scene.title,
    scene.subtitle,
    scene.content?.headline,
    scene.visualBrief?.headline,
    ...(scene.content?.keywords ?? []),
    ...(scene.emphasis ?? []),
    ...(scene.visualBrief?.tags ?? []),
    ...(scene.components ?? []),
  ]
    .filter(Boolean)
    .join(" ");

const hasComponent = (scene: Scene, names: string[]) => {
  const normalized = new Set(names.map(normalizeComponentName));
  return (scene.components ?? []).some((component) => normalized.has(normalizeComponentName(component)));
};

const directorMainText = (scene: Scene, fallbackMax = 14) =>
  scene.mainVisualText?.length
    ? scene.mainVisualText.map((line) => clampText(line, fallbackMax)).filter(Boolean)
    : [scene.content?.headline ?? scene.visualBrief?.headline ?? getMainLine(scene.subtitle, fallbackMax)].filter(Boolean);

const contentStringList = (scene: Scene, keys: Array<keyof NonNullable<Scene["content"]>>, max = 6) => {
  const values: string[] = [];
  for (const key of keys) {
    const value = scene.content?.[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") values.push(item);
        else if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const label = record.label ?? record.name ?? record.node ?? record.visual;
          if (typeof label === "string") values.push(label);
        }
      }
    } else if (typeof value === "string") {
      values.push(value);
    } else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const label = record.node ?? record.label ?? record.name;
      if (typeof label === "string") values.push(label);
    }
  }
  return [...new Set(values.filter(Boolean))].slice(0, max);
};

const v5MetricItems = (scene: Scene, fallback: MetricItem[] = []): MetricItem[] => {
  const content = scene.content;
  const barriers = content?.barriers?.map((item) => ({ label: item.label, value: item.visual ?? item.shape ?? item.label, note: item.shape }));
  const layers = content?.layers?.map((item, index) =>
    typeof item === "string"
      ? { label: ["层级", "链路", "模块", "结果"][index] ?? "层级", value: item }
      : { label: item.name ?? item.label ?? "层级", value: item.visual ?? item.note ?? item.name ?? item.label ?? "模块" },
  );
  const widgets = content?.dataWidgets?.map((item, index) => ({ label: ["账单", "仪表", "曲线"][index] ?? "数据", value: item }));
  const facts = content?.factBoundary?.map((item, index) => ({ label: ["事实边界", "项目阶段", "验证口径"][index] ?? "事实", value: item }));
  const judgements = content?.judgementPanel?.map((item, index) => ({ label: ["判断", "时间", "结论"][index] ?? "判断", value: item }));
  const candidates = barriers ?? layers ?? widgets ?? facts ?? judgements;
  return (candidates?.length ? candidates : fallback).slice(0, 6);
};

const v5NodeItems = (scene: Scene): GraphNodeItem[] => {
  const content = scene.content;
  if (content?.centerNode || content?.leftPath || content?.rightPath) {
    const center = content.centerNode ?? "核心事件";
    return [
      { id: "center", label: center, role: "核心", x: 50, y: 50, tone: "primary" },
      ...(content.leftPath?.node ? [{ id: "left", label: content.leftPath.node, role: content.leftPath.riskTags?.join(" / "), x: 20, y: 50, tone: "warning" as const }] : []),
      ...(content.rightPath?.node ? [{ id: "right", label: content.rightPath.node, role: content.rightPath.riskTags?.join(" / "), x: 80, y: 50, tone: "secondary" as const }] : []),
    ];
  }

  const rawNodes = contentStringList(scene, ["nodes", "keywordTags", "evidenceKeywords", "cornerCompare", "layers"], 6);
  const fallback = graphNodesFromScene(scene).map((node) => node.label);
  return (rawNodes.length ? rawNodes : fallback).slice(0, 6).map((label, index) => ({
    id: `v5-${index}`,
    label,
    role: ["主体", "证据", "路径", "影响", "风险", "结论"][index] ?? "节点",
    tone: (["primary", "secondary", "accent", "warning", "success", "danger"] as const)[index % 6],
  }));
};

const isTechVisualScene = (scene: Scene) =>
  /芯片|算力|推理|训练|模型|GPU|NVIDIA|英伟达|半导体|架构|AI服务器|云|API|智能体|大模型|开源|参数|token|代码|计算|DeepSeek/i.test(
    sceneText(scene),
  );

const isFinanceVisualScene = (scene: Scene) =>
  /K线|k线|股价|市场|仓位|VIX|波动|估值|回撤|收益|资金|币|价格|美股|指数|风险|杠杆|买入|卖出|上涨|下跌|成交|流动性/i.test(
    sceneText(scene),
  );

const metricItemsFromScene = (scene: Scene): MetricItem[] => {
  const cards = scene.visualBrief?.metricCards ?? scene.content?.metrics ?? [];
  const fromCards = cards.map((item, index) => ({
    label: item.label || `指标 ${index + 1}`,
    value: item.value,
    note: item.note,
    tone: /下降|降低|回撤|风险|亏|跌/.test(`${item.label}${item.note ?? ""}`) ? ("down" as const) : index === 0 ? ("up" as const) : ("neutral" as const),
  }));
  if (fromCards.length) return fromCards.slice(0, 6);

  const values = [...new Set([...(scene.emphasis ?? []), ...(scene.subtitle.match(metricPattern) ?? [])])].slice(0, 6);
  if (values.length) {
    return values.map((value, index) => ({
      label: ["核心数字", "变化幅度", "关键比例", "补充指标", "时间窗口", "结果"][index] ?? "指标",
      value: value.replace(/\s+/g, ""),
      tone: index === 0 ? "up" : "neutral",
    }));
  }

  const keywords = [...(scene.content?.keywords ?? []), ...(scene.visualBrief?.tags ?? [])].filter(Boolean).slice(0, 4);
  return (keywords.length ? keywords : [getMainLine(scene.subtitle, 10)]).map((keyword, index) => ({
    label: ["焦点", "原因", "影响", "结果"][index] ?? "要点",
    value: keyword,
    tone: "neutral",
  }));
};

const timelineItemsFromScene = (scene: Scene): TimelineItem[] => {
  const items = scene.visualBrief?.timelineItems ?? scene.content?.timelineItems;
  if (items?.length) {
    return items.slice(0, 5).map((item) => ({
      time: item.label,
      title: item.title,
      note: item.note,
    }));
  }

  const dateMatches = scene.subtitle.match(/(?:\d{1,2}月\d{0,2}日?|\d{4}年|\d{1,2}月底|今年|随后|之后|最后)/g) ?? [];
  const keywords = [...(scene.content?.keywords ?? []), ...(scene.visualBrief?.tags ?? []), ...sceneKeywordsFromSubtitle(scene.subtitle)].filter(Boolean);
  const count = Math.max(3, Math.min(5, Math.max(dateMatches.length, keywords.length)));
  return Array.from({ length: count }).map((_, index) => ({
    time: dateMatches[index] ?? ["起点", "转折", "验证", "放大", "结果"][index] ?? "节点",
    title: keywords[index] ?? ["事件发生", "信息扩散", "数据验证", "市场反应", "形成结论"][index] ?? "关键节点",
    note: index === 0 ? getSupportLine(scene.subtitle, 20) : undefined,
  }));
};

const sceneKeywordsFromSubtitle = (text: string) => {
  const matches = text.match(keywordPattern) ?? [];
  return [...new Set(matches.map((value) => value.replace(/[，。！？；：、,.!?;:\s]/g, "")))].filter((value) => value.length >= 2).slice(0, 6);
};

const graphNodesFromScene = (scene: Scene): GraphNodeItem[] => {
  const briefNodes = scene.visualBrief?.nodes ?? scene.content?.nodes;
  if (briefNodes?.length) {
    return briefNodes.slice(0, 6).map((node, index) => {
      const label = typeof node === "string" ? node : node.label;
      const role = typeof node === "string" ? undefined : node.role;
      return {
      id: `node-${index}`,
      label,
      role,
      tone: (["primary", "secondary", "accent", "warning", "success", "danger"] as const)[index % 6],
      };
    });
  }

  const keywords = [...(scene.content?.keywords ?? []), ...(scene.visualBrief?.tags ?? []), ...sceneKeywordsFromSubtitle(scene.subtitle)].slice(0, 6);
  const fallback = [getMainLine(scene.subtitle, 8), "原因", "路径", "影响"].filter(Boolean);
  return (keywords.length >= 3 ? keywords : fallback).slice(0, 6).map((keyword, index) => ({
    id: `node-${index}`,
    label: keyword,
    role: ["主体", "驱动", "渠道", "结果", "风险", "反馈"][index] ?? "节点",
    tone: (["primary", "secondary", "accent", "warning", "success", "danger"] as const)[index % 6],
  }));
};

const graphEdgesFromNodes = (nodes: GraphNodeItem[]): GraphEdgeItem[] => {
  if (nodes.length <= 1) return [];
  const center = nodes[0]?.id ?? "node-0";
  return nodes.slice(1).map((node) => ({ from: center, to: node.id }));
};

const chartPointsFromScene = (scene: Scene): ChartPoint[] => {
  return factualChartPointsFromScene(scene).slice(0, 6);
};

const candlesFromScene = (scene: Scene): CandlePoint[] => {
  return factualCandlesFromScene(scene);
};

const QualitativeInsightFrame = ({
  scene,
  theme,
  label = "定性判断",
}: {
  scene: Scene;
  theme: Theme;
  label?: string;
}) => {
  const visualTheme = toVisualTheme(theme);
  const nodes = graphNodesFromScene(scene).slice(0, 5);
  const graph = buildSceneGraph(scene, nodes);
  const lines = directorMainText(scene, 13).slice(0, 2);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "0.82fr 1.18fr", gap: 38, height: "100%", alignItems: "center" }}>
      <QuoteFocus
        quote={lines.join("\n")}
        source={label}
        theme={visualTheme}
        style={{ textAlign: "left" }}
      />
      <NodeGraph
        nodes={graph.nodes}
        edges={graph.edges}
        theme={visualTheme}
        style={{ height: "100%" }}
      />
    </div>
  );
};

const shellTitle = (scene: Scene) =>
  scene.directorType === "Summary"
    ? scene.visualBrief?.headline ?? scene.content?.headline ?? getMainLine(scene.subtitle, 18)
    : scene.content?.headline ?? scene.visualBrief?.headline ?? getMainLine(scene.subtitle, 18);

const compositionTitleStyle = (
  placement: DirectorCompositionTitlePlacement,
  baseTitle: CSSProperties,
): CSSProperties => {
  if (placement === "top-center") {
    return {
      ...baseTitle,
      left: "50%",
      top: 44,
      width: 980,
      textAlign: "center",
      transform: "translateX(-50%)",
      fontSize: 48,
    };
  }
  if (placement === "left-rail") {
    return {
      ...baseTitle,
      left: 74,
      top: 110,
      width: 250,
      fontSize: 46,
      lineHeight: 1.12,
    };
  }
  if (placement === "right-rail") {
    return {
      ...baseTitle,
      right: 72,
      top: 92,
      width: 280,
      textAlign: "right",
      fontSize: 44,
      lineHeight: 1.12,
    };
  }
  if (placement === "bottom-left") {
    return {
      ...baseTitle,
      left: 76,
      bottom: 88,
      width: 680,
      fontSize: 44,
    };
  }
  return {
    ...baseTitle,
    left: 76,
    top: 52,
    maxWidth: 720,
    fontSize: 46,
  };
};

const compositionContentStyle = (
  layout: DirectorCompositionLayout,
  baseContent: CSSProperties,
): CSSProperties => {
  if (
    layout === "center-stage" ||
    layout === "question-center" ||
    layout === "judgement-center"
  ) {
    return { ...baseContent, left: 150, right: 150, top: 70, bottom: 96 };
  }
  if (
    layout === "evidence-full-bleed" ||
    layout === "radial-network" ||
    layout === "signal-rings" ||
    layout === "competition-arena"
  ) {
    return { ...baseContent, left: 38, right: 38, top: 34, bottom: 58 };
  }
  if (
    layout === "rail-left-detail-right" ||
    layout === "summary-stack" ||
    layout === "lane-map" ||
    layout === "proof-stack"
  ) {
    return { ...baseContent, left: 344, right: 66, top: 58, bottom: 72 };
  }
  if (
    layout === "table-led" ||
    layout === "investigation-strip" ||
    layout === "stack-diagonal" ||
    layout === "barrier-section" ||
    layout === "signal-map"
  ) {
    return { ...baseContent, left: 54, right: 364, top: 54, bottom: 72 };
  }
  if (
    layout === "title-top-track-bottom" ||
    layout === "metric-split-grid" ||
    layout === "equal-split" ||
    layout === "price-side-by-side" ||
    layout === "dual-path" ||
    layout === "evidence-contact-sheet"
  ) {
    return { ...baseContent, left: 58, right: 58, top: 146, bottom: 70 };
  }
  if (
    layout === "object-right-copy-left" ||
    layout === "verdict-asymmetric" ||
    layout === "evidence-split-annotation" ||
    layout === "investigation-split" ||
    layout === "evidence-recap"
  ) {
    return { ...baseContent, left: 66, right: 44, top: 126, bottom: 66 };
  }
  if (
    layout === "flow-diagram" ||
    layout === "resource-pipeline"
  ) {
    return { ...baseContent, left: 60, right: 60, top: 132, bottom: 74 };
  }
  if (
    layout === "metric-center-orbit" ||
    layout === "callout-orbit" ||
    layout === "pressure-gauge" ||
    layout === "stack-center" ||
    layout === "barrier-grid" ||
    layout === "competition-stack"
  ) {
    return { ...baseContent, left: 84, right: 84, top: 126, bottom: 70 };
  }
  if (
    layout === "price-waterfall" ||
    layout === "question-off-axis" ||
    layout === "summary-center"
  ) {
    return { ...baseContent, left: 104, right: 104, top: 126, bottom: 92 };
  }
  return { ...baseContent, left: 62, right: 62, top: 132, bottom: 70 };
};

const visualShellLayout = (scene: Scene): {
  titleStyle: CSSProperties;
  contentStyle: CSSProperties;
  titleMax: number;
  showTitle: boolean;
} => {
  const baseTitle: CSSProperties = {
    position: "absolute",
    color: "inherit",
    lineHeight: 1.05,
    fontWeight: 920,
    letterSpacing: 0,
    zIndex: 2,
  };
  const baseContent: CSSProperties = {
    position: "absolute",
    overflow: "hidden",
    zIndex: 1,
  };
  const profile = resolveDirectorCompositionProfile(scene);

  if (profile) {
    return {
      titleMax:
        profile.titlePlacement === "left-rail" ||
        profile.titlePlacement === "right-rail"
          ? 11
          : 16,
      showTitle: profile.titlePlacement !== "hidden",
      titleStyle: compositionTitleStyle(profile.titlePlacement, baseTitle),
      contentStyle: compositionContentStyle(profile.layout, baseContent),
    };
  }

  const directorType = scene.directorType;
  if (directorType === "Timeline") {
    return {
      titleMax: 16,
      showTitle: true,
      titleStyle: { ...baseTitle, left: 86, top: 42, maxWidth: 620, fontSize: 44 },
      contentStyle: { ...baseContent, left: 42, right: 42, top: 154, bottom: 82 },
    };
  }

  if (directorType === "SystemMap") {
    return {
      titleMax: 14,
      showTitle: true,
      titleStyle: { ...baseTitle, left: 70, top: 52, maxWidth: 520, fontSize: 42 },
      contentStyle: { ...baseContent, left: 20, right: 20, top: 122, bottom: 66 },
    };
  }

  if (directorType === "DataExplosion" || directorType === "Pricing") {
    return {
      titleMax: 14,
      showTitle: true,
      titleStyle: { ...baseTitle, left: 72, top: 56, maxWidth: 500, fontSize: 46 },
      contentStyle: { ...baseContent, left: 52, right: 34, top: 134, bottom: 62 },
    };
  }

  if (directorType === "Contrast") {
    return {
      titleMax: 13,
      showTitle: true,
      titleStyle: { ...baseTitle, left: "50%", top: 44, width: 920, textAlign: "center", transform: "translateX(-50%)", fontSize: 46 },
      contentStyle: { ...baseContent, left: 34, right: 34, top: 132, bottom: 62 },
    };
  }

  if (directorType === "SpecSheet") {
    return {
      titleMax: 15,
      showTitle: true,
      titleStyle: { ...baseTitle, right: 70, top: 48, maxWidth: 620, textAlign: "right", fontSize: 42 },
      contentStyle: { ...baseContent, left: 42, right: 42, top: 126, bottom: 56 },
    };
  }

  if (directorType === "Summary") {
    return {
      titleMax: 16,
      showTitle: true,
      titleStyle: { ...baseTitle, left: "50%", top: 70, width: 980, textAlign: "center", transform: "translateX(-50%)", fontSize: 58 },
      contentStyle: { ...baseContent, left: 170, right: 170, top: 178, bottom: 96 },
    };
  }

  return {
    titleMax: 16,
    showTitle: true,
    titleStyle: { ...baseTitle, left: 76, top: 52, maxWidth: 820, fontSize: 46 },
    contentStyle: { ...baseContent, left: 56, right: 56, top: 142, bottom: 70 },
  };
};

const VisualLibraryShell = ({ scene, theme, children }: { scene: Scene; theme: Theme; children: ReactNode }) => {
  const layout = visualShellLayout(scene);
  const title = getMainLine(shellTitle(scene), layout.titleMax);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily: theme.fontFamily, color: theme.ink }}>
      {layout.showTitle ? <div style={{ ...layout.titleStyle, color: theme.ink, fontWeight: theme.titleWeight }}>{title}</div> : null}
      <div style={layout.contentStyle}>{children}</div>
    </div>
  );
};

const compositionEntranceStyle = (
  frame: number,
  profile?: DirectorCompositionProfile,
): CSSProperties => {
  if (!profile) return {};

  const progress = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const springProgress = spring({
    frame,
    fps: 30,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
    durationInFrames: 26,
  });
  const fromX =
    profile.motion === "object-push" ||
    profile.motion === "path-trace" ||
    profile.motion === "lane-flow" ||
    profile.motion === "flow-trace"
      ? 56
      : profile.motion === "cutaway-scan" ||
          profile.motion === "section-scan" ||
          profile.motion === "ripple-spread"
        ? -46
        : 0;
  const fromY =
    profile.motion === "stack-rise" ||
    profile.motion === "waterfall-drop" ||
    profile.motion === "milestone-pop" ||
    profile.motion === "proof-stagger"
      ? 48
      : 0;
  const startScale =
    profile.motion === "metric-burst" ||
    profile.motion === "network-bloom" ||
    profile.motion === "ring-pulse" ||
    profile.motion === "verdict-snap"
      ? 0.92
      : 0.98;
  const revealUsesClip =
    profile.motion === "track-draw" ||
    profile.motion === "row-wipe" ||
    profile.motion === "annotation-stagger" ||
    profile.motion === "recap-stagger" ||
    profile.motion === "grid-lock";

  return {
    opacity: progress,
    transform: `translate3d(${(1 - springProgress) * fromX}px, ${(1 - springProgress) * fromY}px, 0) scale(${startScale + (1 - startScale) * springProgress})`,
    clipPath: revealUsesClip
      ? `inset(0 ${(1 - progress) * 100}% 0 0 round 12px)`
      : undefined,
  };
};

const DirectorCompositionBoundary = ({
  scene,
  children,
}: {
  scene: Scene;
  children: ReactNode;
}) => {
  const frame = useCurrentFrame();
  const profile = resolveDirectorCompositionProfile(scene);

  return (
    <div
      data-renderer-family={scene.rendererFamily ?? profile?.rendererFamily}
      data-visual-treatment={scene.visualTreatment ?? profile?.visualTreatment}
      data-layout-recipe={scene.layoutRecipe}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        transformOrigin: "center",
        ...compositionEntranceStyle(frame, profile),
      }}
    >
      {children}
    </div>
  );
};

const VisualLibraryScene = ({ scene, directorType, theme }: { scene: Scene; directorType?: DirectorSceneType; theme: Theme }): ReactNode | null => {
  const visualTheme = toVisualTheme(theme);
  const metrics = metricItemsFromScene(scene);
  const fallbackNodes = graphNodesFromScene(scene);
  const graph = buildSceneGraph(scene, fallbackNodes);
  const nodes = graph.nodes;
  const edges = graph.edges;
  const chartPoints = chartPointsFromScene(scene);
  const heatmapPoints = factualHeatmapPointsFromScene(scene);
  const gaugeValue = factualGaugeValueFromScene(scene);
  const candles = candlesFromScene(scene);
  const timelineItems = timelineItemsFromScene(scene);
  const text = sceneText(scene);

  if (hasComponent(scene, ["MoonPerceptionFrame"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <MoonPerceptionFrame
          mode={scene.content?.highlight === "closing" ? "closing" : "compare"}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["ReferenceScaleFrame"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <ReferenceScaleFrame theme={visualTheme} style={{ height: "100%" }} />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["AttentionFieldFrame"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <AttentionFieldFrame theme={visualTheme} style={{ height: "100%" }} />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["FieldOfViewFrame"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <FieldOfViewFrame
          mode={scene.content?.highlight === "narrow" ? "narrow" : "wide"}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["AngularDiameterFrame"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <AngularDiameterFrame theme={visualTheme} style={{ height: "100%" }} />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["DistanceMythFrame"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <DistanceMythFrame theme={visualTheme} style={{ height: "100%" }} />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["ZoomCropFrame"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <ZoomCropFrame theme={visualTheme} style={{ height: "100%" }} />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["MoonCompositionFrame"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <MoonCompositionFrame
          mode={scene.content?.highlight === "controls" ? "controls" : "reframe"}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (directorType === "EvidenceHero" || hasComponent(scene, ["EvidenceZoom", "EvidenceCallout", "LogoCornerCompare"])) {
    const lines = directorMainText(scene, 12);
    const evidence = contentStringList(scene, ["evidenceKeywords", "cornerCompare", "keywordTags"], 5);
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <ChipHeroFrame
          kicker={scene.content?.sceneTitle ?? "调查开场"}
          title={lines.join("\n")}
          nodes={evidence.length ? evidence : nodes.map((node) => node.label)}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (directorType === "KeywordInvestigation" || hasComponent(scene, ["EvidenceDataSplit", "TwoKeywordInvestigation", "CautionBadge"])) {
    const tags = contentStringList(scene, ["keywordTags"], 2);
    const facts = contentStringList(scene, ["factBoundary", "evidenceKeywords"], 3);
    const lines = directorMainText(scene, 14);
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 42, height: "100%", alignItems: "stretch" }}>
          <div style={{ display: "grid", gap: 24, alignContent: "center" }}>
            {lines.map((line, index) => (
              <EventCard key={line} title={line} note={index === 0 ? "先纠正理解方向" : "再落到商业问题"} theme={visualTheme} style={{ minHeight: 182, borderColor: index === 0 ? `${theme.warning}66` : `${theme.primary}66` }} />
            ))}
          </div>
          <EvidenceWall
            items={[
              ...tags.map((tag) => ({ label: "关键词", value: tag })),
              ...facts.map((fact) => ({ label: "事实边界", value: fact })),
            ].slice(0, 6)}
            theme={visualTheme}
            style={{ gridTemplateColumns: "1fr", alignContent: "center" }}
          />
        </div>
      </VisualLibraryShell>
    );
  }

  if (directorType === "FinancialMeter" || hasComponent(scene, ["InferenceCostBill", "TokenMeter", "CostCurveOverlay"])) {
    const v5Metrics = v5MetricItems(scene, metrics);
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        {chartPoints.length > 0 || gaugeValue !== undefined ? (
          <CostMeterFrame metrics={v5Metrics} chartPoints={chartPoints} gaugeValue={gaugeValue} theme={visualTheme} style={{ height: "100%" }} />
        ) : (
          <QualitativeInsightFrame scene={scene} theme={theme} label="成本结构" />
        )}
      </VisualLibraryShell>
    );
  }

  if (directorType === "SystemStack" || hasComponent(scene, ["ModelHardwareStack", "DataPathTrace"])) {
    const layers = contentStringList(scene, ["layers"], 4);
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 40, height: "100%", alignItems: "center" }}>
          <ChipArchitecture
            title={scene.content?.highlight ?? "适配"}
            modules={(layers.length ? layers : ["用户请求", "模型层", "推理服务层", "芯片执行层"]).slice(0, 4).map((label, index) => ({
              label,
              note: ["入口", "计算结构", "服务调度", "执行层"][index],
              tone: (["primary", "secondary", "accent", "success"] as const)[index % 4],
            }))}
            theme={visualTheme}
            style={{ height: 520 }}
          />
          <ComputeFlow steps={(layers.length ? layers : nodes.map((node) => node.label)).slice(0, 5)} theme={visualTheme} style={{ height: 360 }} />
        </div>
      </VisualLibraryShell>
    );
  }

  if (directorType === "DependencyMap" || hasComponent(scene, ["SupplyDependencyMap", "RiskTagCallout"])) {
    const center = scene.content?.centerNode ?? nodes[0]?.label ?? "核心节点";
    const upstream = [scene.content?.leftPath?.node, ...(scene.content?.leftPath?.riskTags ?? [])].filter(Boolean) as string[];
    const downstream = [scene.content?.rightPath?.node, ...(scene.content?.rightPath?.riskTags ?? [])].filter(Boolean) as string[];
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <SupplyChainMap center={center} upstream={upstream.slice(0, 3)} downstream={downstream.slice(0, 3)} theme={visualTheme} style={{ height: "100%" }} />
      </VisualLibraryShell>
    );
  }

  if (directorType === "QuestionPause" || hasComponent(scene, ["ControlQuestionPause"])) {
    const lines = directorMainText(scene, 16);
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <QuoteFocus quote={lines.join("\n")} source={scene.content?.action ?? "路径线断开，问题浮现"} theme={visualTheme} style={{ height: "100%", display: "grid", placeItems: "center", padding: "0 120px" }} />
      </VisualLibraryShell>
    );
  }

  if (directorType === "BarrierWall" || hasComponent(scene, ["ChipBarrierWall", "MicroSceneTile"])) {
    const barriers = scene.content?.barriers ?? [];
    const centerBarrier = barriers.find((item) => item.label === "制程") ?? barriers[0];
    const rest = barriers.filter((item) => item !== centerBarrier);
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <TechQuadrantWall
          title={centerBarrier?.label ?? "制程"}
          items={(rest.length ? rest : barriers).slice(0, 4).map((item) => ({ label: item.label, value: item.visual ?? item.label, note: item.shape }))}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (directorType === "EvidenceReturn" || hasComponent(scene, ["EvidenceReturnFrame", "DualJudgementPanel"])) {
    const judgements = v5MetricItems(scene, metrics);
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 44, height: "100%", alignItems: "center" }}>
          <QuoteFocus quote={directorMainText(scene, 13).join("\n")} source={scene.content?.evidenceLabel ?? "事实边界"} theme={visualTheme} style={{ textAlign: "left" }} />
          <EvidenceWall items={judgements} theme={visualTheme} style={{ gridTemplateColumns: "1fr", alignContent: "center" }} />
        </div>
      </VisualLibraryShell>
    );
  }

  if (directorType === "IndustrySignal" || hasComponent(scene, ["IndustrySignalRadar", "MarketLayerMap"])) {
    const signalNodes = v5NodeItems(scene);
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <CompetitionRings
          center={scene.content?.signalSource ?? signalNodes[0]?.label ?? "行业信号"}
          items={signalNodes.slice(scene.content?.signalSource ? 0 : 1).map((node) => ({ label: node.label, role: node.role }))}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (directorType === "CompetitionLayerStack" || hasComponent(scene, ["CompetitionLayerStack"])) {
    const layers = v5MetricItems(scene, metrics).slice(0, 3);
    const layerNodes = layers.map((item, index) => ({ id: `layer-${index}`, label: item.label, role: item.value, x: 24 + index * 26, y: 30 + index * 18, tone: (["primary", "secondary", "warning"] as const)[index] }));
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <div style={{ display: "grid", gridTemplateColumns: "0.82fr 1.18fr", gap: 44, height: "100%", alignItems: "center" }}>
          <QuoteFocus quote={directorMainText(scene, 10).join("\n")} source="竞争维度展开" theme={visualTheme} style={{ textAlign: "left" }} />
          <NodeGraph nodes={layerNodes} edges={layerNodes.slice(1).map((node, index) => ({ from: `layer-${index}`, to: node.id }))} theme={visualTheme} style={{ height: "100%" }} />
        </div>
      </VisualLibraryShell>
    );
  }

  if (directorType === "FinalJudgement" || hasComponent(scene, ["FinalJudgementPanel"])) {
    const lines = directorMainText(scene, 14);
    const tags = contentStringList(scene, ["judgementPanel", "keywordTags"], 4);
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
          <div style={{ width: 980 }}>
            <QuoteFocus quote={lines.join("\n")} source={scene.content?.centerNode ?? "最终判断"} theme={visualTheme} />
            <div style={{ marginTop: 42, display: "grid", gridTemplateColumns: `repeat(${Math.max(tags.length, 1)}, 1fr)`, gap: 18 }}>
              {(tags.length ? tags : scene.content?.judgementTags ?? ["降成本", "控供应", "适配模型"]).slice(0, 4).map((tag, index) => (
                <EventCard key={tag} title={tag} theme={visualTheme} style={{ minHeight: 118, padding: "24px 22px", textAlign: "center", borderColor: `${getAccent(index, theme)}55` }} />
              ))}
            </div>
          </div>
        </div>
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["ChipHeroFrame"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <ChipHeroFrame
          kicker={scene.visualBrief?.kicker ?? scene.content?.keywords?.slice(0, 2).join(" / ")}
          title={scene.content?.headline ?? scene.visualBrief?.headline ?? getMainLine(scene.subtitle, 14)}
          nodes={[...(scene.content?.keywords ?? []), ...nodes.map((node) => node.label)].filter(Boolean).slice(0, 5)}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["TrainingInferenceSplit"])) {
    const comparisons = scene.content?.comparisons ?? scene.visualBrief?.comparisonCards ?? [];
    const left = comparisons[0] ?? { label: "训练", value: "一次性投入", note: "模型形成阶段" };
    const right = comparisons[1] ?? { label: "推理", value: "长期调用", note: "上线后持续发生" };
    const noteFrom = (item: unknown) =>
      item && typeof item === "object" && "note" in item && typeof item.note === "string" ? item.note : undefined;
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <TrainingInferenceSplit
          headline=""
          left={{ label: left.label, value: left.value, note: noteFrom(left) }}
          right={{ label: right.label, value: right.value, note: noteFrom(right) }}
          flow={nodes.slice(0, 5).map((node) => node.label)}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["CostMeterFrame"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        {chartPoints.length > 0 || gaugeValue !== undefined ? (
          <CostMeterFrame metrics={metrics} chartPoints={chartPoints} gaugeValue={gaugeValue} theme={visualTheme} style={{ height: "100%" }} />
        ) : (
          <QualitativeInsightFrame scene={scene} theme={theme} label="成本结构" />
        )}
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["TechQuadrantWall"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <TechQuadrantWall
          title={scene.visualBrief?.centerLabel ?? scene.content?.centerLabel ?? "量产门槛"}
          items={metrics}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["CompetitionRings"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <CompetitionRings
          center={nodes[0]?.label ?? scene.content?.keywords?.[0] ?? "AI 竞争"}
          items={nodes.slice(nodes[0] ? 1 : 0).map((node) => ({ label: node.label, role: node.role }))}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["ChapterBreak"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <ChapterBreak
          eyebrow={scene.content?.keywords?.slice(0, 2).join(" / ")}
          title={scene.content?.headline ?? scene.visualBrief?.headline ?? getMainLine(scene.subtitle, 14)}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["QuoteFocus"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <QuoteFocus
          quote={scene.content?.headline ?? getMainLine(scene.subtitle, 18)}
          source={scene.content?.keywords?.slice(0, 3).join(" / ")}
          theme={visualTheme}
          style={{ height: "100%", display: "grid", placeItems: "center", padding: "0 70px" }}
        />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["DecisionTree"])) {
    const keywords = scene.content?.keywords?.length ? scene.content.keywords : emphasisItems(scene, ["英伟达", "国产替代", "自研芯片"]);
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <DecisionTree
          root={scene.content?.headline ?? getMainLine(scene.subtitle, 10)}
          branches={keywords.slice(0, 3).map((label, index) => ({
            label,
            outcome: index === 0 ? "外部供应" : index === 1 ? "国产产能" : "自主节奏",
            tone: (["warning", "secondary", "primary"] as const)[index % 3],
          }))}
          theme={visualTheme}
          style={{ height: "100%" }}
        />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["GaugeMeter"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        {gaugeValue === undefined ? (
          <QualitativeInsightFrame scene={scene} theme={theme} label="趋势判断" />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: chartPoints.length > 0 ? "380px 1fr" : "1fr", gap: 58, alignItems: "center", height: "100%" }}>
            <GaugeMeter label={scene.content?.headline ?? "事实比例"} value={gaugeValue} theme={visualTheme} style={{ width: 360, height: 270, margin: chartPoints.length > 0 ? 0 : "0 auto" }} />
            {chartPoints.length > 0 ? <BarRaceChart data={chartPoints} theme={visualTheme} /> : null}
          </div>
        )}
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["EvidenceWall"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <EvidenceWall items={metrics.slice(0, 6)} theme={visualTheme} />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["ChipArchitecture"]) || (/芯片|半导体|GPU|NVIDIA|英伟达|算力|AI服务器/i.test(text) && directorType === "SpecSheet")) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <ChipArchitecture
          title={scene.content?.headline ?? "计算架构"}
          modules={metrics.slice(0, 4).map((item, index) => ({ label: item.value, note: item.label, tone: (["primary", "secondary", "accent", "success"] as const)[index % 4] }))}
          theme={visualTheme}
        />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["ComputeFlow"]) || (/推理|训练|流程|链路|工作流|Agent|智能体|模型/i.test(text) && directorType === "SystemMap")) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <ComputeFlow steps={nodes.slice(0, 5).map((node) => node.label)} theme={visualTheme} style={{ height: "100%" }} />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["ProductEcosystemMap"]) || (isTechVisualScene(scene) && directorType === "SystemMap")) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <ProductEcosystemMap
          company={nodes[0]?.label ?? getMainLine(scene.subtitle, 8)}
          products={nodes.slice(1, 4).map((node) => node.label)}
          dependencies={nodes.slice(4, 7).map((node) => node.label)}
          theme={visualTheme}
        />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["RiskMeter"]) || (/风险|VIX|波动|回撤|杠杆|警惕/i.test(text) && directorType === "Contrast")) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        {gaugeValue === undefined && chartPoints.length === 0 ? (
          <QualitativeInsightFrame scene={scene} theme={theme} label="风险关系" />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: gaugeValue === undefined || chartPoints.length === 0 ? "1fr" : "420px 1fr", gap: 52, alignItems: "center", height: "100%" }}>
            {gaugeValue === undefined ? null : <RiskMeter value={gaugeValue} label="事实比例" theme={visualTheme} />}
            {chartPoints.length > 0 ? <LineTrendChart data={chartPoints} theme={visualTheme} /> : null}
          </div>
        )}
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["MarketHeatmap"]) || (/板块|涨跌|热力|市场情绪|币种|股票/i.test(text) && isFinanceVisualScene(scene))) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        {heatmapPoints.length > 0 ? (
          <MarketHeatmap items={heatmapPoints.slice(0, 8).map((item) => ({ ...item, group: "事实数据" }))} theme={visualTheme} />
        ) : (
          <QualitativeInsightFrame scene={scene} theme={theme} label="市场关系" />
        )}
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["KLineChart", "CandlestickPanel"]) || (/K线|k线|股价|市场|指数|价格|买入|卖出|上涨|下跌/i.test(text) && directorType !== "Pause")) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        {candles.length > 0 ? (
          <KLineChart candles={candles} theme={visualTheme} />
        ) : (
          <QualitativeInsightFrame scene={scene} theme={theme} label="价格逻辑" />
        )}
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["TimelineRail"]) || directorType === "Timeline") {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <TimelineRail items={timelineItems} theme={visualTheme} />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["SupplyChainMap"]) || (/供应链|上游|下游|代工|生态|依赖/i.test(text))) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <SupplyChainMap center={nodes[0]?.label ?? "核心节点"} upstream={nodes.slice(1, 4).map((node) => node.label)} downstream={nodes.slice(4, 7).map((node) => node.label)} theme={visualTheme} />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["NodeGraph"]) || directorType === "SystemMap") {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <NodeGraph nodes={nodes} edges={edges} theme={visualTheme} />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["BarRaceChart"]) || directorType === "DataExplosion" || directorType === "Pricing") {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        {chartPoints.length > 0 && metrics[0] ? (
          <div style={{ display: "grid", gridTemplateColumns: metrics.length > 1 ? "460px 1fr" : "1fr", gap: 42, alignItems: "center", height: "100%" }}>
            <MetricCounter metric={metrics[0]} theme={visualTheme} />
            <BarRaceChart data={chartPoints} theme={visualTheme} />
          </div>
        ) : (
          <QualitativeInsightFrame scene={scene} theme={theme} label={directorType === "Pricing" ? "价格逻辑" : "数据结论"} />
        )}
      </VisualLibraryShell>
    );
  }

  if (directorType === "SpecSheet") {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <EvidenceWall items={metrics.slice(0, 6)} theme={visualTheme} />
      </VisualLibraryShell>
    );
  }

  if (hasComponent(scene, ["EventCard"])) {
    return (
      <VisualLibraryShell scene={scene} theme={theme}>
        <EventCard title={scene.content?.headline ?? getMainLine(scene.subtitle, 16)} note={getSupportLine(scene.subtitle, 42)} theme={visualTheme} style={{ width: 820, margin: "80px auto 0" }} />
      </VisualLibraryShell>
    );
  }

  return null;
};

const SceneVisual = ({
  scene,
  sceneType,
  directorType,
  theme,
  assetManifest,
}: {
  scene: Scene;
  sceneType: SceneType;
  directorType?: DirectorSceneType;
  theme: Theme;
  assetManifest?: RuntimeAssetManifest;
}) => {
  const primaryVisual = resolveScenePrimaryVisual(scene, assetManifest);
  if (primaryVisual?.sourceKind === "generated-concept") {
    return <GeneratedConceptFrame scene={scene} theme={theme} concept={primaryVisual} />;
  }
  const ordinaryVisualIsEvidenceLead =
    primaryVisual?.sourceKind === "ordinary" &&
    (directorType === "EvidenceHero" ||
      directorType === "EvidenceReturn" ||
      sceneType === "evidence-zoom" ||
      hasComponent(scene, ["EvidenceZoom", "EvidenceCallout", "EvidenceReturnFrame"]));
  if (ordinaryVisualIsEvidenceLead) {
    return <OrdinaryPrimaryVisualFrame scene={scene} theme={theme} visual={primaryVisual} />;
  }

  if (isTacticalMapTheme(theme)) return <TacticalSceneVisual scene={scene} directorType={directorType} theme={theme} />;
  if (isJSpaceTheme(theme)) return <JSpaceSceneVisual scene={scene} directorType={directorType} />;
  if (isCaseWorkflowTheme(theme)) return <CaseSceneVisual scene={scene} directorType={directorType} theme={theme} />;

  const visualLibraryScene = VisualLibraryScene({ scene, directorType, theme });
  if (visualLibraryScene) return visualLibraryScene;

  if (directorType === "Pause") return <PauseScreen scene={scene} theme={theme} />;
  if (directorType === "Hero") return <HeroMetricFrame scene={scene} theme={theme} />;
  if (directorType === "Timeline") return <TimelineScene scene={scene} theme={theme} />;
  if (directorType === "SystemMap") return <RelationMapFrame scene={scene} theme={theme} />;
  if (directorType === "DataExplosion") return <DataPanelFrame scene={scene} theme={theme} />;
  if (directorType === "Contrast") return <RiskContrastScene scene={scene} theme={theme} />;
  if (directorType === "SpecSheet") return theme.styleKey === "dark-data-analysis" ? <DarkDataBoardFrame scene={scene} theme={theme} /> : <DataPanelFrame scene={scene} theme={theme} />;
  if (directorType === "Pricing") return <PricingFrame scene={scene} theme={theme} />;
  if (directorType === "Summary") return <ClosingFrame scene={scene} theme={theme} />;

  if (
    theme.styleKey === "fast-short-video" &&
    (sceneType === "impact-hook" ||
      sceneType === "quote-impact" ||
      sceneType === "relationship-map" ||
      sceneType === "data-breakdown" ||
      sceneType === "risk-contrast")
  ) {
    return <FastImpactFrame scene={scene} theme={theme} />;
  }

  if (
    theme.styleKey === "news-commentary" &&
    (sceneType === "news-context" ||
      sceneType === "quote-impact" ||
      sceneType === "relationship-map" ||
      sceneType === "data-breakdown" ||
      sceneType === "risk-contrast")
  ) {
    return <NewsDeskScene scene={scene} theme={theme} />;
  }

  if (
    theme.styleKey === "knowledge-explainer" &&
    (sceneType === "concept-steps" || sceneType === "relationship-map" || sceneType === "data-breakdown" || sceneType === "timeline")
  ) {
    return <ExplainerFlowScene scene={scene} theme={theme} />;
  }

  if (theme.styleKey === "dark-data-analysis" && (sceneType === "data-breakdown" || sceneType === "relationship-map")) {
    return <DarkDataBoardFrame scene={scene} theme={theme} />;
  }

  if (sceneType === "impact-hook") return <HeroMetricFrame scene={scene} theme={theme} />;
  if (sceneType === "news-context") return <NewsContextScene scene={scene} theme={theme} />;
  if (sceneType === "data-breakdown") return <DataPanelFrame scene={scene} theme={theme} />;
  if (sceneType === "relationship-map") return <RelationMapFrame scene={scene} theme={theme} />;
  if (sceneType === "risk-contrast") return <RiskContrastScene scene={scene} theme={theme} />;
  if (sceneType === "timeline") return <TimelineScene scene={scene} theme={theme} />;
  if (sceneType === "evidence-zoom") return <EvidenceFrame scene={scene} theme={theme} />;
  if (sceneType === "concept-steps") return <ConceptStepsScene scene={scene} theme={theme} />;
  if (sceneType === "quote-impact") return <QuoteImpactScene scene={scene} theme={theme} />;
  if (primaryVisual?.sourceKind === "ordinary") {
    return <OrdinaryPrimaryVisualFrame scene={scene} theme={theme} visual={primaryVisual} />;
  }
  return <ClosingFrame scene={scene} theme={theme} />;
};

const DirectorTransitionOverlay = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const transition = scene.animation?.transitionAnimation ?? "wipe";
  const opacity = interpolate(frame, [0, 8, theme.transitionFrames], [0.62, 0.32, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const x = interpolate(frame, [0, theme.transitionFrames + 4], [-520, 2120], { extrapolateRight: "clamp", easing: ease });
  const y = interpolate(frame, [0, theme.transitionFrames + 4], [-220, 1180], { extrapolateRight: "clamp", easing: ease });
  const grow = interpolate(frame, [0, theme.transitionFrames], [0, 1], { extrapolateRight: "clamp", easing: ease });
  const transitionColor = theme.isDark ? `${theme.primary}55` : "rgba(255,255,255,0.88)";
  const styleByTransition: Record<TransitionAnimation, CSSProperties> = {
    wipe: {
      left: x,
      top: -120,
      width: 320,
      height: 1320,
      transform: "rotate(14deg)",
      background: `linear-gradient(90deg, transparent, ${transitionColor}, transparent)`,
    },
    morph: {
      left: 960 - 760 * grow,
      top: 540 - 520 * grow,
      width: 1520 * grow,
      height: 1040 * grow,
      borderRadius: 42,
      background: theme.gradient,
      opacity: opacity * 0.28,
      filter: "blur(18px)",
    },
    split: {
      left: 0,
      top: 0,
      width: 1920,
      height: 1080,
      background: `linear-gradient(90deg, ${theme.panel} 0 ${50 * grow}%, transparent ${50 * grow}% ${100 - 50 * grow}%, ${theme.panel} ${100 - 50 * grow}% 100%)`,
      opacity: opacity * 0.72,
    },
    flowMerge: {
      left: x - 160,
      top: 180,
      width: 620,
      height: 180,
      borderRadius: 999,
      background: theme.gradient,
      opacity: opacity * 0.34,
      filter: "blur(8px)",
      transform: "rotate(-7deg)",
    },
    cameraPan: {
      left: 0,
      top: y,
      width: 1920,
      height: 240,
      background: `linear-gradient(180deg, transparent, ${transitionColor}, transparent)`,
      opacity: opacity * 0.55,
    },
  };

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <div style={{ position: "absolute", ...styleByTransition[transition] }} />
    </AbsoluteFill>
  );
};

const VisualEffectsOverlay = ({ scene, theme }: { scene: Scene; theme: Theme }) => {
  const frame = useCurrentFrame();
  const modules = scene.visualModules ?? [];
  const hasLightLeak = modules.includes("light-leaks");
  const hasStarburst = theme.starburst && modules.includes("starburst");
  const hasNoise = theme.noiseEnabled && modules.includes("noise") && theme.noiseOpacity > 0;
  const seedX = seededRange(scene.id, -120, 120);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {hasNoise ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: theme.noiseOpacity,
            backgroundImage: `repeating-linear-gradient(0deg, ${theme.ink} 0 1px, transparent 1px 7px)`,
	            transform: "none",
          }}
        />
      ) : null}
      {hasLightLeak ? (
        <div
          style={{
            position: "absolute",
            width: 680,
            height: 1240,
	            left: 140 + seedX,
	            top: -160,
	            transform: "rotate(18deg)",
            background: `linear-gradient(90deg, transparent, ${theme.warning}22, ${theme.primary}18, transparent)`,
            filter: "blur(12px)",
            opacity: 0.72,
          }}
        />
      ) : null}
      {hasStarburst ? (
        <div
          style={{
            position: "absolute",
            right: 110,
            top: 110,
            width: 420,
            height: 420,
            borderRadius: 999,
	            background: `repeating-conic-gradient(from 24deg, ${theme.warning}55 0deg 6deg, transparent 6deg 15deg)`,
	            opacity: 0.16,
	            transform: "scale(1)",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const SceneFrame = ({
  scene,
  index,
  total,
  theme,
  assetManifest,
}: {
  scene: Scene;
  index: number;
  total: number;
  theme: Theme;
  assetManifest?: RuntimeAssetManifest;
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const directorType = scene.directorType;
  const sceneType = directorType ? directorToLegacySceneType[directorType] : scene.sceneType ?? fallbackSceneType(scene, index, total);
  const caseWorkflow = isCaseWorkflowTheme(theme);
  const tacticalMap = isTacticalMapTheme(theme);
  const accent = getAccent(index, theme);
  const opacity = fade(frame, 0, 12);
  const y = slide(frame, 0, 20, 24);
  const isPortrait = height > width;
  const baseWidth = isPortrait ? 1080 : 1920;
  const baseHeight = isPortrait ? 1920 : 1080;
  const stageScale = Math.min(width / baseWidth, height / baseHeight);
  const stageLeft = (width - baseWidth * stageScale) / 2;
  const stageTop = (height - baseHeight * stageScale) / 2;
  const directorEntrance = entranceAnimationStyle({
    frame,
    fps: 30,
    animation: scene.animation?.entranceAnimation,
    shotStyle: scene.shotStyle,
    pace: scene.pace,
  });
  const directorCamera = caseWorkflow
    ? ""
    : scene.animation?.cameraMotion
    ? cameraMotionTransform(frame, scene.animation.cameraMotion, scene.pace)
    : cameraTransform(frame, scene.motionVariant, scene.pace);
  const emphasisStyle =
    !caseWorkflow && (scene.role === "memory" || scene.role === "spike" || (scene.importance && scene.importance >= 8))
      ? emphasisAnimationStyle(frame, scene.animation?.emphasisAnimation, accent)
      : {};
  const emphasisTransform = "transform" in emphasisStyle ? String(emphasisStyle.transform) : "";
  const emphasisRest = { ...emphasisStyle };
  if ("transform" in emphasisRest) {
    delete emphasisRest.transform;
  }
  const shotInset = resolveSceneStageInset({
    width,
    height,
    hasDirector: Boolean(scene.directorType),
    shotStyle: scene.shotStyle,
    caseWorkflow,
  });

  return (
    <AbsoluteFill style={{ background: theme.paper, fontFamily: theme.fontFamily, color: theme.ink, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: stageLeft,
          top: stageTop,
          width: baseWidth,
          height: baseHeight,
          opacity,
          transform: makeTransform([`translateY(${y}px)`, `scale(${stageScale})`]),
          transformOrigin: "top left",
          overflow: "hidden",
        }}
      >
        {isJSpaceTheme(theme) ? (
          <JSpaceBackground scene={scene} theme={theme} />
        ) : caseWorkflow ? (
          <CaseWorkflowBackground theme={theme} />
        ) : tacticalMap ? (
          <TacticalBackground scene={scene} theme={theme} />
        ) : (
          <DirectorBackground scene={scene} accent={accent} theme={theme} />
        )}
        <div
          style={{
            position: "absolute",
            inset: shotInset,
            transformOrigin: "top left",
            ...directorEntrance,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              transform: makeTransform([directorCamera, emphasisTransform]),
              transformOrigin: "center",
              ...emphasisRest,
            }}
          >
            <DirectorCompositionBoundary scene={scene}>
              <SceneVisual scene={scene} sceneType={sceneType} directorType={directorType} theme={theme} assetManifest={assetManifest} />
            </DirectorCompositionBoundary>
          </div>
        </div>
        {caseWorkflow ? null : <VisualEffectsOverlay scene={scene} theme={theme} />}
        {caseWorkflow ? null : <DirectorTransitionOverlay scene={scene} theme={theme} />}
      </div>
    </AbsoluteFill>
  );
};

export const ShinVideo = ({ scenes, captions, audioSrc, fps, duration, styleProfile, assetManifest }: RenderInput) => {
  const safeScenes = scenes.length > 0 ? scenes : [{ id: "empty", start: 0, end: duration, subtitle: "等待生成视频时间轴", images: [], layout: "title" as const }];
  const theme = createTheme(styleProfile ?? defaultStyleProfile);

  return (
    <AbsoluteFill style={{ background: theme.paper, color: theme.ink }}>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      {safeScenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={Math.max(0, Math.floor(scene.start * fps))}
          durationInFrames={Math.max(1, Math.ceil((scene.end - scene.start) * fps))}
        >
          <SceneFrame scene={scene} index={index} total={safeScenes.length} theme={theme} assetManifest={assetManifest} />
        </Sequence>
      ))}
      <GlobalCaptionLayer scenes={safeScenes} captions={captions} theme={theme} />
    </AbsoluteFill>
  );
};
