import { interpolate, spring, useCurrentFrame } from "remotion";
import type { CandlePoint, ChartPoint, MetricItem, TimedVisualProps } from "./types";
import { resolveTheme, toneColor } from "./types";
import { NumberCount } from "./motion";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const MetricCounter = ({
  metric,
  theme,
  style,
}: TimedVisualProps & {
  metric: MetricItem;
}) => {
  const { palette, fontFamily, radius, shadow } = resolveTheme(theme);
  const numeric = Number.parseFloat(metric.value.replace(/[^\d.-]/g, ""));
  const suffix = metric.value.replace(/[\d.,\s-]/g, "");
  return (
    <div
      style={{
        background: palette.panel,
        border: `1px solid ${palette.line}`,
        borderRadius: radius,
        boxShadow: shadow,
        padding: "30px 34px",
        fontFamily,
        ...style,
      }}
    >
      <div style={{ color: palette.muted, fontSize: 24, fontWeight: 720 }}>{metric.label}</div>
      <div style={{ color: toneColor(palette, metric.tone), fontSize: 76, fontWeight: 940, letterSpacing: 0, marginTop: 10 }}>
        {Number.isFinite(numeric) ? <NumberCount value={numeric} suffix={suffix} /> : metric.value}
      </div>
      {metric.note ? <div style={{ color: palette.muted, fontSize: 23, marginTop: 8, lineHeight: 1.28 }}>{metric.note}</div> : null}
    </div>
  );
};

export const BarRaceChart = ({
  data,
  theme,
  style,
  maxValue,
}: TimedVisualProps & {
  data: ChartPoint[];
  maxValue?: number;
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily, radius } = resolveTheme(theme);
  const max = maxValue ?? Math.max(...data.map((item) => item.value), 1);
  return (
    <div style={{ display: "grid", gap: 18, fontFamily, ...style }}>
      {data.map((item, index) => {
        const progress = spring({
          frame: Math.max(0, frame - index * 5),
          fps: 30,
          config: { damping: 20, stiffness: 90 },
        });
        const width = Math.max(3, (item.value / max) * 100 * progress);
        return (
          <div key={item.label} style={{ display: "grid", gridTemplateColumns: "170px 1fr 110px", alignItems: "center", gap: 18 }}>
            <div style={{ color: palette.text, fontSize: 24, fontWeight: 780 }}>{item.label}</div>
            <div style={{ height: 34, borderRadius: 999, background: `${palette.line}88`, overflow: "hidden" }}>
              <div
                style={{
                  width: `${width}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${palette.primary}, ${palette.secondary})`,
                }}
              />
            </div>
            <div style={{ color: palette.text, fontSize: 26, fontWeight: 860, textAlign: "right" }}>{Math.round(item.value * progress)}</div>
          </div>
        );
      })}
    </div>
  );
};

export const LineTrendChart = ({
  data,
  theme,
  style,
}: TimedVisualProps & {
  data: ChartPoint[];
}) => {
  const frame = useCurrentFrame();
  const { palette } = resolveTheme(theme);
  const values = data.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const progress = interpolate(frame, [0, 42], [0, 1], clamp);
  const points = data.map((item, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * 100;
    const y = 88 - ((item.value - min) / range) * 76;
    return [x, y] as const;
  });
  const d = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", ...style }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
        {[20, 40, 60, 80].map((y) => (
          <line key={y} x1={0} x2={100} y1={y} y2={y} stroke={palette.line} strokeWidth={0.6} />
        ))}
        <path
          d={`${d} L 100 100 L 0 100 Z`}
          fill={`url(#lineFill-${palette.primary.replace("#", "")})`}
          opacity={0.22}
          pathLength={1}
          style={{ clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }}
        />
        <defs>
          <linearGradient id={`lineFill-${palette.primary.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={palette.primary} />
            <stop offset="100%" stopColor={palette.secondary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path
          d={d}
          fill="none"
          stroke={palette.primary}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - progress}
        />
      </svg>
    </div>
  );
};

export const KLineChart = ({
  candles,
  theme,
  style,
}: TimedVisualProps & {
  candles: CandlePoint[];
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily } = resolveTheme(theme);
  const all = candles.flatMap((item) => [item.open, item.high, item.low, item.close]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = Math.max(1, max - min);
  const y = (value: number) => 88 - ((value - min) / range) * 76;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily, ...style }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        {[18, 36, 54, 72, 90].map((lineY) => (
          <line key={lineY} x1={0} x2={100} y1={lineY} y2={lineY} stroke={palette.line} strokeWidth={0.45} />
        ))}
        {candles.map((item, index) => {
          const progress = interpolate(frame, [index * 2, index * 2 + 12], [0, 1], clamp);
          const x = 6 + (index / Math.max(candles.length - 1, 1)) * 88;
          const up = item.close >= item.open;
          const color = up ? palette.success : palette.danger;
          const top = Math.min(y(item.open), y(item.close));
          const height = Math.max(1.5, Math.abs(y(item.close) - y(item.open)));
          const width = Math.max(2.2, 54 / Math.max(candles.length, 8));
          return (
            <g key={`${item.label}-${index}`} opacity={progress}>
              <line x1={x} x2={x} y1={y(item.high)} y2={y(item.low)} stroke={color} strokeWidth={0.8} />
              <rect x={x - width / 2} y={top} width={width} height={height} rx={0.7} fill={color} />
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", right: 0, top: 0, color: palette.muted, fontSize: 18, fontWeight: 720 }}>
        {candles.at(-1)?.label}
      </div>
    </div>
  );
};

export const GaugeMeter = ({
  label,
  value,
  theme,
  style,
}: TimedVisualProps & {
  label: string;
  value: number;
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily } = resolveTheme(theme);
  const progress = interpolate(frame, [0, 30], [0, Math.max(0, Math.min(1, value))], clamp);
  const angle = -120 + progress * 240;
  return (
    <div style={{ position: "relative", width: 260, height: 190, fontFamily, ...style }}>
      <svg viewBox="0 0 100 72" style={{ width: "100%", height: "100%" }}>
        <path d="M 12 58 A 38 38 0 0 1 88 58" fill="none" stroke={palette.line} strokeWidth={9} strokeLinecap="round" />
        <path
          d="M 12 58 A 38 38 0 0 1 88 58"
          fill="none"
          stroke={progress > 0.72 ? palette.danger : progress > 0.48 ? palette.warning : palette.success}
          strokeWidth={9}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - progress}
        />
        <line x1={50} y1={58} x2={50} y2={26} stroke={palette.text} strokeWidth={2.5} strokeLinecap="round" transform={`rotate(${angle} 50 58)`} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", color: palette.text, fontSize: 24, fontWeight: 850 }}>
        {label}
      </div>
    </div>
  );
};
