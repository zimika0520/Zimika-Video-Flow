import type { CSSProperties, ReactNode } from "react";
import type { CollisionBox, SafeLayoutWarning, Slot, VisualTheme } from "./types";
import { resolveTheme } from "./types";

export const findLayoutCollisions = (boxes: CollisionBox[]): SafeLayoutWarning[] => {
  const warnings: SafeLayoutWarning[] = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      const overlapArea = x * y;
      if (overlapArea > 0) warnings.push({ a: a.id, b: b.id, overlapArea });
    }
  }
  return warnings;
};

export const SafeArea = ({
  children,
  top = 70,
  right = 86,
  bottom = 150,
  left = 86,
  style,
}: {
  children: ReactNode;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  style?: CSSProperties;
}) => (
  <div style={{ position: "absolute", inset: `${top}px ${right}px ${bottom}px ${left}px`, ...style }}>{children}</div>
);

export const CollisionGuard = ({
  slots,
  debug = false,
  theme,
}: {
  slots: Slot[];
  debug?: boolean;
  theme?: VisualTheme;
}) => {
  const { palette } = resolveTheme(theme);
  const warnings = findLayoutCollisions(slots.map((slot) => slot.box));
  return (
    <>
      {slots.map((slot) => (
        <div
          key={slot.id}
          style={{
            position: "absolute",
            left: slot.box.x,
            top: slot.box.y,
            width: slot.box.width,
            height: slot.box.height,
            outline: debug ? `2px solid ${warnings.some((item) => item.a === slot.id || item.b === slot.id) ? palette.danger : palette.success}` : undefined,
          }}
        >
          {slot.children}
        </div>
      ))}
    </>
  );
};

export const TextFitBox = ({
  text,
  maxChars = 18,
  minSize = 24,
  maxSize = 64,
  style,
}: {
  text: string;
  maxChars?: number;
  minSize?: number;
  maxSize?: number;
  style?: CSSProperties;
}) => {
  const clean = text.trim();
  const fontSize = Math.max(minSize, Math.min(maxSize, Math.floor((maxChars / Math.max(clean.length, 1)) * maxSize)));
  return (
    <div
      style={{
        fontSize,
        lineHeight: 1.08,
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        ...style,
      }}
    >
      {clean}
    </div>
  );
};
