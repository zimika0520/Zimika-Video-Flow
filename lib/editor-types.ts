export type EditorElementType =
  | "headline"
  | "subtitle"
  | "image"
  | "metric-card"
  | "badge"
  | "connector"
  | "highlight";

export type EditorAnimation =
  | "fade"
  | "slide-up"
  | "pop"
  | "wipe"
  | "zoom-in"
  | "typewriter"
  | "number-tick"
  | "underline-sweep"
  | "pulse-outline"
  | "camera-push"
  | "camera-pull"
  | "flash-cut"
  | "card-flip";

export type VideoStyle =
  | "light-finance-mg"
  | "news-commentary"
  | "knowledge-explainer"
  | "fast-short-video"
  | "dark-data-analysis";

export type AnimationGroup = {
  title: string;
  description: string;
  options: EditorAnimation[];
};

export type StyleProfile = {
  label: string;
  description: string;
  accent: string;
  secondaryAccent: string;
  previewShellClass: string;
  previewClass: string;
  frameClass: string;
  labelClass: string;
  stageClass: string;
  cardClass: string;
  subtitleClass: string;
  rhythm: string;
  motion: string;
  sampleTitle: string;
  sampleSubtitle: string;
  sampleMetricLabel: string;
  sampleMetricValue: string;
  sampleMetricCaption: string;
  patch: Pick<EditorElement, "color" | "background" | "borderColor" | "accent">;
};

export type EditorElement = {
  id: string;
  type: EditorElementType;
  name: string;
  text?: string;
  value?: string;
  caption?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  opacity: number;
  color: string;
  background: string;
  borderColor: string;
  accent: string;
  radius: number;
  fontSize: number;
  fontWeight: number;
  shadow: boolean;
  animation: EditorAnimation;
  start: number;
  end: number;
  zIndex: number;
};

export const editorTypeLabel: Record<EditorElementType, string> = {
  headline: "标题",
  subtitle: "正文",
  image: "图片",
  "metric-card": "数据卡",
  badge: "标签",
  connector: "关系线",
  highlight: "高亮框",
};

export const animationLabel: Record<EditorAnimation, string> = {
  fade: "淡入",
  "slide-up": "上移",
  pop: "弹出",
  wipe: "擦入",
  "zoom-in": "缩放入场",
  typewriter: "打字机",
  "number-tick": "数字跳动",
  "underline-sweep": "下划线扫过",
  "pulse-outline": "描边闪烁",
  "camera-push": "镜头推近",
  "camera-pull": "镜头拉远",
  "flash-cut": "白场闪切",
  "card-flip": "卡片翻页",
};

