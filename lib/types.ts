export type AppStatus =
  | "idle"
  | "checking-material-pack"
  | "ready-for-audio"
  | "generating-audio"
  | "uploading-audio"
  | "validating-timeline"
  | "generating-scenes"
  | "rendering"
  | "complete"
  | "error";

export type TimelineSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export type SceneLayout = "title" | "single-image" | "split-image" | "quote" | "ending";

export type SceneType =
  | "impact-hook"
  | "news-context"
  | "data-breakdown"
  | "relationship-map"
  | "risk-contrast"
  | "timeline"
  | "evidence-zoom"
  | "concept-steps"
  | "quote-impact"
  | "summary-card";

export type VisualIntent =
  | "hook-attention"
  | "establish-context"
  | "explain-number"
  | "map-relationship"
  | "compare-risk"
  | "show-sequence"
  | "zoom-evidence"
  | "teach-steps"
  | "hit-quote"
  | "wrap-up";

export type LayoutRecipe =
  | "metric-hero"
  | "news-column"
  | "stacked-data-cards"
  | "node-map"
  | "split-risk-cards"
  | "horizontal-timeline"
  | "screenshot-focus"
  | "step-ladder"
  | "quote-slam"
  | "closing-summary";

export type MotionVariant =
  | "scale-pop"
  | "line-draw"
  | "column-wipe"
  | "scan-rise"
  | "card-stack"
  | "white-flash"
  | "slow-push"
  | "guided-pan"
  | "warning-pulse"
  | "type-build";

export type SceneTransition =
  | "flash-wipe"
  | "column-cut"
  | "card-slide"
  | "white-flash"
  | "scan-wipe"
  | "soft-wipe";

export type VisualModule =
  | "transforms"
  | "assets"
  | "layers"
  | "transitions"
  | "effects"
  | "fonts"
  | "measuring"
  | "randomness"
  | "animation-math"
  | "posterization"
  | "html-in-canvas"
  | "noise"
  | "light-leaks"
  | "starburst"
  | "svg-path"
  | "color-interpolation";

export type ScenePace = "soft" | "medium" | "strong";

export type DirectorSceneType =
  | "Hero"
  | "Timeline"
  | "SystemMap"
  | "DataExplosion"
  | "Contrast"
  | "SpecSheet"
  | "Pricing"
  | "Pause"
  | "Summary"
  | "EvidenceHero"
  | "KeywordInvestigation"
  | "FinancialMeter"
  | "SystemStack"
  | "DependencyMap"
  | "QuestionPause"
  | "BarrierWall"
  | "EvidenceReturn"
  | "IndustrySignal"
  | "CompetitionLayerStack"
  | "FinalJudgement";

export type SemanticSourceKind =
  | "subtitle"
  | "article"
  | "user-asset"
  | "evidence-record"
  | "ai-concept";

export type SemanticSourceRef = {
  kind: SemanticSourceKind;
  text: string;
  referenceId?: string;
  supportsFacts: boolean;
  matchedClaim?: string;
};

export type SceneSemanticContext = {
  sourcesBySceneId: Record<string, SemanticSourceRef[]>;
};

export type SemanticConfidenceCategory =
  | "metrics"
  | "prices"
  | "timelineEvents"
  | "comparisons"
  | "relations"
  | "orderedLayers"
  | "barriers"
  | "questions"
  | "signals"
  | "judgements"
  | "concepts";

export type SceneSemantics = {
  sceneId: string;
  entities: string[];
  metrics: Array<{ label: string; value: string; unit?: string; source: SemanticSourceRef }>;
  prices: Array<{ label: string; value: string; currency?: string; source: SemanticSourceRef }>;
  timelineEvents: Array<{ label: string; order: number; timeExpression?: string; source: SemanticSourceRef }>;
  comparisons: Array<{ left: string; right: string; dimension?: string; source: SemanticSourceRef }>;
  relations: Array<{ from: string; to: string; relation: string; source: SemanticSourceRef }>;
  orderedLayers: string[];
  barriers: string[];
  questions: string[];
  signals: Array<{ sourceLabel: string; targets: string[]; source: SemanticSourceRef }>;
  judgements: Array<{ conclusion: string; evidence: string[]; source: SemanticSourceRef }>;
  concepts: string[];
  evidenceRefs: string[];
  pauseMarkers: string[];
  sources: SemanticSourceRef[];
  confidence: Record<SemanticConfidenceCategory, number>;
};

