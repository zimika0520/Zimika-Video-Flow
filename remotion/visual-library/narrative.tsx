import { interpolate, useCurrentFrame } from "remotion";
import type { MetricItem, TimedVisualProps, TimelineItem } from "./types";
import { resolveTheme } from "./types";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const TimelineRail = ({
  items,
  theme,
  style,
}: TimedVisualProps & {
  items: TimelineItem[];
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily } = resolveTheme(theme);
  return (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 22, fontFamily, ...style }}>
      <div style={{ position: "absolute", left: "4%", right: "4%", top: 36, height: 4, borderRadius: 999, background: palette.line }} />
      {items.map((item, index) => {
        const progress = interpolate(frame, [index * 8, index * 8 + 18], [0, 1], clamp);
        return (
          <div key={`${item.time}-${item.title}`} style={{ position: "relative", paddingTop: 76, opacity: progress, transform: `translateY(${(1 - progress) * 20}px)` }}>
            <div style={{ position: "absolute", top: 21, left: "50%", width: 34, height: 34, borderRadius: "50%", transform: "translateX(-50%)", background: palette.primary, boxShadow: `0 0 0 10px ${palette.primary}18` }} />
            <div style={{ color: palette.primary, fontSize: 24, fontWeight: 920, marginBottom: 10 }}>{item.time}</div>
            <div style={{ color: palette.text, fontSize: 28, fontWeight: 900, lineHeight: 1.12 }}>{item.title}</div>
            {item.note ? <div style={{ color: palette.muted, fontSize: 18, lineHeight: 1.3, marginTop: 10 }}>{item.note}</div> : null}
          </div>
        );
      })}
    </div>
  );
};

export const EventCard = ({
  title,
  note,
  theme,
  style,
}: TimedVisualProps & {
  title: string;
  note?: string;
}) => {
  const { palette, fontFamily, radius, shadow } = resolveTheme(theme);
  return (
    <div style={{ background: palette.panel, border: `1px solid ${palette.line}`, borderRadius: radius, boxShadow: shadow, padding: 34, fontFamily, ...style }}>
      <div style={{ color: palette.text, fontSize: 42, fontWeight: 940, lineHeight: 1.08 }}>{title}</div>
      {note ? <div style={{ color: palette.muted, fontSize: 24, lineHeight: 1.32, marginTop: 18 }}>{note}</div> : null}
    </div>
  );
};

export const EvidenceWall = ({
  items,
  theme,
  style,
}: TimedVisualProps & {
  items: MetricItem[];
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily, radius } = resolveTheme(theme);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, fontFamily, ...style }}>
      {items.map((item, index) => {
        const progress = interpolate(frame, [index * 5, index * 5 + 18], [0, 1], clamp);
        return (
          <div key={`${item.label}-${index}`} style={{ borderRadius: radius * 0.55, background: palette.panel, border: `1px solid ${palette.line}`, padding: 24, opacity: progress, minHeight: 156 }}>
            <div style={{ color: palette.muted, fontSize: 18, fontWeight: 760 }}>{item.label}</div>
            <div style={{ color: palette.text, fontSize: 34, fontWeight: 940, marginTop: 10 }}>{item.value}</div>
            {item.note ? <div style={{ color: palette.muted, fontSize: 18, lineHeight: 1.28, marginTop: 10 }}>{item.note}</div> : null}
          </div>
        );
      })}
    </div>
  );
};

export const QuoteFocus = ({
  quote,
  source,
  theme,
  style,
}: TimedVisualProps & {
  quote: string;
  source?: string;
}) => {
  const { palette, fontFamily } = resolveTheme(theme);
  return (
    <div style={{ fontFamily, textAlign: "center", color: palette.text, ...style }}>
      <div style={{ fontSize: 70, fontWeight: 950, lineHeight: 1.12 }}>{quote}</div>
      {source ? <div style={{ color: palette.muted, fontSize: 24, marginTop: 22 }}>{source}</div> : null}
    </div>
  );
};

export const ChapterBreak = ({
  eyebrow,
  title,
  theme,
  style,
}: TimedVisualProps & {
  eyebrow?: string;
  title: string;
}) => {
  const { palette, fontFamily } = resolveTheme(theme);
  return (
    <div style={{ fontFamily, display: "grid", placeItems: "center", width: "100%", height: "100%", textAlign: "center", ...style }}>
      {eyebrow ? <div style={{ color: palette.primary, fontSize: 28, fontWeight: 880, marginBottom: 18 }}>{eyebrow}</div> : null}
      <div style={{ color: palette.text, fontSize: 82, fontWeight: 960, lineHeight: 1.02 }}>{title}</div>
    </div>
  );
};
