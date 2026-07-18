import type { CSSProperties, ReactNode } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const easeProgress = (frame: number, start = 0, end = 24) =>
  interpolate(frame, [start, end], [0, 1], clamp);

export const NumberCount = ({
  value,
  decimals = 0,
  suffix = "",
  startFrame = 0,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  startFrame?: number;
}) => {
  const frame = useCurrentFrame();
  const progress = spring({
    frame: Math.max(0, frame - startFrame),
    fps: 30,
    config: { damping: 22, stiffness: 90, mass: 0.8 },
  });
  return <>{(value * progress).toFixed(decimals)}{suffix}</>;
};

export const RevealText = ({
  text,
  delay = 0,
  step = 3,
  style,
}: {
  text: string;
  delay?: number;
  step?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const chars = Array.from(text);
  return (
    <span style={style}>
      {chars.map((char, index) => {
        const progress = easeProgress(frame, delay + index * step, delay + index * step + 12);
        return (
          <span
            key={`${char}-${index}`}
            style={{
              opacity: progress,
              transform: `translateY(${(1 - progress) * 18}px)`,
              display: char.trim() ? "inline-block" : "inline",
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
};

export const CameraPush = ({
  children,
  amount = 0.04,
  startFrame = 0,
  style,
}: {
  children: ReactNode;
  amount?: number;
  startFrame?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame - startFrame, [0, fps * 5], [0, 1], clamp);
  return (
    <div
      style={{
        transform: `scale(${1 + progress * amount}) translateY(${-progress * 10}px)`,
        transformOrigin: "center",
        width: "100%",
        height: "100%",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const FocusZoom = ({ children, delay = 0 }: { children: ReactNode; delay?: number }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [delay, delay + 20], [0.96, 1], clamp);
  const opacity = interpolate(frame, [delay, delay + 14], [0, 1], clamp);
  return <div style={{ opacity, transform: `scale(${scale})` }}>{children}</div>;
};

export const CardStack = ({ children, index = 0 }: { children: ReactNode; index?: number }) => {
  const frame = useCurrentFrame();
  const progress = spring({
    frame: Math.max(0, frame - index * 5),
    fps: 30,
    config: { damping: 18, stiffness: 120, mass: 0.75 },
  });
  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 32}px) scale(${0.96 + progress * 0.04})`,
      }}
    >
      {children}
    </div>
  );
};

export const PathTrace = ({
  points,
  color = "#2563eb",
  strokeWidth = 5,
  delay = 0,
}: {
  points: Array<[number, number]>;
  color?: string;
  strokeWidth?: number;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const progress = easeProgress(frame, delay, delay + 32);
  if (points.length < 2) return null;
  const d = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} viewBox="0 0 100 100" preserveAspectRatio="none">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - progress}
      />
    </svg>
  );
};