export type DirectorRendererFamily =
  | "hero"
  | "timeline"
  | "relationship-map"
  | "data"
  | "comparison"
  | "specification"
  | "pause"
  | "summary"
  | "evidence"
  | "cost-flow"
  | "system-stack"
  | "dependency-map"
  | "barrier-wall"
  | "signal-radar"
  | "competition-stack"
  | "judgement";

export type DirectorVisualTreatment =
  | "hero-title"
  | "hero-object-focus"
  | "ordered-events"
  | "milestone-track"
  | "node-network"
  | "relation-paths"
  | "metric-burst"
  | "metric-comparison"
  | "side-by-side"
  | "split-verdict"
  | "spec-table"
  | "spec-callouts"
  | "price-breakdown"
  | "price-comparison"
  | "question-hold"
  | "question-spotlight"
  | "closing-summary"
  | "closing-stack"
  | "evidence-zoom"
  | "evidence-annotated"
  | "keyword-investigation"
  | "keyword-cutaway"
  | "resource-pressure"
  | "resource-flow"
  | "layer-build"
  | "layer-cutaway"
  | "dual-supply-path"
  | "supply-lanes"
  | "barrier-grid"
  | "barrier-cross-section"
  | "evidence-return"
  | "evidence-recap"
  | "signal-rings"
  | "signal-ripple-map"
  | "competition-layers"
  | "competition-arena"
  | "final-judgement"
  | "final-proof-stack";

export type DirectorCompositionLayout =
  | "center-stage"
  | "object-right-copy-left"
  | "title-top-track-bottom"
  | "rail-left-detail-right"
  | "radial-network"
  | "flow-diagram"
  | "metric-center-orbit"
  | "metric-split-grid"
  | "equal-split"
  | "verdict-asymmetric"
  | "table-led"
  | "callout-orbit"
  | "price-waterfall"
  | "price-side-by-side"
  | "question-center"
  | "question-off-axis"
  | "summary-center"
  | "summary-stack"
  | "evidence-full-bleed"
  | "evidence-split-annotation"
  | "investigation-split"
  | "investigation-strip"
  | "pressure-gauge"
  | "resource-pipeline"
  | "stack-center"
  | "stack-diagonal"
  | "dual-path"
  | "lane-map"
  | "barrier-grid"
  | "barrier-section"
  | "evidence-recap"
  | "evidence-contact-sheet"
  | "signal-rings"
  | "signal-map"
  | "competition-stack"
  | "competition-arena"
  | "judgement-center"
  | "proof-stack";

export type DirectorCompositionMotion =
  | "center-reveal"
  | "object-push"
  | "track-draw"
  | "milestone-pop"
  | "network-bloom"
  | "path-trace"
  | "metric-burst"
  | "counter-stagger"
  | "split-open"
  | "verdict-snap"
  | "row-wipe"
  | "callout-stagger"
  | "waterfall-drop"
  | "focus-hold"
  | "spotlight-reveal"
  | "summary-settle"
  | "stack-rise"
  | "evidence-push"
  | "annotation-stagger"
  | "keyword-lock"
  | "cutaway-scan"
  | "pressure-fill"
  | "flow-trace"
  | "lane-flow"
  | "grid-lock"
  | "section-scan"
  | "recap-stagger"
  | "ring-pulse"
  | "ripple-spread"
  | "arena-orbit"
  | "proof-stagger";

export type DirectorCompositionTitlePlacement =
  | "hidden"
  | "top-left"
  | "top-center"
  | "left-rail"
  | "right-rail"
  | "bottom-left";

export type DirectorCompositionProfile = {
  directorType: DirectorSceneType;
  rendererFamily: DirectorRendererFamily;
  visualTreatment: DirectorVisualTreatment;
  layout: DirectorCompositionLayout;
  motion: DirectorCompositionMotion;
  titlePlacement: DirectorCompositionTitlePlacement;
};

