import type { CSSProperties, ReactNode } from "react";

export type VisualPalette = {
  bg: string;
  panel: string;
  text: string;
  muted: string;
  line: string;
  primary: string;
  secondary: string;
  accent: string;
  danger: string;
  warning: string;
  success: string;
};

export const defaultPalette: VisualPalette = {
  bg: "#f7f9fc",
  panel: "#ffffff",
  text: "#101828",
  muted: "#667085",
  line: "#d9e2ef",
  primary: "#2563eb",
  secondary: "#06b6d4",
  accent: "#7c3aed",
  danger: "#ef4444",
  warning: "#f59e0b",
  success: "#10b981",
};

export type VisualTheme = {
  palette?: Partial<VisualPalette>;
  fontFamily?: string;
  radius?: number;
  shadow?: string;
};

export const resolvePalette = (theme?: VisualTheme): VisualPalette => ({
  ...defaultPalette,
  ...(theme?.palette ?? {}),
});

export const resolveTheme = (theme?: VisualTheme) => {
  const palette = resolvePalette(theme);
  return {
    palette,
    fontFamily: theme?.fontFamily ?? "Inter, Arial, sans-serif",
    radius: theme?.radius ?? 28,
    shadow: theme?.shadow ?? "0 24px 80px rgba(15, 23, 42, 0.12)",
  };
};

export type TimedVisualProps = {
  startFrame?: number;
  durationFrames?: number;
  theme?: VisualTheme;
  style?: CSSProperties;
};

export type MetricItem = {
  label: string;
  value: string;
  note?: string;
  tone?: "neutral" | "up" | "down" | "warning";
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type CandlePoint = {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type TimelineItem = {
  time: string;
  title: string;
  note?: string;
};

export type GraphNodeItem = {
  id: string;
  label: string;
  role?: string;
  x?: number;
  y?: number;
  tone?: "primary" | "secondary" | "accent" | "danger" | "warning" | "success";
};

export type GraphEdgeItem = {
  from: string;
  to: string;
  label?: string;
};

export type CollisionBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority?: number;
};

export type SafeLayoutWarning = {
  a: string;
  b: string;
  overlapArea: number;
};

export type Slot = {
  id: string;
  children: ReactNode;
  box: CollisionBox;
};

export const toneColor = (palette: VisualPalette, tone?: string) => {
  if (tone === "up" || tone === "success") return palette.success;
  if (tone === "down" || tone === "danger") return palette.danger;
  if (tone === "warning") return palette.warning;
  if (tone === "secondary") return palette.secondary;
  if (tone === "accent") return palette.accent;
  return palette.primary;
};
