import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { TimedVisualProps } from "./types";
import { resolveTheme } from "./types";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const SoftGradientBackground = ({ theme, style }: TimedVisualProps) => {
  const frame = useCurrentFrame();
  const { palette } = resolveTheme(theme);
  const drift = interpolate(frame % 240, [0, 120, 240], [0, 1, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${24 + drift * 28}% ${22 + drift * 20}%, ${palette.secondary}26, transparent 35%), radial-gradient(circle at ${76 - drift * 18}% 74%, ${palette.accent}20, transparent 38%), linear-gradient(135deg, ${palette.bg}, #ffffff)`,
        ...style,
      }}
    />
  );
};

export const DataFieldBackground = ({ theme, style }: TimedVisualProps) => {
  const frame = useCurrentFrame();
  const { palette } = resolveTheme(theme);
  const offset = frame % 48;
  return (
    <AbsoluteFill
      style={{
        background: palette.bg,
        backgroundImage: `linear-gradient(${palette.line} 1px, transparent 1px), linear-gradient(90deg, ${palette.line} 1px, transparent 1px), radial-gradient(circle at 50% 30%, ${palette.primary}18, transparent 40%)`,
        backgroundSize: "56px 56px, 56px 56px, 100% 100%",
        backgroundPosition: `${offset}px ${offset}px, ${offset}px ${offset}px, 0 0`,
        ...style,
      }}
    />
  );
};

export const GridDepthBackground = ({ theme, style }: TimedVisualProps) => {
  const frame = useCurrentFrame();
  const { palette } = resolveTheme(theme);
  const y = interpolate(frame % 180, [0, 180], [0, 80], clamp);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${palette.bg}, #eef5ff)`,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "-10%",
          right: "-10%",
          bottom: "-18%",
          height: "62%",
          transform: "perspective(700px) rotateX(62deg)",
          backgroundImage: `linear-gradient(${palette.primary}26 2px, transparent 2px), linear-gradient(90deg, ${palette.primary}26 2px, transparent 2px)`,
          backgroundSize: "80px 80px",
          backgroundPosition: `0 ${y}px`,
        }}
      />
    </AbsoluteFill>
  );
};

export const RadarBackground = ({ theme, style }: TimedVisualProps) => {
  const frame = useCurrentFrame();
  const { palette } = resolveTheme(theme);
  return (
    <AbsoluteFill style={{ background: palette.bg, overflow: "hidden", ...style }}>
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) rotate(${frame * 0.18}deg)`,
          background: `conic-gradient(from 0deg, ${palette.primary}44, transparent 24%, transparent 100%)`,
          opacity: 0.5,
        }}
      />
      {[0, 1, 2].map((ring) => (
        <div
          key={ring}
          style={{
            position: "absolute",
            width: 320 + ring * 220,
            height: 320 + ring * 220,
            borderRadius: "50%",
            border: `1px solid ${palette.line}`,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