export type DirectorCandidate = {
  type: DirectorSceneType;
  rendererFamily: DirectorRendererFamily;
  visualTreatment: DirectorVisualTreatment;
  semanticScore: number;
  narrativeScore: number;
  evidence: string[];
};

export type DirectorQualityTargets = {
  preferredForms: number;
  minimumForms: number;
  requiredForms: number;
  preferredFamilies: number;
  minimumFamilies: number;
  requiredFamilies: number;
};

export type DirectorContractIssue = {
  code: string;
  severity: "error" | "warning";
  sceneId: string;
  directorType: DirectorSceneType;
  field?: string;
  message: string;
  sourceText?: string;
};

export type VisualPriority = "low" | "medium" | "high" | "extreme";

export type DirectorNarrativeRole = "opening" | "turn" | "proof" | "reinforcement" | "closing" | "breath";

export type SceneRoleV2 = "memory" | "support" | "spike" | "transition";

export type ShotStyle = "Burst" | "Flow" | "Reveal" | "Zoom" | "Split" | "Collapse";

export type EntranceAnimation = "fadeBlurIn" | "slideParallaxIn" | "maskReveal" | "zoomIn" | "kineticPop";

export type EmphasisAnimation = "pulseGlow" | "microShake" | "highlightSweep" | "depthPush" | "elasticStretch";

export type TransitionAnimation = "wipe" | "morph" | "split" | "flowMerge" | "cameraPan";

export type DataAnimation = "kineticCounter" | "particleFormation" | "liquidFill" | "jitterSettle";

export type CameraMotion = "dollyIn" | "dollyOut" | "parallaxDrift" | "orbitalRotate";

export type BackgroundType = "Flat" | "Gradient" | "Mesh" | "Grid" | "DataField" | "AbstractFlow";

export type BackgroundMotion = "static" | "slowDrift" | "reactive" | "parallax";

export type BackgroundRole = "supportive" | "narrative" | "emotional";

export type SceneAnimationSystem = {
  entranceAnimation: EntranceAnimation;
  emphasisAnimation: EmphasisAnimation;
  transitionAnimation: TransitionAnimation;
  dataAnimation?: DataAnimation;
  cameraMotion: CameraMotion;
};

export type SceneBackgroundSystem = {
  backgroundType: BackgroundType;
  backgroundMotion: BackgroundMotion;
  backgroundRole: BackgroundRole;
};

export type AttentionCurvePoint = {
  range: string;
  label: string;
  intensity: number;
};

export type PeakMoment = {
  sceneId: string;
  reason: string;
  intensity: number;
};

export type DirectorNarrativeLayer = {
  structure: {
    opening: string;
    background?: string;
    coreUpgrade?: string;
    dataProof?: string;
    technicalAbility?: string;
    pricingAdvantage?: string;
    openSourceValue?: string;
    turn: string;
    proof: string;
    reinforcement: string;
    closing: string;
  };
  attentionCurve: AttentionCurvePoint[];
  peakMoments: PeakMoment[];
};

export type VideoArchetype =
  | "news-commentary"
  | "finance-explainer"
  | "event-breakdown"
  | "tech-demo"
  | "narrative-explainer";

export type CreativeTone = "urgent" | "measured" | "analytical" | "optimistic" | "reflective";

export type CreativeBrief = {
  archetype: VideoArchetype;
  purpose: string;
  audience: string;
  coreMessage: string;
  desiredAction: string;
  durationSeconds: number;
  estimatedSceneCount: number;
  emotionalArc: string;
  creativeDirection: {
    tone: CreativeTone;
    pacing: "steady" | "dynamic" | "layered";
    visualStrategy: string;
    subtitlePolicy: string;
    evidencePolicy: string;
  };
};

export type DirectorScriptScene = {
  id: string;
  start: number;
  end: number;
  duration: number;
  timeRange: string;
  purpose: string;
  coreIdea: string;
  informationFunction: "hook" | "context" | "proof" | "explain" | "contrast" | "payoff" | "closing";
  directorType: DirectorSceneType;
  shotStyle: ShotStyle;
  mainVisualRole: string;
  onScreenKeywords: string[];
  motionSuggestion: string;
  avoid: string;
};

