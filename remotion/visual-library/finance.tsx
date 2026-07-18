import { interpolate, useCurrentFrame } from "remotion";
import type { ChartPoint, TimedVisualProps } from "./types";
import { resolveTheme } from "./types";
import { GaugeMeter, KLineChart } from "./data";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const MarketHeatmap = ({
  items,
  theme,
  style,
}: TimedVisualProps & {
  items: Array<ChartPoint & { group?: string }>;
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily, radius } = resolveTheme(theme);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
        fontFamily,
        ...style,
      }}
    >
      {items.map((item, index) => {
        const progress = interpolate(frame, [index * 3, index * 3 + 16], [0, 1], clamp);
        const up = item.value >= 0;
        const intensity = Math.min(0.95, Math.abs(item.value) / 8 + 0.18);
        return (
          <div
            key={item.label}
            style={{
              minHeight: index % 5 === 0 ? 132 : 100,
              borderRadius: radius * 0.55,
              padding: 18,
              color: "#fff",
              background: up ? `rgba(16, 185, 129, ${intensity})` : `rgba(239, 68, 68, ${intensity})`,
              transform: `scale(${0.92 + progress * 0.08})`,
              opacity: progress,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 880 }}>{item.label}</div>
            <div style={{ fontSize: 30, fontWeight: 940 }}>{item.value > 0 ? "+" : ""}{item.value.toFixed(1)}%</div>
            {item.group ? <div style={{ fontSize: 15, opacity: 0.8 }}>{item.group}</div> : null}
          </div>
        );
      })}
    </div>
  );
};

export const RiskMeter = ({
  value,
  label = "风险温度",
  theme,
  style,
}: TimedVisualProps & {
  value: number;
  label?: string;
}) => <GaugeMeter label={label} value={value} theme={theme} style={style} />;

export const VolatilityBand = ({
  values,
  theme,
  style,
}: TimedVisualProps & {
  values: ChartPoint[];
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily } = resolveTheme(theme);
  const max = Math.max(...values.map((item) => item.value), 1);
  return (
    <div style={{ position: "relative", height: "100%", fontFamily, ...style }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "end", gap: 6 }}>
        {values.map((item, index) => {
          const progress = interpolate(frame, [index * 2, index * 2 + 14], [0, 1], clamp);
          const h = (item.value / max) * 100 * progress;
          return (
            <div key={item.label} style={{ flex: 1, height: `${Math.max(4, h)}%`, borderRadius: "12px 12px 0 0", background: h > 70 ? palette.danger : h > 45 ? palette.warning : palette.primary }} />
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, color: palette.text, fontSize: 28, fontWeight: 900 }}>波动带</div>
    </div>
  );
};

export const PositionFlow = ({
  from,
  to,
  theme,
  style,
}: TimedVisualProps & {
  from: string;
  to: string;
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily, radius, shadow } = resolveTheme(theme);
  const progress = interpolate(frame, [0, 42], [0, 1], clamp);
  return (
    <div style={{ position: "relative", height: 230, fontFamily, ...style }}>
      {[from, to].map((label, index) => (
        <div
          key={label}
          style={{
            position: "absolute",
            left: index === 0 ? 0 : "62%",
            top: 44,
            width: "38%",
            height: 130,
            borderRadius: radius,
            background: palette.panel,
            border: `1px solid ${palette.line}`,
            boxShadow: shadow,
            display: "grid",
            placeItems: "center",
            color: palette.text,
            fontSize: 34,
            fontWeight: 920,
          }}
        >
          {label}
        </div>
      ))}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <path d="M 38 50 C 48 18, 54 82, 62 50" fill="none" stroke={palette.primary} strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray="0.1 0.08" strokeDashoffset={-progress} />
      </svg>
    </div>
  );
};

export const CandlestickPanel = KLineChart;
