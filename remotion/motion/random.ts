export const seeded = (seed: string | number) => {
  const text = String(seed);
  let value = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }

  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seededRange = (seed: string | number, min: number, max: number) => {
  const next = seeded(seed);
  return min + next() * (max - min);
};