export const styleProfiles: Record<VideoStyle, StyleProfile> = {
  "light-finance-mg": {
    label: "浅色财经 MG",
    description: "白底、数据卡、柔和高亮，适合财经和商业分析。",
    accent: "#2563eb",
    secondaryAccent: "#0f9f80",
    previewShellClass: "border-slate-200 bg-[linear-gradient(180deg,#f8fafc,#e8edf5)]",
    previewClass:
      "bg-[radial-gradient(circle_at_18%_20%,rgba(37,99,235,0.13),transparent_24%),radial-gradient(circle_at_82%_15%,rgba(15,159,128,0.12),transparent_22%),linear-gradient(150deg,#ffffff,#f7f9fc_55%,#edf2f8)]",
    frameClass: "border-white/80 bg-white shadow-slate-400/24",
    labelClass: "border-white/70 bg-white/72 text-slate-600",
    stageClass: "text-slate-950",
    cardClass: "border-blue-100 bg-white/88 text-slate-950 shadow-blue-100/60",
    subtitleClass: "text-slate-600",
    rhythm: "稳中带动",
    motion: "数据卡弹出 / 轻微推近",
    sampleTitle: "核心事件解读",
    sampleSubtitle: "用音频驱动时间轴，把重点数据、关系和结论转成动态视频画面。",
    sampleMetricLabel: "核心数据",
    sampleMetricValue: "3 点",
    sampleMetricCaption: "背景 / 变化 / 影响",
    patch: {
      color: "#10213a",
      background: "rgba(255,255,255,0.92)",
      borderColor: "rgba(37,99,235,0.16)",
      accent: "#2563eb",
    },
  },
  "news-commentary": {
    label: "新闻评论风",
    description: "栏目式标题、红黑强调、信息密度更高，适合事件解读。",
    accent: "#dc2626",
    secondaryAccent: "#111827",
    previewShellClass: "border-red-100 bg-[linear-gradient(180deg,#fff7f7,#eef2f7)]",
    previewClass:
      "bg-[linear-gradient(90deg,rgba(220,38,38,0.08)_0_12%,transparent_12%),linear-gradient(140deg,#ffffff_0%,#f8fafc_48%,#eef2f7_100%)]",
    frameClass: "border-red-100 bg-white shadow-red-200/24",
    labelClass: "border-red-100 bg-white/78 text-slate-800",
    stageClass: "text-slate-950",
    cardClass: "border-red-100 bg-white/92 text-slate-950 shadow-red-100/50",
    subtitleClass: "text-slate-700",
    rhythm: "克制推进",
    motion: "栏目切入 / 标题压场",
    sampleTitle: "一条收入线索，牵出政治与加密的交叉点",
    sampleSubtitle: "先看事实，再看资金结构，最后判断这件事为什么值得关注。",
    sampleMetricLabel: "核心看点",
    sampleMetricValue: "3 条",
    sampleMetricCaption: "收入来源 / 利益关系 / 舆论风险",
    patch: {
      color: "#111827",
      background: "rgba(255,255,255,0.94)",
      borderColor: "rgba(220,38,38,0.18)",
      accent: "#dc2626",
    },
  },
  "knowledge-explainer": {
    label: "知识解释风",
    description: "概念卡、步骤关系、重点拆解明显，适合把复杂内容讲清楚。",
    accent: "#0f9f80",
    secondaryAccent: "#2563eb",
    previewShellClass: "border-teal-100 bg-[linear-gradient(180deg,#f4fffb,#eaf3ff)]",
    previewClass:
      "bg-[radial-gradient(circle_at_20%_24%,rgba(20,184,166,0.12),transparent_25%),linear-gradient(145deg,#ffffff,#f8fbff_56%,#eef7f4)]",
    frameClass: "border-teal-100 bg-white shadow-teal-200/24",
    labelClass: "border-teal-100 bg-white/76 text-teal-900",
    stageClass: "text-teal-950",
    cardClass: "border-teal-100 bg-white/88 text-teal-950 shadow-teal-100/60",
    subtitleClass: "text-teal-900/72",
    rhythm: "分步解释",
    motion: "概念卡展开 / 关系线推进",
    sampleTitle: "这笔收入到底从哪里来？",
    sampleSubtitle: "把它拆成项目、授权、收益三个层级，就能看懂背后的逻辑。",
    sampleMetricLabel: "拆解层级",
    sampleMetricValue: "3 层",
    sampleMetricCaption: "项目主体 / 收益来源 / 影响判断",
    patch: {
      color: "#12312f",
      background: "rgba(255,255,255,0.9)",
      borderColor: "rgba(20,184,166,0.2)",
      accent: "#0f9f80",
    },
  },
  "fast-short-video": {
    label: "强节奏短视频风",
    description: "大字、强对比、快切和重强调，适合开场抓注意力。",
    accent: "#ef4444",
    secondaryAccent: "#f59e0b",
    previewShellClass: "border-orange-100 bg-[linear-gradient(180deg,#fff7ed,#eef2ff)]",
    previewClass:
      "bg-[radial-gradient(circle_at_18%_18%,rgba(239,68,68,0.15),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.18),transparent_22%),linear-gradient(145deg,#ffffff,#fff7ed_54%,#eef2ff)]",
    frameClass: "border-orange-100 bg-white shadow-orange-200/28",
    labelClass: "border-orange-100 bg-white/82 text-slate-900",
    stageClass: "text-slate-950",
    cardClass: "border-orange-100 bg-white/95 text-slate-950 shadow-orange-100/70",
    subtitleClass: "text-slate-800",
    rhythm: "强拍快切",
    motion: "大字弹出 / 白场闪切",
    sampleTitle: "这不是普通收入",
    sampleSubtitle: "一个数字背后，是项目、授权和政治身份同时叠加。",
    sampleMetricLabel: "注意力锚点",
    sampleMetricValue: "$57M",
    sampleMetricCaption: "先给结论 / 再拆原因 / 最后收束",
    patch: {
      color: "#121826",
      background: "rgba(255,255,255,0.95)",
      borderColor: "rgba(239,68,68,0.2)",
      accent: "#ef4444",
    },
  },
  "dark-data-analysis": {
    label: "深色数据分析风",
    description: "深色底、冷色数据线和仪表感，适合科技、数据和链上分析。",
    accent: "#60a5fa",
    secondaryAccent: "#14b8a6",
    previewShellClass: "border-slate-800 bg-[radial-gradient(circle_at_50%_0%,rgba(96,165,250,0.16),transparent_36%),linear-gradient(180deg,#111827,#020617)]",
    previewClass:
      "bg-[radial-gradient(circle_at_18%_20%,rgba(59,130,246,0.26),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(20,184,166,0.22),transparent_23%),linear-gradient(145deg,#101827,#18243a_52%,#0f172a)]",
    frameClass: "border-slate-700 bg-slate-950 shadow-slate-950/70",
    labelClass: "border-slate-600 bg-slate-950/72 text-slate-200",
    stageClass: "text-slate-100",
    cardClass: "border-blue-300/20 bg-slate-950/52 text-slate-100 shadow-blue-950/70",
    subtitleClass: "text-slate-300",
    rhythm: "冷静扫描",
    motion: "数据扫描 / 镜头推近",
    sampleTitle: "资金路径正在浮出水面",
    sampleSubtitle: "用时间戳对齐口播，再把关键数字变成可视化判断。",
    sampleMetricLabel: "链路节点",
    sampleMetricValue: "26",
    sampleMetricCaption: "时间戳 / 场景 / 动效",
    patch: {
      color: "#e6f0ff",
      background: "rgba(15,23,42,0.72)",
      borderColor: "rgba(96,165,250,0.26)",
      accent: "#60a5fa",
    },
  },
};

