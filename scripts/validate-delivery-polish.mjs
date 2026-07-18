import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const pluginRelativePath = path.join("plugins", "shin-video");
const pluginRoot = path.join(root, pluginRelativePath);

const textFileExtensions = new Set([".json", ".md", ".mjs", ".cjs", ".js", ".ts", ".yaml", ".yml", ".sh"]);
const assetFileExtensions = new Set([".gif", ".jpeg", ".jpg", ".png", ".webp", ".svg"]);
const requiredFiles = [
  ".codex-plugin/plugin.json",
  "AGENTS.md",
  "README.md",
  "config.example.json",
  "plugin-manifest/plugin.json",
  "workflow-manifest.json",
];
const forbiddenPathParts = new Set([
  ".DS_Store",
  ".env",
  ".git",
  ".next",
  "node_modules",
  "runtime",
  "dist",
  "build",
  "coverage",
  "__pycache__",
]);
const maxFileSizeBytes = 10 * 1024 * 1024;
const maxPackageSizeBytes = 25 * 1024 * 1024;
const sensitiveContentPatterns = [
  {
    pattern: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/,
    reason: "contains a private key",
  },
  {
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/,
    reason: "contains a GitHub token",
  },
  {
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
    reason: "contains an AWS access key",
  },
  {
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
    reason: "contains an API key",
  },
  {
    pattern: /(?:^|[^\w])(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?(?!\$|\{|\[|<|YOUR_|REPLACE_|example|changeme|todo)[A-Za-z0-9_./+=:-]{12,}/im,
    reason: "contains a likely hard-coded credential",
  },
  {
    pattern: /(?:^|[^\w])\/(?:Users|home)\/[^/\s]+(?:\/|$)/m,
    reason: "contains an absolute user home path",
  },
];

const failures = [];

const toPosix = (relativePath) => relativePath.split(path.sep).join("/");

const isAllowedPath = (relativePath) => {
  const normalized = toPosix(relativePath);
  if (requiredFiles.includes(normalized)) {
    return true;
  }

  if (/^skills\/[a-z0-9-]+\/SKILL\.md$/.test(normalized)) {
    return true;
  }

  if (/^references\/(?:审核规则|规范|行业模板\/visual-library)\/.+\.md$/.test(normalized)) {
    return true;
  }

  if (/^templates\/交付\/.+\.md$/.test(normalized)) {
    return true;
  }

  const extension = path.extname(normalized).toLowerCase();
  if (normalized.startsWith("assets/")) {
    return assetFileExtensions.has(extension);
  }

  if (normalized.startsWith("scripts/")) {
    return textFileExtensions.has(extension);
  }

  return false;
};

const walk = (relativeDir) => {
  if (!existsSync(path.join(pluginRoot, relativeDir))) {
    return [];
  }

  const results = [];
  const entries = readdirSync(path.join(pluginRoot, relativeDir));

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry);
    const parts = relativePath.split(path.sep);
    if (parts.some((part) => forbiddenPathParts.has(part))) {
      failures.push(`${toPosix(relativePath)}: forbidden package path`);
      continue;
    }

    const absolutePath = path.join(pluginRoot, relativePath);
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      failures.push(`${toPosix(relativePath)}: symbolic links are not allowed in the publish package`);
    } else if (stat.isDirectory()) {
      results.push(...walk(relativePath));
    } else if (stat.isFile()) {
      results.push(relativePath);
    } else {
      failures.push(`${toPosix(relativePath)}: only regular files are allowed in the publish package`);
    }
  }

  return results;
};

const runOfficialValidator = (isolatedPluginRoot) => {
  const configuredCodexHome = process.env.CODEX_HOME;
  const validatorCandidates = [
    process.env.CODEX_PLUGIN_VALIDATOR,
    configuredCodexHome && path.join(configuredCodexHome, "skills", ".system", "plugin-creator", "scripts", "validate_plugin.py"),
    path.join(os.homedir(), ".codex", "skills", ".system", "plugin-creator", "scripts", "validate_plugin.py"),
  ].filter(Boolean);
  const validatorPath = validatorCandidates.find((candidate) => existsSync(candidate));

  if (!validatorPath) {
    failures.push(
      "official Codex plugin validator was not found; set CODEX_PLUGIN_VALIDATOR or CODEX_HOME to the Codex installation",
    );
    return;
  }

  console.log(`Running official Codex plugin validator: ${validatorPath}`);
  const result = spawnSync(process.env.PYTHON ?? "python3", [validatorPath, isolatedPluginRoot], {
    cwd: root,
    encoding: "utf8",
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    failures.push(`official Codex plugin validator could not run: ${result.error.message}`);
  } else if (result.status !== 0) {
    failures.push(`official Codex plugin validator exited with status ${result.status}`);
  }
};

if (!existsSync(pluginRoot)) {
  failures.push(`${pluginRelativePath} is missing`);
}

const files = failures.length === 0 ? walk("") : [];
let packageSizeBytes = 0;

for (const file of files) {
  const normalized = toPosix(file);
  if (!isAllowedPath(file)) {
    failures.push(`${normalized}: not in the plugin publish allowlist`);
    continue;
  }

  const size = statSync(path.join(pluginRoot, file)).size;
  packageSizeBytes += size;
  if (size > maxFileSizeBytes) {
    failures.push(`${normalized}: exceeds the 10 MiB per-file publish limit`);
  }

  if (textFileExtensions.has(path.extname(file).toLowerCase())) {
    const text = readFileSync(path.join(pluginRoot, file), "utf8");
    for (const { pattern, reason } of sensitiveContentPatterns) {
      if (pattern.test(text)) {
        failures.push(`${normalized}: ${reason}`);
      }
    }
  }
}

if (packageSizeBytes > maxPackageSizeBytes) {
  failures.push("plugin package exceeds the 25 MiB publish limit");
}

for (const relativePath of requiredFiles) {
  if (!existsSync(path.join(pluginRoot, relativePath))) {
    failures.push(`${toPosix(path.join(pluginRelativePath, relativePath))} is missing`);
  }
}

if (failures.length > 0) {
  console.error("Plugin publish validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "shin-video-plugin-"));
const isolatedPluginRoot = path.join(temporaryRoot, "shin-video");

try {
  cpSync(pluginRoot, isolatedPluginRoot, {
    errorOnExist: true,
    force: false,
    recursive: true,
    verbatimSymlinks: true,
  });
  console.log(`Validated clean plugin copy: ${isolatedPluginRoot}`);
  runOfficialValidator(isolatedPluginRoot);
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}

if (failures.length > 0) {
  console.error("Plugin publish validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Plugin publish validation passed. plugins/shin-video is the sole formal publish package.");
