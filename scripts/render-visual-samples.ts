import { mkdir } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { buildRuntimeStyleProfile } from "../lib/style-profile";
import type { RenderInput, Scene, SceneType } from "../lib/types";
import type { VideoStyle } from "../lib/editor-types";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "runtime", "visual-samples");
const fps = 30;

const styleSamples: Array<{ style: VideoStyle; sceneType: SceneType; text: string }> = [
  {
    style: "light-finance-mg",
    sceneType: "data-breakdown",
    text: "一条收入线索被拆成项目、授权和资产价格，核心金额正在快速放大。",
  },
  {
    style: "news-commentary",
    sceneType: "news-context",
    text: "这不是单一商业事件，而是政治身份、市场情绪和资金流向同时叠加。",
  },
  {
    style: "knowledge-explainer",
    sceneType: "concept-steps",
    text: "把问题拆成三层：谁在参与，钱从哪里来，风险最后落在哪里。",
  },
  {
    style: "fast-short-video",
    sceneType: "impact-hook",
    text: "真正反常的不是数字本身，而是这个数字背后绑定的影响力。",
  },
  {
    style: "dark-data-analysis",
    sceneType: "relationship-map",
    text: "资金、项目、代币和舆论入口形成一条可追踪的关系链路。",
  },
];

const recipeBySceneType: Record<SceneType, Pick<Scene, "visualIntent" | "layoutRecipe" | "motionVariant" | "transition" | "pace">> = {
  "impact-hook": {
    visualIntent: "hook-attention",
    layoutRecipe: "metric-hero",
    motionVariant: "white-flash",
    transition: "white-flash",
    pace: "strong",
  },
  "news-context": {
    visualIntent: "establish-context",
    layoutRecipe: "news-column",
    motionVariant: "column-wipe",
    transition: "column-cut",
    pace: "soft",
  },
  "data-breakdown": {
    visualIntent: "explain-number",
    layoutRecipe: "stacked-data-cards",
    motionVariant: "scan-rise",
    transition: "scan-wipe",
    pace: "medium",
  },
  "relationship-map": {
    visualIntent: "map-relationship",
    layoutRecipe: "node-map",
    motionVariant: "line-draw",
    transition: "card-slide",
    pace: "medium",
  },
  "risk-contrast": {
    visualIntent: "compare-risk",
    layoutRecipe: "split-risk-cards",
    motionVariant: "warning-pulse",
    transition: "flash-wipe",
    pace: "strong",
  },
  timeline: {
    visualIntent: "show-sequence",
    layoutRecipe: "horizontal-timeline",
    motionVariant: "guided-pan",
    transition: "soft-wipe",
    pace: "medium",
  },
  "evidence-zoom": {
    visualIntent: "zoom-evidence",
    layoutRecipe: "screenshot-focus",
    motionVariant: "slow-push",
    transition: "scan-wipe",
    pace: "medium",
  },
  "concept-steps": {
    visualIntent: "teach-steps",
    layoutRecipe: "step-ladder",
    motionVariant: "card-stack",
    transition: "card-slide",
    pace: "soft",
  },
  "quote-impact": {
    visualIntent: "hit-quote",
    layoutRecipe: "quote-slam",
    motionVariant: "scale-pop",
    transition: "white-flash",
    pace: "strong",
  },
  "summary-card": {
    visualIntent: "wrap-up",
    layoutRecipe: "closing-summary",
    motionVariant: "type-build",
    transition: "soft-wipe",
    pace: "medium",
  },
};

const visualModulesFor = (sceneType: SceneType): Scene["visualModules"] => {
  const modules: NonNullable<Scene["visualModules"]> = [
    "transforms",
    "layers",
    "transitions",
    "effects",
    "fonts",
    "measuring",
    "animation-math",
    "svg-path",
    "color-interpolation",
  ];

  if (sceneType === "impact-hook" || sceneType === "quote-impact") modules.push("posterization", "starburst");
  if (sceneType === "risk-contrast") modules.push("light-leaks");
  if (sceneType === "relationship-map" || sceneType === "news-context") modules.push("randomness");
  if (sceneType === "data-breakdown") modules.push("html-in-canvas");

  return [...new Set(modules)];
};

const makeScene = (id: string, start: number, end: number, sceneType: SceneType, subtitle: string): Scene => ({
  id,
  start,
  end,
  subtitle,
  images: [],
  layout: sceneType === "summary-card" ? "ending" : sceneType === "impact-hook" ? "title" : "quote",
  emphasis: subtitle.match(/\d+(?:\.\d+)?|项目|授权|风险|资金/g)?.slice(0, 4) ?? ["12亿美金", "项目", "风险"],
  sceneType,
  ...recipeBySceneType[sceneType],
  visualModules: visualModulesFor(sceneType),
});

const renderInput = (style: VideoStyle, scenes: Scene[], width: number, height: number): RenderInput => ({
  scenes,
  duration: scenes.at(-1)?.end ?? 5,
  fps,
  width,
  height,
  styleProfile: buildRuntimeStyleProfile(style, width > height ? "16:9" : "9:16"),
});

const renderSample = async (serveUrl: string, name: string, inputProps: RenderInput) => {
  const composition = await selectComposition({
    serveUrl,
    id: "ShinVideo",
    inputProps,
  });
  const outputLocation = path.join(outputDir, `${name}.mp4`);

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
  });

  console.log(outputLocation);
};

const main = async () => {
  await mkdir(outputDir, { recursive: true });
  const serveUrl = await bundle(path.join(projectRoot, "remotion", "index.ts"));

  for (const sample of styleSamples) {
    await renderSample(
      serveUrl,
      `theme-${sample.style}-5s`,
      renderInput(sample.style, [makeScene(`theme-${sample.style}`, 0, 5, sample.sceneType, sample.text)], 960, 540),
    );
  }

  const mixedScenes = [
    makeScene("mixed-01", 0, 5, "impact-hook", "开场先把最大反常点抛出来：数字背后不是普通商业收入。"),
    makeScene("mixed-02", 5, 10, "data-breakdown", "第一层看数据，项目收入、授权收入和资产价格分别贡献不同部分。"),
    makeScene("mixed-03", 10, 15, "relationship-map", "第二层看关系，项目方、授权方和流量入口互相绑定。"),
    makeScene("mixed-04", 15, 20, "risk-contrast", "但风险也在这里，身份、资金和舆论开始叠在一起。"),
    makeScene("mixed-05", 20, 25, "concept-steps", "所以理解这件事，要先看结构，再看收益，最后看影响。"),
    makeScene("mixed-06", 25, 30, "summary-card", "最后结论：别只盯着一个数字，要看整条链路怎么形成。"),
  ];

  for (const sample of styleSamples) {
    await renderSample(serveUrl, `mixed-${sample.style}-30s-16x9`, renderInput(sample.style, mixedScenes, 960, 540));
  }

  await renderSample(serveUrl, "mixed-light-finance-mg-30s-9x16", renderInput("light-finance-mg", mixedScenes, 540, 960));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