export const videoStyleLabel: Record<VideoStyle, string> = Object.fromEntries(
  Object.entries(styleProfiles).map(([key, profile]) => [key, profile.label]),
) as Record<VideoStyle, string>;

export const videoStyleDescription: Record<VideoStyle, string> = Object.fromEntries(
  Object.entries(styleProfiles).map(([key, profile]) => [key, profile.description]),
) as Record<VideoStyle, string>;

export const stylePreviewClass: Record<VideoStyle, string> = Object.fromEntries(
  Object.entries(styleProfiles).map(([key, profile]) => [key, profile.previewClass]),
) as Record<VideoStyle, string>;

export const animationGroups: AnimationGroup[] = [
  {
    title: "入场动效",
    description: "控制元素第一次出现的方式。",
    options: ["fade", "slide-up", "pop", "wipe", "zoom-in", "typewriter"],
  },
  {
    title: "强调动效",
    description: "适合关键词、数字和结论被强调。",
    options: ["number-tick", "underline-sweep", "pulse-outline", "pop"],
  },
  {
    title: "镜头动效",
    description: "模拟镜头推进、截图放大和信息跟随。",
    options: ["camera-push", "camera-pull", "zoom-in", "slide-up"],
  },
  {
    title: "转场动效",
    description: "适合场景切换和信息卡进入。",
    options: ["flash-cut", "card-flip", "wipe", "slide-up"],
  },
];

export const styleElementPatch: Record<
  VideoStyle,
  Pick<EditorElement, "color" | "background" | "borderColor" | "accent">
> = Object.fromEntries(Object.entries(styleProfiles).map(([key, profile]) => [key, profile.patch])) as Record<
  VideoStyle,
  Pick<EditorElement, "color" | "background" | "borderColor" | "accent">
>;

