import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type Check = {
  name: string;
  run: () => void;
};

const root = process.cwd();
const pluginRoot = "plugins/shin-video";

const requiredDirectorTypes = [
  "Hero",
  "Timeline",
  "SystemMap",
  "DataExplosion",
  "Contrast",
  "SpecSheet",
  "Pricing",
  "Pause",
  "Summary",
  "EvidenceHero",
  "KeywordInvestigation",
  "FinancialMeter",
  "SystemStack",
  "DependencyMap",
  "QuestionPause",
  "BarrierWall",
  "EvidenceReturn",
  "IndustrySignal",
  "CompetitionLayerStack",
  "FinalJudgement",
];

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

const requiredSkills = [
  "shin-video-lite",
  "shin-video-director",
  "video-brief-builder",
  "web-article-cleaner",
  "voiceover-writer",
  "audio-checker",
  "scene-generator",
  "subtitle-rhythm-builder",
  "browser-evidence-capture",
  "asset-researcher",
  "visual-manifest-builder",
  "remotion-video-director",
  "style-consultant",
  "animation-preset-builder",
  "production-gate-checker",
  "remotion-renderer",
];

const requiredRemotionPackages = {
  remotion: "4.0.484",
  "@remotion/cli": "4.0.484",
  "@remotion/bundler": "4.0.484",
  "@remotion/renderer": "4.0.484",
  zod: "4.3.6",
};

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
  const text = read(relativePath);
  assert(pattern.test(text), `${relativePath}: ${message}`);
};

const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
};