export type RuntimeDirectorScript = {
  directorScriptVersion: number;
  videoArchetype: VideoArchetype;
  creativeBrief: CreativeBrief;
  reviewChecklist: string[];
  scenes: DirectorScriptScene[];
};

export type VideoDirectorWorkflow = {
  sourceSkill: "bayramannakov/remotion-video-director";
  adaptedPhases: ["Think", "Design", "Build", "Review"];
  sceneFocusRule: "one-scene-one-idea";
  archetypeMapping: {
    upstream: Array<"Product Launch" | "Recurring Data Report" | "Narrative Intro" | "Technical Demo" | "Growth Marketing">;
    shinVideo: VideoArchetype[];
  };
  expertReviewProtocol: Array<
    | "director"
    | "information-design"
    | "motion-design"
    | "caption-safety"
    | "audience-comprehension"
  >;
};

export type RemotionExecutionContract = {
  rendererRole: "execute-director-plan";
  subtitleSystem: "audio-timeline-independent";
  mainVisualPolicy: "explain-not-repeat-caption";
  requiredInputs: Array<
    | "RUN_DIR/video-brief.json"
    | "RUN_DIR/scenes.json"
    | "RUN_DIR/asset-manifest.json"
    | "RUN_DIR/visual-manifest.json"
    | "RUN_DIR/director-plan.json"
    | "RUN_DIR/style-profile.json"
    | "RUN_DIR/subtitle-timeline.json"
    | "口播音频.mp3"
  >;
  requiredOutputs: Array<"<项目目录>/<视频标题>.mp4">;
  remotionRules: Array<
    | "frame-driven-animation"
    | "clamped-interpolation"
    | "sequence-based-timing"
    | "component-reuse"
    | "text-measurement"
    | "no-css-transition-timeline"
  >;
};

export type RuntimeSubtitleStrategy = {
  timingSource: "provider-native";
  textSource: "voiceover-script";
  alignmentMethod: "map-confirmed-script-to-provider-timestamps";
  lineSubtitles: {
    maxCharsPerLine: number;
    maxLines: number;
    keepSentenceComplete: boolean;
  };
  insightSubtitles?: {
    enabled: boolean;
    policy: string;
  };
  safeZones: {
    position: "bottom";
    bottomPaddingPx: number;
    avoidMainVisualOverlap: boolean;
  };
  qa: Array<
    | "provider-timestamps-do-not-rewrite-subtitle-text"
    | "audio-change-invalidates-subtitle-timeline"
    | "subtitle-follows-audio-not-scene-card"
    | "complete-sentence-before-cut"
  >;
};

export type RuntimeVideoBrief = {
  videoBriefVersion: number;
  topic: string;
  audience: string;
  coreAngle: string;
  whyWatch: string;
  viewerDoubt: string;
  plainAnswer: string;
  hook: {
    firstThreeSeconds: string;
    viewerReasonToContinue: string;
  };
  narrativeArc: {
    opening: string;
    turn: string;
    proof: string;
    reinforcement: string;
    closing: string;
  };
  proofPoints: string[];
  assetNeeds: string[];
  visualDirection: {
    userPreference?: string;
    density: "balanced" | "rich" | "high";
    mustAvoid: string[];
  };
  subtitleStrategy: RuntimeSubtitleStrategy;
  productionGate: {
    requireVisualManifest: true;
    requireFinalAudioTiming: true;
    requireDirectorPlan: true;
    requireStyleProfile: true;
  };
  requiredOutputs: string[];
};

export type VisualManifestScene = {
  sceneId: string;
  visualGoal: string;
  primaryVisualAsset?: string;
  evidenceAsset?: string;
  narrationClaim: string;
  targetRegion: {
    coordinateSpace: "normalized_frame" | "rendered_frame_pixels" | "source_crop_pixels";
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    description?: string;
  };
  safeZones: {
    subtitle: "bottom";
    mainVisualAvoidsSubtitle: boolean;
  };
  overlapRisks: string[];
  whyThisVisual: string;
};