export const editorSeedElements: EditorElement[] = [
  {
    id: "headline-main",
    type: "headline",
    name: "主标题",
    text: "核心事件解读",
    x: 80,
    y: 84,
    width: 640,
    height: 110,
    scale: 1,
    opacity: 1,
    color: "#10213a",
    background: "rgba(255,255,255,0)",
    borderColor: "rgba(22,119,255,0)",
    accent: "#1677ff",
    radius: 24,
    fontSize: 58,
    fontWeight: 700,
    shadow: false,
    animation: "slide-up",
    start: 0,
    end: 17,
    zIndex: 5,
  },
  {
    id: "subtitle-main",
    type: "subtitle",
    name: "导语说明",
    text: "用音频驱动时间轴，再把重点数据、关系和结论转成动态视频画面。",
    x: 84,
    y: 208,
    width: 568,
    height: 112,
    scale: 1,
    opacity: 0.96,
    color: "#5b667a",
    background: "rgba(255,255,255,0)",
    borderColor: "rgba(22,119,255,0)",
    accent: "#7c8ca5",
    radius: 20,
    fontSize: 24,
    fontWeight: 500,
    shadow: false,
    animation: "fade",
    start: 0,
    end: 16,
    zIndex: 4,
  },
  {
    id: "metric-main",
    type: "metric-card",
    name: "数据卡",
    text: "年度相关收入",
    value: "$57M",
    caption: "资金路径 / 链上项目 / 授权收益",
    x: 784,
    y: 94,
    width: 334,
    height: 210,
    scale: 1,
    opacity: 1,
    color: "#112038",
    background: "rgba(255,255,255,0.92)",
    borderColor: "rgba(22,119,255,0.14)",
    accent: "#1677ff",
    radius: 30,
    fontSize: 22,
    fontWeight: 650,
    shadow: true,
    animation: "pop",
    start: 2,
    end: 25,
    zIndex: 7,
  },
  {
    id: "image-main",
    type: "image",
    name: "主图位",
    caption: "截图放大 / 证据图 / 推文引用",
    x: 710,
    y: 350,
    width: 374,
    height: 430,
    scale: 1,
    opacity: 1,
    color: "#34435a",
    background: "linear-gradient(180deg, rgba(240,247,255,0.98), rgba(224,236,255,0.92))",
    borderColor: "rgba(61,124,255,0.16)",
    accent: "#89b8ff",
    radius: 34,
    fontSize: 18,
    fontWeight: 600,
    shadow: true,
    animation: "wipe",
    start: 5,
    end: 28,
    zIndex: 3,
  },
  {
    id: "badge-main",
    type: "badge",
    name: "标签提示",
    text: "重点结论",
    x: 84,
    y: 420,
    width: 136,
    height: 46,
    scale: 1,
    opacity: 1,
    color: "#0d5ed8",
    background: "rgba(219,234,255,0.95)",
    borderColor: "rgba(93,155,255,0.28)",
    accent: "#1677ff",
    radius: 999,
    fontSize: 18,
    fontWeight: 650,
    shadow: false,
    animation: "fade",
    start: 7,
    end: 21,
    zIndex: 8,
  },
  {
    id: "highlight-main",
    type: "highlight",
    name: "高亮框",
    x: 94,
    y: 490,
    width: 420,
    height: 160,
    scale: 1,
    opacity: 0.9,
    color: "#0c203b",
    background: "rgba(255,255,255,0.62)",
    borderColor: "rgba(17,119,255,0.38)",
    accent: "#7ec7ff",
    radius: 28,
    fontSize: 20,
    fontWeight: 600,
    shadow: false,
    animation: "wipe",
    start: 8,
    end: 24,
    zIndex: 2,
  },
  {
    id: "connector-main",
    type: "connector",
    name: "关系线",
    x: 546,
    y: 520,
    width: 138,
    height: 12,
    scale: 1,
    opacity: 1,
    color: "#7aaeff",
    background: "linear-gradient(90deg, rgba(73,145,255,0.15), rgba(73,145,255,0.75), rgba(73,145,255,0.15))",
    borderColor: "rgba(22,119,255,0)",
    accent: "#1677ff",
    radius: 999,
    fontSize: 16,
    fontWeight: 500,
    shadow: false,
    animation: "slide-up",
    start: 9,
    end: 25,
    zIndex: 1,
  },
];
