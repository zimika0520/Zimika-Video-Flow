import { existsSync, mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { cleanupRenderArtifacts } from "@/lib/output-cleanup";

describe("output cleanup", () => {
  test("removes transient QA artifacts after a successful delivery and keeps project assets", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-output-cleanup-"));
    const runDir = join(root, "run");
    const materialPackPath = join(root, "material-pack");
    const publicRuntimeDir = join(root, "public-runtime");

    await Promise.all([
      mkdir(join(runDir, "自检帧"), { recursive: true }),
      mkdir(join(runDir, "quality-frames"), { recursive: true }),
      mkdir(join(materialPackPath, "自检帧"), { recursive: true }),
      mkdir(publicRuntimeDir, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(runDir, "quality-report.json"), "{}\n"),
      writeFile(join(runDir, "production-gate-report.json"), "{}\n"),
      writeFile(join(runDir, "director-plan.json"), "{}\n"),
      writeFile(join(runDir, "口播文案.md"), "口播文案\n"),
      writeFile(join(runDir, "口播音频.mp3"), "audio"),
      writeFile(join(publicRuntimeDir, "runtime-file"), "temporary"),
    ]);

    await cleanupRenderArtifacts({
      materialPackPath,
      runDir,
      publicRuntimeDir,
    });

    expect(existsSync(join(runDir, "自检帧"))).toBe(false);
    expect(existsSync(join(runDir, "quality-frames"))).toBe(false);
    expect(existsSync(join(materialPackPath, "自检帧"))).toBe(false);
    expect(existsSync(join(runDir, "quality-report.json"))).toBe(false);
    expect(existsSync(join(runDir, "production-gate-report.json"))).toBe(false);
    expect(existsSync(publicRuntimeDir)).toBe(false);
    expect(existsSync(join(runDir, "director-plan.json"))).toBe(true);
    expect(existsSync(join(runDir, "口播文案.md"))).toBe(true);
    expect(existsSync(join(runDir, "口播音频.mp3"))).toBe(true);
  });
});
