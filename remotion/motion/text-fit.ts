export const fitChineseText = (text: string, baseSize: number, maxChars: number, minSize = 34) => {
  const compact = text.replace(/\s+/g, "");
  if (compact.length <= maxChars) return baseSize;
  const ratio = maxChars / compact.length;
  return Math.max(minSize, Math.floor(baseSize * (0.72 + ratio * 0.28)));
};

export const clampText = (text: string, maxLength: number) => {
  const clean = text.replace(/\s+/g, "");
  return clean.length > maxLength ? clean.slice(0, maxLength) : clean;
};
