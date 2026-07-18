import { Easing, interpolate, spring } from "remotion";
import type { CameraMotion, EmphasisAnimation, EntranceAnimation, MotionVariant, ScenePace, ShotStyle } from "../../lib/types";

type CameraVariant = MotionVariant | "snap-zoom" | "data-dolly" | "locked-column";

export const visualEase = Easing.bezier(0.16, 1, 0.3, 1);

export const clampInterpolate = (frame: number, input: [number, number], output: [number, number]) =>
  interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: visualEase,
  });

export const makeTransform = (parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export const entranceTransform = ({
  frame,
  fps,
  variant,
  pace = "medium",
}: {
  frame: number;
  fps: number;
  variant?: MotionVariant;
  pace?: ScenePace;
}) => {
  const force = pace === "strong" ? 1.28 : pace === "soft" ? 0.72 : 1;
  const pop = spring({ frame, fps, config: { damping: 16, stiffness: 130 } });
  const opacity = clampInterpolate(frame, [0, 14], [0, 1]);
  const y = clampInterpolate(frame, [0, 20], [34 * force, 0]);
  const x = variant === "column-wipe" ? clampInterpolate(frame, [0, 18], [-46 * force, 0]) : 0;
  const scale =
    variant === "scale-pop" || variant === "white-flash"
      ? 0.86 + pop * 0.14
      : variant === "scan-rise"
        ? clampInterpolate(frame, [0, 22], [0.96, 1])
        : 1;
  const rotate = variant === "warning-pulse" ? clampInterpolate(frame, [0, 18], [-1.2 * force, 0]) : 0;

  return {
    opacity,
    transform: makeTransform([
      `translate(${x}px, ${y}px)`,
      `scale(${scale})`,
      rotate ? `rotate(${rotate}deg)` : false,
    ]),
  };
};

export const cameraTransform = (frame: number, variant?: CameraVariant, pace: ScenePace = "medium") => {
  const force = pace === "strong" ? 1.35 : pace === "soft" ? 0.62 : 1;
  const entranceWindow = 30;
  const lockedFrame = Math.min(frame, entranceWindow);
  if (variant === "locked-column") {
    return "scale(1)";
  }
  if (variant === "snap-zoom") {
    const hit = spring({ frame: lockedFrame, fps: 30, config: { damping: 18, stiffness: 150 } });
    return makeTransform([`scale(${0.98 + hit * 0.02})`]);
  }
  if (variant === "data-dolly") {
    return makeTransform([`translateY(${clampInterpolate(lockedFrame, [0, 28], [8 * force, 0])}px)`]);
  }
  if (variant === "guided-pan") {
    return makeTransform([`translateX(${clampInterpolate(lockedFrame, [0, 28], [-12 * force, 0])}px)`]);
  }
  if (variant === "warning-pulse") {
    return makeTransform([`scale(${0.99 + clampInterpolate(lockedFrame, [0, 24], [0, 0.01 * force])})`]);
  }
  if (variant === "white-flash") {
    return "scale(1)";
  }
  return makeTransform([`scale(${0.992 + clampInterpolate(lockedFrame, [0, 30], [0, 0.008 * force])})`]);
};

export const entranceAnimationStyle = ({
  frame,
  fps,
  animation,
  shotStyle,
  pace = "medium",
}: {
  frame: number;
  fps: number;
  animation?: EntranceAnimation;
  shotStyle?: ShotStyle;
  pace?: ScenePace;
}) => {
  const force = pace === "strong" ? 1.24 : pace === "soft" ? 0.76 : 1;
  const pop = spring({ frame, fps, config: { damping: 15, stiffness: 150 } });
  const opacity = clampInterpolate(frame, [0, 16], [0, 1]);
  const blur = animation === "fadeBlurIn" ? clampInterpolate(frame, [0, 18], [18, 0]) : 0;
  const mask = animation === "maskReveal" ? clampInterpolate(frame, [0, 22], [18, 100]) : 100;
  const x = animation === "slideParallaxIn" ? clampInterpolate(frame, [0, 24], [-60 * force, 0]) : 0;
  const y =
    animation === "slideParallaxIn"
      ? clampInterpolate(frame, [0, 24], [34 * force, 0])
      : animation === "kineticPop"
        ? clampInterpolate(frame, [0, 14], [18 * force, 0])
        : 0;
  const zoom = animation === "zoomIn" ? clampInterpolate(frame, [0, 28], [0.9, 1]) : animation === "kineticPop" ? 0.84 + pop * 0.16 : 1;
  const burstRotate = shotStyle === "Burst" && animation === "kineticPop" ? clampInterpolate(frame, [0, 16], [-1.4 * force, 0]) : 0;

  return {
    opacity,
    filter: blur ? `blur(${blur}px)` : undefined,
    clipPath: animation === "maskReveal" ? `inset(0 ${100 - mask}% 0 0 round 18px)` : undefined,
    transform: makeTransform([`translate(${x}px, ${y}px)`, `scale(${zoom})`, burstRotate ? `rotate(${burstRotate}deg)` : false]),
  };
};

export const cameraMotionTransform = (frame: number, motion?: CameraMotion, pace: ScenePace = "medium") => {
  const force = pace === "strong" ? 1.22 : pace === "soft" ? 0.66 : 1;
  const lockedFrame = Math.min(frame, 30);
  if (motion === "dollyOut") {
    return makeTransform([`scale(${1.012 - clampInterpolate(lockedFrame, [0, 30], [0, 0.012 * force])})`]);
  }
  if (motion === "parallaxDrift") {
    return makeTransform([
      `translateY(${clampInterpolate(lockedFrame, [0, 28], [8 * force, 0])}px)`,
      `scale(${1})`,
    ]);
  }
  if (motion === "orbitalRotate") {
    return makeTransform([`translateX(${clampInterpolate(lockedFrame, [0, 28], [-10 * force, 0])}px)`]);
  }
  return makeTransform([`scale(${0.992 + clampInterpolate(lockedFrame, [0, 30], [0, 0.008 * force])})`]);
};

export const emphasisAnimationStyle = (frame: number, animation?: EmphasisAnimation, color = "#2563eb") => {
  if (animation === "pulseGlow") {
    const glow = clampInterpolate(frame, [0, 44], [0, 1]);
    return { boxShadow: `0 28px 90px ${color}${glow > 0.5 ? "30" : "18"}` };
  }
  if (animation === "microShake") {
    return { backgroundImage: `linear-gradient(90deg, transparent, ${color}18, transparent)`, backgroundSize: "220% 100%", backgroundPosition: `${clampInterpolate(frame, [0, 54], [220, 0])}% 0` };
  }
  if (animation === "depthPush") {
    return { transform: `scale(${1 + clampInterpolate(frame, [0, 72], [0, 0.018])})` };
  }
  if (animation === "elasticStretch") {
    return { transform: `scaleX(${1 + clampInterpolate(frame, [0, 38], [0.018, 0])})` };
  }
  return { backgroundImage: `linear-gradient(90deg, transparent, ${color}18, transparent)`, backgroundSize: "220% 100%", backgroundPosition: `${clampInterpolate(frame, [0, 54], [220, 0])}% 0` };
};