export type RuntimeVisualManifest = {
  visualManifestVersion: number;
  sourceScenesFingerprint?: string;
  scenes: VisualManifestScene[];
};

export type GeneratedImageVisualTreatment =
  | "full-screen-cinematic-crop"
  | "foreground-subject-plus-motion-graphics"
  | "partial-crop-beside-real-evidence"
  | "layered-parallax";

export type GeneratedImageSize = {
  width: number;
  height: number;
  [key: string]: unknown;
};

export type GeneratedImageManifestEntry = {
  id: string;
  fileName: string;
  model: string;
  prompt: string;
  requestedSize: GeneratedImageSize;
  actualSize: GeneratedImageSize;
  role: string;
  evidenceStatus: "concept-only";
  visualTreatment: GeneratedImageVisualTreatment;
  factLabel?: string;
  boundSceneIds: string[];
  requestRecord: string;
  responseRecord: string;
  [key: string]: unknown;
};

export type GeneratedImageManifest = {
  images: GeneratedImageManifestEntry[];
  [key: string]: unknown;
};

export type RuntimeAssetMetadata = {
  model?: string;
  prompt?: string;
  requestedSize?: GeneratedImageSize;
  actualSize?: GeneratedImageSize;
  evidenceStatus?: "concept-only";
  visualTreatment?: GeneratedImageVisualTreatment;
  factLabel?: string;
  [key: string]: unknown;
};

export type RuntimeAsset = {
  id: string;
  type: "image" | "web-screenshot" | "evidence-card" | "source-card" | "ai-generated";
  role: "evidence" | "context" | "brand" | "fallback" | "concept";
  sourceUrl: string;
  sourceTitle?: string;
  sourceDomain?: string;
  localPath: string;
  fileName: string;
  mimeType: string;
  attribution: string;
  usageRisk: "low" | "medium" | "unknown";
  capture?: {
    method: "headless-chrome" | "open-graph" | "generated-card" | "source-html" | "source-excerpt" | "ai-generation";
    viewport?: { width: number; height: number };
    capturedAt: string;
  };
  metadata?: RuntimeAssetMetadata;
  notes?: string;
};

export type RuntimeEvidenceRecord = {
  id: string;
  kind: "source-html" | "source-text" | "source-excerpt" | "external-page" | "external-screenshot" | "external-image";
  sourceUrl: string;
  sourceTitle?: string;
  sourceDomain?: string;
  localPath?: string;
  text?: string;
  targetText?: string;
  narrationClaim?: string;
  coordinateSpace?: "source_document" | "normalized_frame" | "source_crop_pixels" | "rendered_frame_pixels";
  verificationMethod: "browser-capture" | "headless-chrome" | "html-fetch" | "search-result" | "generated-card";
  capturedAt: string;
  notes?: string;
};

export type RuntimeAssetSceneBinding = {
  sceneId: string;
  assetIds: string[];
  reason: string;
  narrationClaim?: string;
  targetRegion?: VisualManifestScene["targetRegion"];
  layoutZones?: {
    reserved: Array<"header" | "evidence" | "insight" | "subtitle" | "callout">;
    overlapChecked: boolean;
  };
};

export type RuntimeAssetManifest = {
  assetManifestVersion: number;
  generatedAt: string;
  sourceMode: "web-research" | "browser-evidence" | "dry-run";
  queryTerms: string[];
  evidenceRecords?: RuntimeEvidenceRecord[];
  sourcePages: Array<{
    url: string;
    title: string;
    domain: string;
    query?: string;
    captured: boolean;
  }>;
  assets: RuntimeAsset[];
  sceneBindings: RuntimeAssetSceneBinding[];
  warnings: string[];
};

export type ProductionGateReport = {
  passed: boolean;
  errors: string[];
  warnings: string[];
  issues: QualityIssue[];
  checkedAt: string;
};

export type QualityIssue = {
  code: string;
  severity: "error" | "warning";
  stage: "pre-render" | "post-render";
  message: string;
  sceneId?: string;
  suggestedAction:
    | "regenerate-scene"
    | "regenerate-subtitles"
    | "replace-asset"
    | "shorten-copy"
    | "review-frame"
    | "rerender";
};

