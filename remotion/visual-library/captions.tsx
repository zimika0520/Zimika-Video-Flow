import { interpolate, useCurrentFrame } from "remotion";
import type { CaptionLine } from "../../lib/types";
import type { VisualTheme } from "./types";
import { resolveTheme } from "./types";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const SafeSubtitleLayer = ({
  captions,
  fps,
  theme,
  bottom = 46,
  maxWidth = 1320,
}: {
  captions: CaptionLine[];
  fps: number;
  theme?: VisualTheme;
  bottom?: number;
  maxWidth?: number;
}) => {
  const frame = useCurrentFrame();
  const time = frame / fps;
  const active = captions.find((caption) => time >= caption.start && time < caption.end);
  const { palette, fontFamily } = resolveTheme(theme);
  if (!active) return null;

  const progress = interpolate(frame, [active.start * fps, active.start * fps + 8], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom,
        transform: `translateX(-50%) translateY(${(1 - progress) * 16}px)`,
        width: "min(86vw, 1320px)",
        maxWidth,
        color: palette.text,
        fontFamily,
        fontSize: 40,
        fontWeight: 760,
        lineHeight: 1.28,
        textAlign: "center",
        textShadow: "0 2px 14px rgba(255,255,255,0.86)",
        opacity: progress,
        padding: "0 32px",
        pointerEvents: "none",
      }}
    >
      {active.text}
    </div>
  );
};
