import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type TemplateProjectRenderInput = {
  materialPackPath: string;
  sourceAudioPath: string;
};

export type TemplateProjectRenderResult = {
  videoPath: string;
  audioPath: string;
  voiceoverFile: string;
  templateProjectPath: string;
};

const defaultVoiceoverName = "shin-video-voiceover.mp3";

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const runCommand = (command: string, args: string[], cwd: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(new Error(`${command} 启动失败：${error.message}`));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
      reject(new Error(`${command} ${args.join(" ")} 失败：${output || `退出码 ${code}`}`));
    });
  });
};

export const resolveTemplateProjectPath = async (materialPackPath: string): Promise<string> => {
  const entries = await readdir(materialPackPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const candidate = path.join(materialPackPath, entry.name);
    const packageJsonPath = path.join(candidate, "package.json");
    if (!(await exists(packageJsonPath))) continue;

    try {
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps.remotion && packageJson.scripts?.render) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  throw new Error("当前素材包不是可渲染的 Remotion 模板工程");
};

export const setTemplateProjectVoiceoverFile = async (scenesPath: string, voiceoverFile: string): Promise<void> => {
  const source = await readFile(scenesPath, "utf8");
  const voiceoverPattern = /export const VOICEOVER_FILE = "([^"]+)";/;

  if (!voiceoverPattern.test(source)) {
    throw new Error("未找到 VOICEOVER_FILE 字段，无法更新音频路径");
  }

  const next = source.replace(voiceoverPattern, `export const VOICEOVER_FILE = "${voiceoverFile}";`);
  await writeFile(scenesPath, next);
};

const findVoiceoverScenesFile = async (rootDir: string): Promise<string> => {
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const found = await findVoiceoverScenesFile(entryPath).catch(() => null);
      if (found) return found;
      continue;
    }

    if (!/\.(ts|tsx|js|jsx)$/i.test(entry.name)) continue;
    const source = await readFile(entryPath, "utf8");
    if (/export const VOICEOVER_FILE = "([^"]+)";/.test(source)) {
      return entryPath;
    }
  }

  throw new Error("模板工程里没有找到 VOICEOVER_FILE 字段");
};

const findLatestMp4 = async (outDir: string): Promise<string> => {
  const entries = await readdir(outDir, { withFileTypes: true });
  const mp4s = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /\.mp4$/i.test(entry.name))
      .map(async (entry) => {
        const filePath = path.join(outDir, entry.name);
        const info = await stat(filePath);
        return { filePath, mtimeMs: info.mtimeMs };
      }),
  );

  const latest = mp4s.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  if (!latest) {
    throw new Error("Remotion 渲染结束，但 out/ 里没有找到 mp4 文件");
  }

  return latest.filePath;
};

export const renderTemplateProjectVideo = async ({ materialPackPath, sourceAudioPath }: TemplateProjectRenderInput): Promise<TemplateProjectRenderResult> => {
  const templateProjectPath = await resolveTemplateProjectPath(materialPackPath);
  const packageJsonPath = path.join(templateProjectPath, "package.json");
  if (!(await exists(packageJsonPath))) {
    throw new Error("当前素材包不是可渲染的 Remotion 模板工程");
  }

  const audioDir = path.join(templateProjectPath, "public", "audio");
  await mkdir(audioDir, { recursive: true });

  const extension = path.extname(sourceAudioPath) || ".mp3";
  const audioFileName = extension.toLowerCase() === ".mp3" ? defaultVoiceoverName : `shin-video-voiceover${extension}`;
  const audioPath = path.join(audioDir, audioFileName);
  await copyFile(sourceAudioPath, audioPath);

  const voiceoverFile = `audio/${audioFileName}`;
  const scenesPath = await findVoiceoverScenesFile(path.join(templateProjectPath, "src"));
  await setTemplateProjectVoiceoverFile(scenesPath, voiceoverFile);

  await runCommand("npm", ["run", "check-assets"], templateProjectPath);
  await runCommand("npm", ["run", "render"], templateProjectPath);

  const videoPath = await findLatestMp4(path.join(templateProjectPath, "out"));

  return {
    videoPath,
    audioPath,
    voiceoverFile,
    templateProjectPath,
  };
};
