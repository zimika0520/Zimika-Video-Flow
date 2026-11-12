import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type Check = {
  name: string;
  run: () => void;
};

const root = process.cwd();
const pluginRoot = "plugins/shin-video";
const publicSkillPath = `${pluginRoot}/skills/shin-video/SKILL.md`;

const requiredRemotionPackages = {
  remotion: "4.0.484",
  "@remotion/cli": "4.0.484",
  "@remotion/bundler": "4.0.484",
  "@remotion/renderer": "4.0.484",
  zod: "4.3.6",
};

const requiredVisualLibraryFiles = [
  "backgrounds.tsx",
  "captions.tsx",
  "data.tsx",
  "director.tsx",
  "finance.tsx",
  "index.ts",
  "motion.tsx",
  "narrative.tsx",
  "relation.tsx",
  "safety.tsx",
  "tech.tsx",
  "types.ts",
];

const requiredTtsFiles = [
  "lib/tts-provider.ts",
  "lib/tts-dispatcher.ts",
  "lib/minimax-tts.ts",
  "lib/volcengine-tts.ts",
  "lib/custom-tts.ts",
];

const file = (relativePath: string) => path.join(root, relativePath);
const read = (relativePath: string) => readFileSync(file(relativePath), "utf8");

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertFile = (relativePath: string): void => {
  assert(existsSync(file(relativePath)), `${relativePath} is missing`);
};

const assertContains = (relativePath: string, pattern: RegExp, message: string): void => {
  assert(pattern.test(read(relativePath)), `${relativePath}: ${message}`);
};

const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
};

const readJson = <T>(relativePath: string): T => JSON.parse(read(relativePath)) as T;

