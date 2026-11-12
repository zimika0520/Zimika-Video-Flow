import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  buildProductionHandoffBrief,
  inspectProductionHandoff,
  type ProductionHandoffArtifact,
} from "@/lib/production-handoff";
import type { ProductionGateReport } from "@/lib/types";

const temporaryRoots: string[] = [];

const temporaryRunDir = (): string => {
  const root = mkdtempSync(
    path.join(os.tmpdir(), "zimika-production-handoff-"),
  );
  temporaryRoots.push(root);
  return path.join(root, "_runtime", "run-001");
};

afterAll(() => {
  temporaryRoots.forEach((root) => {
    rmSync(root, { recursive: true, force: true });
  });
});

const artifact = (
  key: ProductionHandoffArtifact["key"],
  overrides: Partial<ProductionHandoffArtifact> = {},
): ProductionHandoffArtifact => ({
  key,
  label: key,
  path: `/tmp/${key}`,
  required: true,
  exists: true,
  valid: true,
  ...overrides,
});

const gateReport = (passed: boolean): ProductionGateReport => ({
  passed,
  errors: passed ? [] : ["导演方案与当前场景不一致"],
  warnings: [],
  issues: passed
    ? []
    : [
        {
          code: "workflow.director-plan-stale",
          severity: "error",
          stage: "pre-render",
          message: "导演方案与当前场景不一致",
          suggestedAction: "rerender",
        },
      ],
  checkedAt: "2026-11-12T00:00:00.000Z",
});

describe("Zimika production handoff brief", () => {
  test("prioritizes missing artifacts before rendering", () => {
    const brief = buildProductionHandoffBrief({
      runDir: "/tmp/run",
      artifacts: [
        artifact("videoBrief"),
        artifact("scenes", { exists: false, valid: false }),
        artifact("audio"),
      ],
    });

    expect(brief.readiness.canRender).toBe(false);
    expect(brief.recommendedAction.kind).toBe("complete_artifact");
    expect(brief.recommendedAction.target).toBe("scenes");
    expect(brief.readiness.requiredArtifactCount).toBe(3);
    expect(brief.counts.missingArtifactCount).toBe(1);
  });

  test("prioritizes an unreadable artifact over other missing files", () => {
    const brief = buildProductionHandoffBrief({
      runDir: "/tmp/run",
      artifacts: [
        artifact("videoBrief"),
        artifact("scenes", {
          valid: false,
          error: "Unexpected token",
        }),
        artifact("audio", { exists: false, valid: false }),
      ],
    });

    expect(brief.recommendedAction.kind).toBe("repair_artifact");
    expect(brief.recommendedAction.target).toBe("scenes");
    expect(brief.counts.invalidArtifactCount).toBe(1);
  });

  test("routes every valid artifact through the production gate", () => {
    const blocked = buildProductionHandoffBrief({
      runDir: "/tmp/run",
      artifacts: [artifact("videoBrief"), artifact("scenes")],
      gateReport: gateReport(false),
    });
    expect(blocked.readiness.canRender).toBe(false);
    expect(blocked.recommendedAction.kind).toBe("resolve_gate_blocker");
    expect(blocked.recommendedAction.target).toBe(
      "workflow.director-plan-stale",
    );

    const ready = buildProductionHandoffBrief({
      runDir: "/tmp/run",
      artifacts: [artifact("videoBrief"), artifact("scenes")],
      gateReport: gateReport(true),
    });
    expect(ready.readiness.canRender).toBe(true);
    expect(ready.readiness.blocked).toBe(false);
    expect(ready.recommendedAction.kind).toBe("render_video");
  });

  test("inventories an incomplete run without throwing", async () => {
    const runDir = temporaryRunDir();
    const brief = await inspectProductionHandoff({ runDir });

    expect(brief.artifacts).toHaveLength(9);
    expect(brief.readiness.requiredArtifactCount).toBe(9);
    expect(brief.counts.missingArtifactCount).toBe(9);
    expect(brief.recommendedAction.kind).toBe("complete_artifact");
    expect(brief.recommendedAction.target).toBe("videoBrief");
  });

  test("reports malformed JSON as an artifact repair action", async () => {
    const runDir = temporaryRunDir();
    const { mkdirSync } = await import("node:fs");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(path.join(runDir, "video-brief.json"), "{}\n", "utf8");
    writeFileSync(path.join(runDir, "scenes.json"), "{broken\n", "utf8");

    const brief = await inspectProductionHandoff({ runDir });

    expect(brief.recommendedAction.kind).toBe("repair_artifact");
    expect(brief.recommendedAction.target).toBe("scenes");
    expect(
      brief.artifacts.find((item) => item.key === "scenes")?.valid,
    ).toBe(false);
  });
});
