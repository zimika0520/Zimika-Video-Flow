import { directorCapabilities } from "./director-capabilities";
import type {
  DirectorCompositionLayout,
  DirectorCompositionMotion,
  DirectorCompositionProfile,
  DirectorCompositionTitlePlacement,
  DirectorPlanScene,
  DirectorSceneType,
  DirectorVisualTreatment,
  Scene,
} from "./types";

type CompositionSeed = {
  layout: DirectorCompositionLayout;
  motion: DirectorCompositionMotion;
  titlePlacement: DirectorCompositionTitlePlacement;
};

const profiles: Record<DirectorVisualTreatment, CompositionSeed> = {
  "hero-title": {
    layout: "center-stage",
    motion: "center-reveal",
    titlePlacement: "hidden",
  },
  "hero-object-focus": {
    layout: "object-right-copy-left",
    motion: "object-push",
    titlePlacement: "top-left",
  },
  "ordered-events": {
    layout: "title-top-track-bottom",
    motion: "track-draw",
    titlePlacement: "top-left",
  },
  "milestone-track": {
    layout: "rail-left-detail-right",
    motion: "milestone-pop",
    titlePlacement: "left-rail",
  },
  "node-network": {
    layout: "radial-network",
    motion: "network-bloom",
    titlePlacement: "top-center",
  },
  "relation-paths": {
    layout: "flow-diagram",
    motion: "path-trace",
    titlePlacement: "top-left",
  },
  "metric-burst": {
    layout: "metric-center-orbit",
    motion: "metric-burst",
    titlePlacement: "top-left",
  },
  "metric-comparison": {
    layout: "metric-split-grid",
    motion: "counter-stagger",
    titlePlacement: "top-center",
  },
  "side-by-side": {
    layout: "equal-split",
    motion: "split-open",
    titlePlacement: "top-center",
  },
  "split-verdict": {
    layout: "verdict-asymmetric",
    motion: "verdict-snap",
    titlePlacement: "top-left",
  },
  "spec-table": {
    layout: "table-led",
    motion: "row-wipe",
    titlePlacement: "right-rail",
  },
  "spec-callouts": {
    layout: "callout-orbit",
    motion: "callout-stagger",
    titlePlacement: "top-left",
  },
  "price-breakdown": {
    layout: "price-waterfall",
    motion: "waterfall-drop",
    titlePlacement: "top-left",
  },
  "price-comparison": {
    layout: "price-side-by-side",
    motion: "counter-stagger",
    titlePlacement: "top-center",
  },
  "question-hold": {
    layout: "question-center",
    motion: "focus-hold",
    titlePlacement: "hidden",
  },
  "question-spotlight": {
    layout: "question-off-axis",
    motion: "spotlight-reveal",
    titlePlacement: "bottom-left",
  },
  "closing-summary": {
    layout: "summary-center",
    motion: "summary-settle",
    titlePlacement: "top-center",
  },
  "closing-stack": {
    layout: "summary-stack",
    motion: "stack-rise",
    titlePlacement: "left-rail",
  },
  "evidence-zoom": {
    layout: "evidence-full-bleed",
    motion: "evidence-push",
    titlePlacement: "bottom-left",
  },
  "evidence-annotated": {
    layout: "evidence-split-annotation",
    motion: "annotation-stagger",
    titlePlacement: "top-left",
  },
  "keyword-investigation": {
    layout: "investigation-split",
    motion: "keyword-lock",
    titlePlacement: "top-left",
  },
  "keyword-cutaway": {
    layout: "investigation-strip",
    motion: "cutaway-scan",
    titlePlacement: "right-rail",
  },
  "resource-pressure": {
    layout: "pressure-gauge",
    motion: "pressure-fill",
    titlePlacement: "top-left",
  },
  "resource-flow": {
    layout: "resource-pipeline",
    motion: "flow-trace",
    titlePlacement: "top-center",
  },
  "layer-build": {
    layout: "stack-center",
    motion: "stack-rise",
    titlePlacement: "top-left",
  },
  "layer-cutaway": {
    layout: "stack-diagonal",
    motion: "cutaway-scan",
    titlePlacement: "right-rail",
  },
  "dual-supply-path": {
    layout: "dual-path",
    motion: "path-trace",
    titlePlacement: "top-center",
  },
  "supply-lanes": {
    layout: "lane-map",
    motion: "lane-flow",
    titlePlacement: "left-rail",
  },
  "barrier-grid": {
    layout: "barrier-grid",
    motion: "grid-lock",
    titlePlacement: "top-left",
  },
  "barrier-cross-section": {
    layout: "barrier-section",
    motion: "section-scan",
    titlePlacement: "right-rail",
  },
  "evidence-return": {
    layout: "evidence-recap",
    motion: "evidence-push",
    titlePlacement: "top-left",
  },
  "evidence-recap": {
    layout: "evidence-contact-sheet",
    motion: "recap-stagger",
    titlePlacement: "top-center",
  },
  "signal-rings": {
    layout: "signal-rings",
    motion: "ring-pulse",
    titlePlacement: "top-left",
  },
  "signal-ripple-map": {
    layout: "signal-map",
    motion: "ripple-spread",
    titlePlacement: "right-rail",
  },
  "competition-layers": {
    layout: "competition-stack",
    motion: "stack-rise",
    titlePlacement: "top-left",
  },
  "competition-arena": {
    layout: "competition-arena",
    motion: "arena-orbit",
    titlePlacement: "top-center",
  },
  "final-judgement": {
    layout: "judgement-center",
    motion: "verdict-snap",
    titlePlacement: "top-center",
  },
  "final-proof-stack": {
    layout: "proof-stack",
    motion: "proof-stagger",
    titlePlacement: "left-rail",
  },
};

const fallbackTreatmentByType = (type: DirectorSceneType): DirectorVisualTreatment =>
  directorCapabilities[type].allowedTreatments[0];

export const getDirectorCompositionProfile = (
  type: DirectorSceneType,
  treatment?: DirectorVisualTreatment,
): DirectorCompositionProfile => {
  const capability = directorCapabilities[type];
  const selectedTreatment =
    treatment && capability.allowedTreatments.includes(treatment)
      ? treatment
      : fallbackTreatmentByType(type);
  const profile = profiles[selectedTreatment];

  return {
    directorType: type,
    rendererFamily: capability.rendererFamily,
    visualTreatment: selectedTreatment,
    ...profile,
  };
};

export const resolveDirectorCompositionProfile = (
  scene: Pick<Scene, "directorType" | "visualTreatment">,
): DirectorCompositionProfile | undefined =>
  scene.directorType
    ? getDirectorCompositionProfile(scene.directorType, scene.visualTreatment)
    : undefined;

export const directorCompositionSignature = (
  scene: Pick<
    DirectorPlanScene,
    "directorType" | "rendererFamily" | "visualTreatment" | "components" | "layoutRecipe"
  > & { type?: DirectorSceneType },
): string => {
  const type = scene.type ?? scene.directorType;
  if (!type) {
    return JSON.stringify({
      rendererFamily: scene.rendererFamily,
      visualTreatment: scene.visualTreatment,
      layoutRecipe: scene.layoutRecipe,
      components: scene.components ?? [],
    });
  }

  const profile = getDirectorCompositionProfile(type, scene.visualTreatment);
  return JSON.stringify({
    rendererFamily: scene.rendererFamily ?? profile.rendererFamily,
    visualTreatment: profile.visualTreatment,
    layout: profile.layout,
    motion: profile.motion,
    titlePlacement: profile.titlePlacement,
    layoutRecipe: scene.layoutRecipe,
    components: scene.components ?? [],
  });
};