export type RenderQualitySummary = {
  videoPath: string;
  durationSeconds: number;
  width: number;
  height: number;
  sizeBytes: number;
  hasAudioStream: boolean;
  longBlackSegmentCount: number;
  primaryVisualUsage?: Array<{
    sceneId: string;
    assetId: string;
    fileName: string;
    rendered: boolean;
  }>;
};

export type VideoQualityReport = ProductionGateReport & {
  render?: RenderQualitySummary;
};

export type DirectorPlanScene = Partial<Scene> & {
  id: string;
  directorType?: DirectorSceneType;
  rendererFamily?: DirectorRendererFamily;
  visualTreatment?: DirectorVisualTreatment;
  layoutRecipe?: LayoutRecipe;
  shotStyle?: ShotStyle;
  importance?: number;
  animation?: Partial<SceneAnimationSystem>;
  background?: Partial<SceneBackgroundSystem>;
  directorMode?: string;
  visualMode?: string;
  investigationAction?: string;
  evidenceTreatment?: string;
  primaryAsset?: string;
  mainVisualText?: string[];
  motionGrammar?: Record<string, unknown>;
  transitionOut?: string;
  annotationMode?: string;
  maxCallouts?: number;
  safeZones?: Record<string, unknown>;
  captionPolicy?: Record<string, unknown> | string;
};

export type RuntimeDirectorPlan = {
  directorPlanVersion: number;
  sourceScenesFingerprint?: string;
  qualityTargets?: DirectorQualityTargets;
  videoDirectorWorkflow?: VideoDirectorWorkflow;
  remotionExecutionContract?: RemotionExecutionContract;
  videoArchetype?: VideoArchetype;
  creativeBrief?: CreativeBrief;
  videoBrief?: Pick<RuntimeVideoBrief, "topic" | "audience" | "coreAngle" | "whyWatch" | "visualDirection" | "subtitleStrategy">;
  visualManifestSummary?: {
    totalScenes: number;
    scenesWithEvidenceAssets: number;
    declaredOverlapRisks: number;
  };
  narrativeArc?: Record<string, unknown>;
  globalRules?: Record<string, unknown>;
  directorScriptSummary?: {
    totalScenes: number;
    reviewChecklist: string[];
  };
  attentionCurve: AttentionCurvePoint[];
  peakMoments: PeakMoment[];
  scenes: DirectorPlanScene[];
};

export type DirectorSceneContent = {
  headline?: string;
  centerLabel?: string;
  sceneTitle?: string;
  keywords?: string[];
  keywordTags?: string[];
  evidenceKeywords?: string[];
  factBoundary?: string[];
  doNotUse?: string[];
  cornerCompare?: string[];
  captionIntent?: string;
  leftVisual?: string;
  rightVisual?: string;
  differenceRule?: string;
  dataWidgets?: string[];
  chartStyleRule?: string;
  layers?: Array<string | { name?: string; label?: string; visual?: string; note?: string }>;
  highlight?: string;
  centerNode?: string;
  leftPath?: { node?: string; riskTags?: string[] };
  rightPath?: { node?: string; riskTags?: string[] };
  layoutRule?: string;
  background?: string;
  action?: string;
  forbiddenText?: string;
  barriers?: Array<{ label: string; visual?: string; shape?: string }>;
  evidenceLabel?: string;
  judgementPanel?: string[];
  judgementTags?: string[];
  signalSource?: string;
  metrics?: Array<{
    label: string;
    value: string;
    note?: string;
  }>;
  marketSeries?: Array<{
    label: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    source: SemanticSourceRef;
  }>;
  nodes?: Array<{ label: string; role?: string } | string>;
  timelineItems?: Array<{
    label: string;
    title: string;
    note?: string;
  }>;
  comparisons?: Array<{
    label: string;
    value: string;
  }>;
  summaryItems?: string[];
};