const checks: Check[] = [
  {
    name: "package scripts expose full workflow verification",
    run: () => {
      assert(packageJson.scripts?.doctor === "tsx scripts/doctor.ts", "package.json must expose npm run doctor");
      assert(
        packageJson.scripts?.["verify-delivery"] === "node scripts/validate-delivery-polish.mjs",
        "package.json must expose npm run verify-delivery",
      );
      assert(
        packageJson.scripts?.["verify-workflow"] === "npm run doctor && npm run verify-skill-visual-gate && npm run verify-delivery && npm run test && npm run build",
        "package.json must expose npm run verify-workflow",
      );
      assert(packageJson.scripts?.["production-gate"] === "tsx scripts/production-gate.ts", "package.json must expose npm run production-gate");
      assert(packageJson.scripts?.["shin-video:lite"] === "tsx scripts/shin-video-lite.ts", "package.json must expose npm run shin-video:lite");
    },
  },
  {
    name: "Remotion dependency versions are pinned for the renderer",
    run: () => {
      for (const [name, version] of Object.entries(requiredRemotionPackages)) {
        assert(packageJson.dependencies?.[name] === version, `${name} must be exactly ${version}`);
      }
    },
  },
  {
    name: "provider-native TTS timeline contract is wired",
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
      assertContains(
        "app/api/generate-scenes/route.ts",
        /parseProviderNativeSubtitleTimeline/,
        "scene generation must reject non-provider timelines",
      );
      assertContains(
        "app/api/archive-project/route.ts",
        /audioPackageItemCount/,
        "project archive must enforce the complete audio package",
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
    name: "Remotion project entry files exist",
    run: () => {
      ["remotion/index.ts", "remotion/Root.tsx", "remotion/Video.tsx"].forEach(assertFile);
    },
  },
  {
    name: "visual component library is included",
    run: () => {
      requiredVisualLibraryFiles.forEach((name) => assertFile(`remotion/visual-library/${name}`));
      assertContains(
        "remotion/visual-library/index.ts",
        /export \* from "\.\/director";[\s\S]*export \* from "\.\/finance";[\s\S]*export \* from "\.\/tech";/,
        "visual-library must export director, finance and tech modules",
      );
    },
  },
  {
    name: "TypeScript schema includes every director scene type",
    run: () => {
      const types = read("lib/types.ts");
      requiredDirectorTypes.forEach((type) => {
        assert(types.includes(`| "${type}"`) || types.includes(`= "${type}"`), `lib/types.ts missing DirectorSceneType ${type}`);
      });
    },
  },
  {
    name: "scene-generator uses the semantic director contract",
    run: () => {
      const sceneGenerator = read("lib/scene-generator.ts");
      [
        "selectDirectorPlan",
        "directorQualityTargets",
        "directorContractIssues",
        "content",
      ].forEach((needle) => assert(sceneGenerator.includes(needle), `lib/scene-generator.ts missing ${needle}`));
      assertContains("lib/director-selector.ts", /rendererFamily/, "director selector must assign renderer families");
      assertContains("lib/director-selector.ts", /visualTreatment/, "director selector must assign visual treatments");
      assertContains("lib/director-selector.ts", /components/, "director selector must assign derived components");
      [
        "lib/scene-semantics.ts",
        "lib/director-capabilities.ts",
        "lib/director-contract.ts",
        "lib/director-content.ts",
        "lib/director-components.ts",
        "lib/director-selector.ts",
        "lib/scene-resegment.ts",
        "lib/visual-form.ts",
      ].forEach(assertFile);
      requiredDirectorTypes.forEach((type) => {
        assert(sceneGenerator.includes(`${type}:`) || sceneGenerator.includes(`"${type}"`), `scene-generator missing ${type}`);
      });
    },
  },
  {
    name: "director-plan fingerprint gate is present",
    run: () => {
      assertContains("lib/director-plan.ts", /createSourceScenesFingerprint/, "must create source scenes fingerprint");
      assertContains("lib/director-plan.ts", /assertDirectorPlanMatchesScenes/, "must fail when director-plan does not match scenes");
      assertContains("lib/remotion-render.ts", /assertDirectorPlanMatchesScenes/, "renderer must call director-plan fingerprint gate");
      assertContains("lib/remotion-render.ts", /validateProductionGate/, "renderer must call production gate before rendering");
      ["lib/video-brief.ts", "lib/asset-researcher.ts", "lib/visual-manifest.ts", "lib/production-gate.ts", "scripts/production-gate.ts"].forEach(assertFile);
      ["lib/shin-video-lite.ts", "scripts/shin-video-lite.ts", "test/shin-video-lite.test.ts"].forEach(assertFile);
    },
  },
  {
    name: "asset research is wired into lite and full workflows",
    run: () => {
      assertContains("lib/shin-video-lite.ts", /researchAssets/, "lite workflow must collect related evidence assets");
      assertContains("lib/shin-video-lite.ts", /bindAssetsToScenes/, "lite workflow must bind assets to scenes before director-plan");
      assertContains("app/api/generate-scenes/route.ts", /researchAssets/, "full workflow must collect related evidence assets");
      assertContains("app/api/generate-scenes/route.ts", /bindAssetsToScenes/, "full workflow must bind assets to scenes before director-plan");
      assertContains("app/api/render-preview/route.ts", /assetManifestPath/, "preview render route must pass asset-manifest path");
      assertContains("app/api/export-video/route.ts", /assetManifestPath/, "final render route must pass asset-manifest path");
      assertContains("lib/remotion-render.ts", /assetManifestPath/, "renderer must accept asset-manifest path");
      assertContains("lib/remotion-render.ts", /RuntimeAssetManifest/, "renderer must read runtime asset manifest");
      assertContains("lib/production-gate.ts", /asset-manifest/, "production gate must validate asset-manifest");
      assertContains("scripts/production-gate.ts", /asset-manifest/, "production gate CLI must require asset-manifest");
      assertContains("lib/types.ts", /RuntimeEvidenceRecord/, "types must expose browser/headless evidence records");
      assertContains("lib/asset-researcher.ts", /captureSourceEvidence/, "asset researcher must capture source article evidence");
      assertContains("lib/asset-researcher.ts", /evidenceRecords/, "asset researcher must write evidence records into asset-manifest");
      assertContains("lib/production-gate.ts", /evidenceRecords/, "production gate must validate asset-manifest evidence records");
      assertFile(`${pluginRoot}/skills/browser-evidence-capture/SKILL.md`);
    },
  },
  {
    name: "Remotion renderer routes new director types to visual-library scenes",
    run: () => {
      const video = read("remotion/Video.tsx");
      assert(video.includes("VisualLibraryScene"), "Video.tsx must call VisualLibraryScene before legacy fallbacks");
      requiredDirectorTypes.forEach((type) => {
        assert(video.includes(`${type}:`) || video.includes(`directorType === "${type}"`), `Video.tsx missing renderer route for ${type}`);
      });
    },
  },
  {
    name: "official plugin package contains all required skills",
    run: () => {
      requiredSkills.forEach((skill) => assertFile(`${pluginRoot}/skills/${skill}/SKILL.md`));
    },
  },
  {
    name: "renderer and director skills require full renderer verification",
    run: () => {
      [
        `${pluginRoot}/skills/shin-video-director/SKILL.md`,
        `${pluginRoot}/skills/remotion-renderer/SKILL.md`,
        `${pluginRoot}/skills/remotion-video-director/SKILL.md`,
      ].forEach((relativePath) => {
        assertContains(relativePath, /npm run doctor/, "must tell Agent/user to run the renderer doctor");
        assertContains(relativePath, /RUN_DIR\/director-plan\.json/, "must require director-plan.json");
        assertContains(relativePath, /RUN_DIR\/style-profile\.json/, "must require style-profile.json");
        assertContains(relativePath, /RUN_DIR\/video-brief\.json/, "must require video-brief.json");
        assertContains(relativePath, /RUN_DIR\/asset-manifest\.json/, "must require asset-manifest.json");
        assertContains(relativePath, /RUN_DIR\/visual-manifest\.json/, "must require visual-manifest.json");
        assertContains(relativePath, /sourceScenesFingerprint/, "must require director-plan fingerprint");
      });
    },
  },
  {
    name: "official plugin docs expose full-power deployment check",
    run: () => {
      [
        `${pluginRoot}/README.md`,
        `${pluginRoot}/AGENTS.md`,
        `${pluginRoot}/references/规范/getting-started.md`,
        `${pluginRoot}/references/审核规则/agent-guide.md`,
      ].forEach(assertFile);
      assertContains(
        `${pluginRoot}/skills/shin-video-director/SKILL.md`,
        /npm run doctor/,
        "must document the full renderer check",
      );
      assertContains(
        `${pluginRoot}/skills/shin-video-director/SKILL.md`,
        /npm run verify-workflow/,
        "must document the full workflow verification",
      );
    },
  },
  {
    name: "style selection has no hidden default",
    run: () => {
      [
        `${pluginRoot}/skills/style-consultant/SKILL.md`,
      ].forEach((relativePath) => {
        assertContains(relativePath, /不设置默认风格/, "style consultant must not set a hidden default");
        assert(!/如果用户不回复或明确说默认，选择/.test(read(relativePath)), `${relativePath}: must not auto-select a default style`);
      });
    },
  },
  {
    name: "official plugin package uses formal names and current rules",
    run: () => {
      [
        `${pluginRoot}/README.md`,
        `${pluginRoot}/AGENTS.md`,
        `${pluginRoot}/references/规范/getting-started.md`,
        `${pluginRoot}/references/审核规则/agent-guide.md`,
        "scripts/validate-delivery-polish.mjs",
      ].forEach(assertFile);

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

console.log("\nShin-video doctor checks passed. Local engine and official plugin package look deployable.");
