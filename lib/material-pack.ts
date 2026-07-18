import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export type MaterialPackValidation = {
  ok: boolean;
  path: string;
  errors: string[];
  warnings: string[];
  referencedImages: string[];
  audioPath?: string;
  kind?: "generic" | "template-project";
  templateProjectPath?: string;
};

const requiredFiles = ["article.cleaned.md", "image-list.md", "voiceover.md", "video-prompt.md"] as const;
const chinesePackFiles = ["文章正文_清洗版.md", "正文素材_含图片位置.md", "文章带图片位置_清洗版.md", "图片清单.json"] as const;
const cleanPackFiles = ["article.md", "voiceover.md", "article-images.md", "image-list.json"] as const;
const standardPackFiles = ["文章.md", "口播文案.md", "图文位置.md", "图片清单.json"] as const;
const audioExtensions = [".mp3", ".wav", ".m4a"] as const;

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const readIfExists = async (filePath: string): Promise<string> => {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
};

const listImageFiles = async (materialPackPath: string): Promise<string[]> => {
  const imagesDir = path.join(materialPackPath, "images");
  const searchDir = (await exists(imagesDir)) ? imagesDir : materialPackPath;
  const files = await readdir(searchDir);

  return files
    .filter((file) => /^\d+\.(jpg|jpeg|png|webp)$/i.test(file))
    .sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
};

const firstExistingFile = async (materialPackPath: string, fileNames: readonly string[]): Promise<string | null> => {
  for (const fileName of fileNames) {
    if (await exists(path.join(materialPackPath, fileName))) return fileName;
  }

  return null;
};

export const findVoiceoverAudio = async (materialPackPath: string): Promise<string | undefined> => {
  for (const extension of audioExtensions) {
    const audioPath = path.join(materialPackPath, `口播音频${extension}`);
    if (await exists(audioPath)) return audioPath;
  }

  return undefined;
};

const findTemplateProject = async (materialPackPath: string, warnings: string[]): Promise<string | null> => {
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
      warnings.push(`${entry.name}/package.json 读取失败，已跳过模板工程检测`);
    }
  }

  return null;
};

export const extractImageReferences = (content: string): string[] => {
  const refs = new Set<string>();
  const patterns = [
    /(?:^|\D)(\d+)\.(?:jpg|jpeg|png|webp)\b/gi,
    /图片\s*(\d+)/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      refs.add(`${match[1]}.jpg`);
    }
  }

  return [...refs].sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
};

export const validateMaterialPack = async (materialPackPath: string): Promise<MaterialPackValidation> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let combinedContent = "";

  const audioPath = await findVoiceoverAudio(materialPackPath);
  const templateProjectPath = await findTemplateProject(materialPackPath, warnings);
  const hasStandardPack = await exists(path.join(materialPackPath, "文章.md")) || await exists(path.join(materialPackPath, "口播文案.md")) || await exists(path.join(materialPackPath, "图文位置.md"));
  const hasCleanPack = await exists(path.join(materialPackPath, "article.md")) || await exists(path.join(materialPackPath, "article-images.md")) || await exists(path.join(materialPackPath, "image-list.json"));
  const hasChinesePack = await exists(path.join(materialPackPath, "文章带图片位置_清洗版.md"));
  if (hasStandardPack || hasCleanPack || templateProjectPath || hasChinesePack) {
    const requiredTemplateProjectFiles: string[] = [];
    if (hasStandardPack) {
      requiredTemplateProjectFiles.push(...standardPackFiles);
    } else if (hasCleanPack) {
      requiredTemplateProjectFiles.push(...cleanPackFiles);
    } else {
      requiredTemplateProjectFiles.push(...chinesePackFiles);
    }
    if (templateProjectPath) {
      const templateProjectName = path.basename(templateProjectPath);
      requiredTemplateProjectFiles.push(path.join(templateProjectName, "package.json"));
    }

    for (const file of requiredTemplateProjectFiles) {
      if (!(await exists(path.join(materialPackPath, file)))) {
        errors.push(`模板工程素材包缺少 ${file}`);
      }
    }

    const images = await listImageFiles(materialPackPath);
    if (images.length === 0) {
      errors.push("素材包缺少 images/ 图片文件");
    }

    return {
      ok: errors.length === 0,
      path: materialPackPath,
      errors,
      warnings,
      referencedImages: images,
      audioPath,
      kind: "template-project",
      templateProjectPath: templateProjectPath ?? undefined,
    };
  }

  for (const file of requiredFiles) {
    const filePath = path.join(materialPackPath, file);
    if (!(await exists(filePath))) {
      errors.push(`素材包缺少 ${file}`);
    }
    combinedContent += `\n${await readIfExists(filePath)}`;
  }

  const imagesDir = path.join(materialPackPath, "images");
  if (!(await exists(imagesDir))) {
    errors.push("素材包缺少 images/");
  }

  const referencedImages = extractImageReferences(combinedContent);
  if (await exists(imagesDir)) {
    for (const image of referencedImages) {
      if (!(await exists(path.join(imagesDir, image)))) {
        errors.push(`素材包缺少 images/${image}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    path: materialPackPath,
    errors,
    warnings,
    referencedImages,
    audioPath,
    kind: "generic",
  };
};

export const readMaterialPackFile = (materialPackPath: string, fileName: string): Promise<string> => {
  return readFile(path.join(materialPackPath, fileName), "utf8");
};

export const readFirstExistingMaterialPackFile = async (materialPackPath: string, fileNames: string[]): Promise<{ fileName: string; content: string }> => {
  for (const fileName of fileNames) {
    const filePath = path.join(materialPackPath, fileName);
    if (await exists(filePath)) {
      return { fileName, content: await readFile(filePath, "utf8") };
    }
  }

  throw new Error(`素材包缺少 ${fileNames.join(" / ")}`);
};

export const resolveMaterialImagePath = async (materialPackPath: string, imageName: string): Promise<string> => {
  const candidates = [path.join(materialPackPath, "images", imageName), path.join(materialPackPath, imageName)];
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }

  throw new Error(`素材包缺少图片 ${imageName}`);
};