export type SceneVisualBrief = {
  kicker?: string;
  headline?: string;
  centerLabel?: string;
  subhead?: string;
  primaryMetric?: {
    value: string;
    label: string;
  };
  metricCards?: Array<{
    label: string;
    value: string;
    note?: string;
  }>;
  timelineItems?: Array<{
    label: string;
    title: string;
    note?: string;
  }>;
  nodes?: Array<{
    label: string;
    role?: string;
  }>;
  tags?: string[];
  comparisonCards?: Array<{
    label: string;
    value: string;
  }>;
  summaryItems?: string[];
};

export type Scene = {
  id: string;
  start: number;
  end: number;
  title?: string;
  subtitle: string;
  images: string[];
  layout: SceneLayout;
  emphasis?: string[];
  sceneType?: SceneType;
  visualIntent?: VisualIntent;
  layoutRecipe?: LayoutRecipe;
  motionVariant?: MotionVariant;
  transition?: SceneTransition;
  visualModules?: VisualModule[];
  pace?: ScenePace;
  visualBrief?: SceneVisualBrief;
  directorType?: DirectorSceneType;
  semantics?: SceneSemantics;
  rendererFamily?: DirectorRendererFamily;
  visualTreatment?: DirectorVisualTreatment;
  directorContractIssues?: DirectorContractIssue[];
  narrativeRole?: DirectorNarrativeRole;
  intensity?: 1 | 2 | 3 | 4 | 5;
  importance?: number;
  role?: SceneRoleV2;
  shotStyle?: ShotStyle;
  visualPriority?: VisualPriority;
  motionStyle?: "soft" | "medium" | "sharp";
  animation?: SceneAnimationSystem;
  background?: SceneBackgroundSystem;
  components?: string[];
  content?: DirectorSceneContent;
  directorMode?: string;
  visualMode?: string;
  investigationAction?: string;
  evidenceTreatment?: string;
  primaryVisualAsset?: string;
  evidenceAsset?: string;
  primaryAsset?: string;
  mainVisualText?: string[];
  motionGrammar?: Record<string, unknown>;
  transitionOut?: string;
  annotationMode?: string;
  maxCallouts?: number;
  safeZones?: Record<string, unknown>;
  captionPolicy?: Record<string, unknown> | string;
};

export type CaptionLine = {
  text: string;
  start: number;
  end: number;
};

export type RuntimeStyleProfile = {
  styleProfileVersion: number;
  styleKey:
    | "light-finance-mg"
    | "news-commentary"
    | "knowledge-explainer"
    | "fast-short-video"
    | "dark-data-analysis";
  styleName: string;
  aspectRatio?: `${number}:${number}`;
  visualFoundation: {
    background: {
      type: "light-grid" | "news-column" | "concept-map" | "impact-cards" | "dark-grid";
      colors: string[];
      gridOpacity: number;
      noise: { enabled: boolean; opacity: number };
    };
    palette: {
      primary: string;
      secondary: string;
      accent: string;
      warning: string;
      text: string;
      muted: string;
      paper: string;
      panel: string;
      line: string;
    };
    typography: {
      fontFamily: string;
      titleWeight: number;
      captionWeight: number;
      lineHeight: number;
      maxCharsPerLine: number;
    };
  };
  layoutSystem: {
    safeArea: { top: number; right: number; bottom: number; left: number };
    layers: string[];
    overflowGuard: boolean;
    measureTextBeforeRender: boolean;
  };
  motionSystem: {
    intensity: "soft" | "medium" | "strong";
    titleEnter: "kinetic-slide" | "news-slam" | "step-reveal" | "impact-pop" | "data-scan";
    cardEnter: "spring-pop" | "column-wipe" | "stack-expand" | "flash-cut" | "scan-rise";
    keywordHighlight: "underline-sweep" | "marker-bar" | "concept-pill" | "punch-scale" | "glow-scan";
    camera: "slow-push" | "locked-column" | "guided-pan" | "snap-zoom" | "data-dolly";
    transformComposer: "makeTransform";
    colorInterpolation: "interpolateColors";
  };
  effectsSystem: {
    borderRadius: number;
    boxShadow: string;
    filter: string;
    gradient: string;
    lightLeaks: boolean;
    starburst: boolean;
    svgPathMotion: boolean;
  };
  transitionSystem: {
    default: "flash-wipe" | "column-cut" | "card-slide" | "white-flash" | "scan-wipe" | "soft-wipe";
    durationFrames: number;
    posterize: boolean;
  };
  recipeSystem?: {
    sceneTypes: SceneType[];
    layoutRecipes: LayoutRecipe[];
    motionVariants: MotionVariant[];
    visualModules: VisualModule[];
    defaultSequence: SceneType[];
  };
  motionModules?: {
    title: MotionVariant[];
    cards: MotionVariant[];
    camera: Array<"slow-push" | "guided-pan" | "snap-zoom" | "data-dolly" | "locked-column">;
    keyword: Array<"underline-sweep" | "marker-bar" | "concept-pill" | "punch-scale" | "glow-scan">;
  };
  transitionModules?: SceneTransition[];
  effectModules?: VisualModule[];
  directorSystem?: {
    shotStyles: ShotStyle[];
    entranceAnimations: EntranceAnimation[];
    emphasisAnimations: EmphasisAnimation[];
    transitionAnimations: TransitionAnimation[];
    dataAnimations: DataAnimation[];
    cameraMotions: CameraMotion[];
    backgroundTypes: BackgroundType[];
  };
  sectionPacing?: {
    opening: ScenePace;
    middle: ScenePace;
    ending: ScenePace;
  };
};

