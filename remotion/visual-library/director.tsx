import { interpolate, spring, useCurrentFrame } from "remotion";
import { BarRaceChart, GaugeMeter, MetricCounter } from "./data";
import type { ChartPoint, MetricItem, TimedVisualProps } from "./types";
import { resolveTheme, toneColor } from "./types";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const fitLabel = (value: string, max = 12) => {
  const chars = Array.from(value);
  return chars.length > max ? `${chars.slice(0, max).join("")}...` : value;
};

export const ChipHeroFrame = ({
  title,
  kicker,
  nodes,
  theme,
  style,
}: TimedVisualProps & {
  title: string;
  kicker?: string;
  nodes: string[];
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily, radius, shadow } = resolveTheme(theme);
  const draw = interpolate(frame, [8, 52], [0, 1], clamp);
  const pulse = spring({ frame: Math.max(0, frame - 16), fps: 30, config: { damping: 18, stiffness: 90 } });
  const orbit = nodes.slice(0, 5);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily, ...style }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="chipHeroTrace" x1="0" x2="1">
            <stop offset="0%" stopColor={palette.primary} />
            <stop offset="100%" stopColor={palette.secondary} />
          </linearGradient>
        </defs>
        {[18, 28, 38, 62, 72, 82].map((x, index) => (
          <path
            key={x}
            d={`M ${x} 10 L ${x} 30 C ${x} 42, 50 42, 50 50 C 50 58, ${x} 58, ${x} 70 L ${x} 90`}
            fill="none"
            stroke="url(#chipHeroTrace)"
            strokeWidth={0.42}
            opacity={0.18 + draw * 0.34}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={Math.max(0, 1 - draw + index * 0.035)}
          />
        ))}
        {[22, 36, 50, 64, 78].map((y, index) => (
          <path
            key={y}
            d={`M 10 ${y} L 34 ${y} C 43 ${y}, 43 50, 50 50 C 57 50, 57 ${y}, 66 ${y} L 90 ${y}`}
            fill="none"
            stroke={index % 2 ? palette.accent : palette.primary}
            strokeWidth={0.38}
            opacity={0.16 + draw * 0.28}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={Math.max(0, 1 - draw + index * 0.04)}
          />
        ))}
      </svg>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 540,
          height: 360,
          transform: `translate(-50%, -50%) scale(${0.96 + pulse * 0.04})`,
          borderRadius: radius * 0.72,
          background: `linear-gradient(145deg, ${palette.panel}, ${palette.bg})`,
          border: `1px solid ${palette.primary}55`,
          boxShadow: shadow,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 26, border: `1px dashed ${palette.primary}50`, borderRadius: radius * 0.45 }} />
        <div style={{ position: "absolute", inset: "72px 54px", display: "grid", placeItems: "center", textAlign: "center" }}>
          {kicker ? <div style={{ color: palette.primary, fontSize: 28, fontWeight: 850, marginBottom: 20 }}>{kicker}</div> : null}
          <div style={{ color: palette.text, fontSize: 62, fontWeight: 960, lineHeight: 1.02 }}>{title}</div>
        </div>
      </div>

      {orbit.map((node, index) => {
        const angle = -Math.PI / 2 + (index / Math.max(orbit.length, 1)) * Math.PI * 2;
        const progress = interpolate(frame, [18 + index * 5, 40 + index * 5], [0, 1], clamp);
        const x = 50 + Math.cos(angle) * 36;
        const y = 50 + Math.sin(angle) * 31;
        return (
          <div
            key={node}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%) scale(${0.88 + progress * 0.12})`,
              opacity: progress,
              padding: "13px 18px",
              borderRadius: 999,
              background: `${palette.panel}e8`,
              border: `1px solid ${palette.secondary}55`,
              boxShadow: "0 16px 44px rgba(15, 23, 42, 0.11)",
              color: palette.text,
              fontSize: 24,
              fontWeight: 860,
              whiteSpace: "nowrap",
            }}
          >
            {fitLabel(node, 10)}
          </div>
        );
      })}
    </div>
  );
};

export const TrainingInferenceSplit = ({
  headline,
  left,
  right,
  flow,
  theme,
  style,
}: TimedVisualProps & {
  headline?: string;
  left: { label: string; value: string; note?: string };
  right: { label: string; value: string; note?: string };
  flow: string[];
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily, radius } = resolveTheme(theme);
  const reveal = interpolate(frame, [0, 28], [0, 1], clamp);
  const divider = interpolate(frame, [10, 40], [0, 1], clamp);

  const panel = (item: typeof left, side: "left" | "right") => {
    const accent = side === "left" ? palette.warning : palette.primary;
    const x = side === "left" ? interpolate(frame, [0, 28], [-44, 0], clamp) : interpolate(frame, [0, 28], [44, 0], clamp);
    return (
      <div
        style={{
          position: "relative",
          height: "100%",
          borderRadius: radius * 0.7,
          background: `linear-gradient(145deg, ${palette.panel}, ${accent}10)`,
          border: `1px solid ${accent}55`,
          padding: 38,
          opacity: reveal,
          transform: `translateX(${x}px)`,
          overflow: "hidden",
        }}
      >
        <div style={{ color: accent, fontSize: 30, fontWeight: 900 }}>{item.label}</div>
        <div style={{ color: palette.text, fontSize: 66, fontWeight: 960, lineHeight: 1.02, marginTop: 28 }}>{item.value}</div>
        {item.note ? <div style={{ color: palette.muted, fontSize: 24, lineHeight: 1.28, marginTop: 26 }}>{item.note}</div> : null}
        <div style={{ position: "absolute", left: 34, right: 34, bottom: 32, height: 3, borderRadius: 99, background: `linear-gradient(90deg, ${accent}, transparent)`, transform: `scaleX(${divider})`, transformOrigin: "left" }} />
      </div>
    );
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily, ...style }}>
      {headline ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, color: palette.text, fontSize: 40, fontWeight: 930, textAlign: "center" }}>{headline}</div>
      ) : null}
      <div style={{ position: "absolute", left: 0, right: 0, top: headline ? 82 : 8, bottom: 116, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 42 }}>
        {panel(left, "left")}
        {panel(right, "right")}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "grid", gridTemplateColumns: `repeat(${flow.length}, 1fr)`, gap: 18 }}>
        {flow.slice(0, 5).map((item, index) => {
          const progress = interpolate(frame, [24 + index * 4, 44 + index * 4], [0, 1], clamp);
          return (
            <div key={item} style={{ color: palette.text, background: `${palette.primary}12`, border: `1px solid ${palette.primary}35`, borderRadius: 18, padding: "15px 12px", textAlign: "center", fontSize: 21, fontWeight: 800, opacity: progress }}>
              {fitLabel(item, 8)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CostMeterFrame = ({
  metrics,
  chartPoints,
  gaugeValue,
  theme,
  style,
}: TimedVisualProps & {
  metrics: MetricItem[];
  chartPoints: ChartPoint[];
  gaugeValue?: number;
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily, radius } = resolveTheme(theme);
  const metric = metrics[0] ?? { label: "核心指标", value: "持续增加" };
  const scan = interpolate(frame, [18, 66], [0, 1], clamp);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily, ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 430 }}>
        <MetricCounter metric={metric} theme={theme} />
      </div>
      {gaugeValue === undefined ? null : (
        <div style={{ position: "absolute", left: 474, top: 10, width: 330, height: 250 }}>
          <GaugeMeter label="事实比例" value={gaugeValue} theme={theme} style={{ width: 320, height: 238 }} />
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 308, borderRadius: radius * 0.65, background: palette.panel, border: `1px solid ${palette.line}`, padding: 30 }}>
        <BarRaceChart data={chartPoints} theme={theme} />
      </div>
      <div
        style={{
          position: "absolute",
          left: `${8 + scan * 76}%`,
          top: 0,
          bottom: 0,
          width: 2,
          background: `linear-gradient(180deg, transparent, ${palette.secondary}, transparent)`,
          opacity: 0.72,
        }}
      />
    </div>
  );
};

export const TechQuadrantWall = ({
  title,
  items,
  theme,
  style,
}: TimedVisualProps & {
  title: string;
  items: MetricItem[];
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily, radius } = resolveTheme(theme);
  const safeItems = (items.length ? items : [{ label: "制造", value: "制程" }, { label: "存储", value: "HBM" }, { label: "生态", value: "软件栈" }, { label: "落地", value: "量产" }]).slice(0, 4);
  const layouts = [
    { left: 0, top: 0, width: "47%", height: "43%", tone: "primary" },
    { right: 0, top: 32, width: "44%", height: "36%", tone: "warning" },
    { left: 54, bottom: 0, width: "39%", height: "38%", tone: "secondary" },
    { right: 0, bottom: 0, width: "49%", height: "44%", tone: "success" },
  ] as const;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily, ...style }}>
      <div
        style={{
          position: "absolute",
          left: "48.5%",
          top: "48%",
          width: 92,
          height: 92,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `${palette.panel}f2`,
          border: `2px solid ${palette.primary}66`,
          boxShadow: `0 14px 34px rgba(15, 23, 42, 0.07), 0 0 0 8px ${palette.primary}0d`,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          color: palette.text,
          fontSize: 22,
          fontWeight: 940,
          lineHeight: 1.06,
          zIndex: 1,
        }}
        aria-label={title}
      >
        {fitLabel(title, 4)}
      </div>
      {safeItems.map((item, index) => {
        const progress = interpolate(frame, [index * 7, index * 7 + 24], [0, 1], clamp);
        const layout = layouts[index];
        const color = toneColor(palette, layout.tone);
        return (
          <div
            key={`${item.label}-${index}`}
            style={{
              position: "absolute",
              ...layout,
              zIndex: 2,
              opacity: progress,
              transform: `translateY(${(1 - progress) * 24}px)`,
              borderRadius: index === 1 ? 999 : radius * (index === 2 ? 0.35 : 0.62),
              background: `linear-gradient(145deg, ${palette.panel}, ${color}12)`,
              border: `1px solid ${color}55`,
              padding: index === 1 ? "34px 48px" : 34,
              overflow: "hidden",
            }}
          >
            <div style={{ color, fontSize: 26, fontWeight: 920 }}>{item.label}</div>
            <div style={{ color: palette.text, fontSize: 48, fontWeight: 960, lineHeight: 1.02, marginTop: 14 }}>{fitLabel(item.value, 8)}</div>
            {item.note ? <div style={{ color: palette.muted, fontSize: 20, lineHeight: 1.26, marginTop: 16, maxWidth: 320 }}>{item.note}</div> : null}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18 }}>
              <path d={index % 2 ? "M 0 82 C 36 54, 62 46, 100 12" : "M 0 22 C 30 48, 66 50, 100 78"} fill="none" stroke={color} strokeWidth={1.2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
            </svg>
          </div>
        );
      })}
    </div>
  );
};

export const CompetitionRings = ({
  center,
  items,
  theme,
  style,
}: TimedVisualProps & {
  center: string;
  items: Array<{ label: string; role?: string }>;
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily } = resolveTheme(theme);
  const ringItems = items.slice(0, 6);
  const ringProgress = interpolate(frame, [0, 44], [0, 1], clamp);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily, ...style }}>
      <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {[18, 30, 42].map((r, index) => (
          <circle key={r} cx={50} cy={50} r={r} fill="none" stroke={index === 0 ? palette.primary : index === 1 ? palette.secondary : palette.accent} strokeWidth={0.85} opacity={0.26} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ringProgress} />
        ))}
      </svg>
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 230, height: 230, borderRadius: "50%", background: `linear-gradient(145deg, ${palette.primary}, ${palette.secondary})`, color: "#fff", display: "grid", placeItems: "center", textAlign: "center", fontSize: 32, lineHeight: 1.08, fontWeight: 950, boxShadow: "0 24px 70px rgba(37, 99, 235, 0.22)" }}>
        {fitLabel(center, 8)}
      </div>
      {ringItems.map((item, index) => {
        const progress = interpolate(frame, [14 + index * 5, 36 + index * 5], [0, 1], clamp);
        const radius = index < 2 ? 24 : index < 4 ? 36 : 43;
        const angle = -Math.PI / 2 + (index / Math.max(ringItems.length, 1)) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * radius;
        const y = 50 + Math.sin(angle) * radius * 0.78;
        const color = [palette.primary, palette.secondary, palette.accent, palette.warning, palette.success, palette.danger][index % 6];
        return (
          <div
            key={`${item.label}-${index}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 190,
              minHeight: 88,
              transform: `translate(-50%, -50%) scale(${0.86 + progress * 0.14})`,
              opacity: progress,
              borderRadius: 24,
              background: `${palette.panel}f2`,
              border: `1px solid ${color}55`,
              padding: "16px 18px",
              textAlign: "center",
              boxShadow: "0 16px 48px rgba(15, 23, 42, 0.1)",
            }}
          >
            <div style={{ color, fontSize: 24, fontWeight: 920, lineHeight: 1.08 }}>{fitLabel(item.label, 7)}</div>
            {item.role ? <div style={{ color: palette.muted, fontSize: 15, fontWeight: 720, marginTop: 7 }}>{fitLabel(item.role, 8)}</div> : null}
          </div>
        );
      })}
    </div>
  );
};