const checks: Check[] = [
  {
    name: "installation and release commands are available",
    run: () => {
      assert(packageJson.scripts?.doctor === "tsx scripts/doctor.ts", "package.json must expose npm run doctor");
      assert(packageJson.scripts?.build, "package.json must expose npm run build");
      assert(
        packageJson.scripts?.["handoff-brief"] === "tsx scripts/production-handoff.ts",
        "package.json must expose npm run handoff-brief",
      );
      assert(packageJson.scripts?.["verify-workflow"], "package.json must expose npm run verify-workflow");
    },
  },
  {
    name: "Remotion renderer dependencies are pinned",
    run: () => {
      for (const [name, version] of Object.entries(requiredRemotionPackages)) {
        assert(packageJson.dependencies?.[name] === version, `${name} must be exactly ${version}`);
      }
    },
  },
  {
    name: "TTS providers return the native timeline required by the workflow",
    run: () => {
      requiredTtsFiles.forEach(assertFile);
      assertContains(
        "lib/tts-provider.ts",
        /source:\s*"provider-native"/,
        "TTS timeline must identify provider-native timestamps",
      );
      assertContains(
        "app/api/generate-voiceover-audio/route.ts",
        /subtitleTimelinePath/,
        "voiceover generation must return subtitle-timeline.json",
      );

      const envExample = read(".env.local.example");
      [
        "SHIN_VIDEO_TTS_PROVIDER",
        "MINIMAX_API_KEY",
        "VOLCENGINE_TTS_API_KEY",
        "CUSTOM_TTS_ENDPOINT",
      ].forEach((name) => {
        assert(envExample.includes(name), `.env.local.example missing ${name}`);
      });
    },
  },
  {
    name: "final render pipeline is wired to the production gate",
    run: () => {
      ["remotion/index.ts", "remotion/Root.tsx", "remotion/Video.tsx"].forEach(assertFile);
      ["lib/remotion-render.ts", "lib/production-gate.ts", "app/api/export-video/route.ts"].forEach(assertFile);
      [
        "lib/production-handoff.ts",
        "scripts/production-handoff.ts",
        "test/production-handoff.test.ts",
      ].forEach(assertFile);
      assertContains(
        "lib/remotion-render.ts",
        /validateProductionGateFiles/,
        "renderer must validate the production gate before rendering",
      );
      assertContains(
        "lib/production-handoff.ts",
        /inspectProductionHandoff/,
        "production handoff must inventory all render inputs",
      );
      assertContains(
        "lib/production-handoff.ts",
        /buildProductionHandoffBrief/,
        "production handoff must produce a deterministic next-action brief",
      );
      assertContains(
        "lib/remotion-render.ts",
        /renderMedia/,
        "renderer must invoke Remotion renderMedia for the final video",
      );
      assertContains(
        "app/api/export-video/route.ts",
        /directorPlanPath/,
        "final export route must receive director-plan.json",
      );
      assertContains(
        "app/api/export-video/route.ts",
        /styleProfilePath/,
        "final export route must receive style-profile.json",
      );
    },
  },
  {
    name: "minimal production gate rejects stale plans and invalid timing",
    run: () => {
      [
        "lib/director-plan.ts",
        "lib/scene-generator.ts",
        "lib/production-gate.ts",
      ].forEach(assertFile);
      assertContains(
        "lib/director-plan.ts",
        /createSourceScenesFingerprint/,
        "director plan must fingerprint source scenes",
      );
      assertContains(
        "lib/production-gate.ts",
        /assertDirectorPlanMatchesScenes/,
        "production gate must reject director plans for stale scenes",
      );
      assertContains(
        "lib/production-gate.ts",
        /validateSubtitleTimelineFiles/,
        "production gate must validate final audio and voiceover fingerprints",
      );
    },
  },
  {
    name: "visual component library is present and used by the composition",
    run: () => {
      requiredVisualLibraryFiles.forEach((name) => assertFile(`remotion/visual-library/${name}`));
      assertContains(
        "remotion/visual-library/index.ts",
        /export \* from "\.\/director";[\s\S]*export \* from "\.\/finance";[\s\S]*export \* from "\.\/tech";/,
        "visual library must export director, finance and technology components",
      );
      assertContains(
        "remotion/Video.tsx",
        /VisualLibraryScene/,
        "video composition must route scenes through the visual library",
      );
    },
  },
  {
    name: "plugin exposes one public Zimika Video Flow entry",
    run: () => {
      assertFile(publicSkillPath);
      assert(!existsSync(file(`${pluginRoot}/skills/shin-video-director/SKILL.md`)), "legacy public director skill must not remain");
      assert(!existsSync(file(`${pluginRoot}/skills/shin-video-lite/SKILL.md`)), "legacy public lite skill must not remain");

      const workflowManifest = readJson<{
        name?: string;
        version?: string;
        entrySkill?: { name?: string; path?: string };
        skillCounts?: { total?: number };
      }>(`${pluginRoot}/workflow-manifest.json`);
      const codexManifest = readJson<{ name?: string; version?: string }>(`${pluginRoot}/.codex-plugin/plugin.json`);
      const releaseManifest = readJson<{ name?: string; version?: string }>(`${pluginRoot}/plugin-manifest/plugin.json`);

      assert(workflowManifest.name === "shin-video", "workflow manifest name must be shin-video");
      assert(workflowManifest.entrySkill?.name === "shin-video", "workflow manifest must expose shin-video");
      assert(workflowManifest.entrySkill?.path === "skills/shin-video/SKILL.md", "workflow manifest entry path must target the public skill");
      assert(workflowManifest.skillCounts?.total === 1, "workflow manifest must declare one public skill");
      [workflowManifest.version, codexManifest.version, releaseManifest.version].forEach((version) => {
        assert(version === "0.3.0-zimika.1", "all plugin manifests must use version 0.3.0-zimika.1");
      });
      assert(codexManifest.name === "shin-video" && releaseManifest.name === "shin-video", "plugin manifest names must match");
    },
  },
  {
    name: "plugin documentation routes users to the single entry and health checks",
    run: () => {
      [
        `${pluginRoot}/README.md`,
        `${pluginRoot}/AGENTS.md`,
        `${pluginRoot}/references/规范/getting-started.md`,
        `${pluginRoot}/references/审核规则/agent-guide.md`,
      ].forEach(assertFile);
      assertContains(publicSkillPath, /npm run doctor/, "public skill must document installation and troubleshooting checks");
      assertContains(publicSkillPath, /npm run verify-workflow/, "public skill must document release verification");
      assertContains(publicSkillPath, /日常制作.*不属于|不属于.*日常制作/s, "public skill must keep doctor out of daily video production");
    },
  },
  {
    name: "plugin package contains only formal delivery materials",
    run: () => {
      [
        `${pluginRoot}/README-给用户看的.md`,
        `${pluginRoot}/AGENT-先读我.md`,
        `${pluginRoot}/references/规范/新手小白安装与制作教程.md`,
        `${pluginRoot}/references/审核规则/Agent执行指南.md`,
        "上传指令",
      ].forEach((relativePath) => {
        assert(!existsSync(file(relativePath)), `${relativePath} must not exist in the official plugin package`);
      });
    },
  },
];

let failures = 0;

for (const check of checks) {
  try {
    check.run();
    console.log(`PASS ${check.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${check.name}`);
    console.error(`  ${(error as Error).message}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} doctor check(s) failed.`);
  process.exit(1);
}

console.log("\nZimika Video Flow doctor checks passed. The installed engine and single public plugin entry are ready for use.");
