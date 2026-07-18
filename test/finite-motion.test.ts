import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("finite motion system", () => {
  test("reusable backgrounds settle instead of looping forever", async () => {
    const source = await readFile(
      new URL("../remotion/visual-library/backgrounds.tsx", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(/frame\s*%/);
    expect(source).not.toContain("frame * 0.18");
    expect(source).toContain("settleProgress");
  });

  test("flow and chip traces complete once and hold", async () => {
    const [finance, tech] = await Promise.all([
      readFile(
        new URL("../remotion/visual-library/finance.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../remotion/visual-library/tech.tsx", import.meta.url),
        "utf8",
      ),
    ]);

    expect(finance).not.toMatch(/frame\s*%/);
    expect(tech).not.toMatch(/frame\s*%/);
  });
});