export type RenderInput = {
  scenes: Scene[];
  captions?: CaptionLine[];
  audioSrc?: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  styleProfile?: RuntimeStyleProfile;
  directorPlan?: RuntimeDirectorPlan;
  narrativeLayer?: DirectorNarrativeLayer;
  videoArchetype?: VideoArchetype;
  creativeBrief?: CreativeBrief;
  directorScript?: RuntimeDirectorScript;
  videoBrief?: RuntimeVideoBrief;
  visualManifest?: RuntimeVisualManifest;
  assetManifest?: RuntimeAssetManifest;
  directorQualityTargets?: DirectorQualityTargets;
};

export const defaultStyleProfile: RuntimeStyleProfile = {
  styleProfileVersion: 1,
  styleKey: "light-finance-mg",
  styleName: "浅色财经 MG",
  aspectRatio: "16:9",
  visualFoundation: {
    background: {
      type: "light-grid",
      colors: ["#ffffff", "#f7f9fc", "#edf2f8"],
      gridOpacity: 0.28,
      noise: { enabled: false, opacity: 0 },
    },
    palette: {
      primary: "#2563eb",
      secondary: "#0f9f80",
      accent: "#06b6d4",
      warning: "#f59e0b",
      text: "#111827",
      muted: "#64748b",
      paper: "#f7f9fc",
      panel: "#ffffff",
      line: "#dbe5f2",
    },
    typography: {
      fontFamily: "Inter, Arial, sans-serif",
      titleWeight: 920,
      captionWeight: 700,
      lineHeight: 1.28,
      maxCharsPerLine: 26,
    },
  },
  layoutSystem: {
    safeArea: { top: 50, right: 78, bottom: 42, left: 78 },
    layers: ["background", "progress", "headline", "cards", "subtitle", "transition"],
    overflowGuard: true,
    measureTextBeforeRender: true,
  },
  motionSystem: {
    intensity: "medium",
    titleEnter: "kinetic-slide",
    cardEnter: "spring-pop",
    keywordHighlight: "underline-sweep",
    camera: "slow-push",
    transformComposer: "makeTransform",
    colorInterpolation: "interpolateColors",
  },
  effectsSystem: {
    borderRadius: 8,
    boxShadow: "0 26px 72px rgba(15, 23, 42, 0.14)",
    filter: "saturate(1.04) contrast(1.02)",
    gradient: "linear-gradient(90deg, #2563eb, #0f9f80)",
    lightLeaks: true,
    starburst: false,
    svgPathMotion: true,
  },
  transitionSystem: {
    default: "flash-wipe",
    durationFrames: 18,
    posterize: false,
  },
};

export const defaultRenderInput: RenderInput = {
  duration: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  styleProfile: defaultStyleProfile,
  scenes: [
    {
      id: "placeholder",
      start: 0,
      end: 5,
      subtitle: "等待生成视频时间轴",
      images: [],
      layout: "title",
    },
  ],
};
