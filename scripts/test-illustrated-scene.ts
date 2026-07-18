import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import {
  createIllustratedImageManifestEntry,
  isImageSizeValid,
} from "../lib/illustrated-image";

const projectRoot = path.resolve(__dirname, "..");
const outputRoot =
  process.env.ILLUSTRATED_SCENE_OUTPUT_ROOT?.trim() ||
  path.join(projectRoot, "outputs", "illustrated-scene-test");
const publicRuntimeDir = path.join(
  projectRoot,
  "public",
  "runtime",
  "illustrated-scene-test",
);
const imageSkillDir = process.env.IMAGE_PROMPT_GENERATOR_ROOT?.trim();
const sceneId = "illustrated-preview-01";
const prompt = [
  "请直接创作一张完整的手绘叙事插画。",
  "画面使用暖白宣纸底色和黑色细手绘线条，表现中国北方乡村院落。",
  "一位白发老人站在木栅栏旁，一匹白马从远处回到院门。",
  "远景有淡墨山丘和稀疏树木，低饱和朱红、青灰与暖褐配色。",
  "构图像成熟的中文寓言绘本，人物、白马、院门关系清晰，主体完整可见。",
  "保留适度环境细节和叙事层次，但不要文字、不要 UI、不要现代物件、不要照片质感、不要噪点。",
  "必须一次生成完整画面，不要拼图，不要边框，不要裁切主体。",
].join("");

type ImageGenerationResult = {
  model: string;
  requested_size: string;
  actual_size: string;
  image_path: string;
  request_path: string;
  response_path: string;
};

const run = (
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out`));
    }, options.timeoutMs ?? 120_000);

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const output = Buffer.concat(stdout).toString("utf8");
      if (code === 0) {
        resolve(output);
        return;
      }
      reject(
        new Error(
          `${command} exited with ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`,
        ),
      );
    });
  });

const parseSize = (size: string) => {
  const match = /^(\d+)x(\d+)$/.exec(size.trim());
  if (!match) {
    throw new Error(`Cannot parse generated image size: ${size}`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
};

const generateImage = async (): Promise<ImageGenerationResult> => {
  if (!imageSkillDir) {
    throw new Error(
      "缺少 IMAGE_PROMPT_GENERATOR_ROOT。请将它设为 Image Prompt Generator Skill 的本地目录。",
    );
  }

  const manifestPath = path.join(outputRoot, "generated-image-manifest.json");
  const finalImage = path.join(outputRoot, "手绘绘本测试插画.png");
  const generationDir = path.join(outputRoot, "_generation");
  try {
    await Promise.all([access(manifestPath), access(finalImage)]);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      images?: Array<{
        requestedSize?: { width: number; height: number };
        actualSize?: { width: number; height: number };
        requestRecord?: string;
        responseRecord?: string;
      }>;
    };
    const existing = manifest.images?.[0];
    if (
      existing?.requestedSize &&
      existing.actualSize &&
      existing.requestRecord &&
      existing.responseRecord
    ) {
      return {
        model: "gpt-image-2",
        requested_size: `${existing.requestedSize.width}x${existing.requestedSize.height}`,
        actual_size: `${existing.actualSize.width}x${existing.actualSize.height}`,
        image_path: finalImage,
        request_path: existing.requestRecord,
        response_path: existing.responseRecord,
      };
    }
  } catch {
    // No complete prior generation exists; continue with one real request.
  }

  await mkdir(generationDir, { recursive: true });
  const stdout = await run(
    "python3",
    [
      path.join(imageSkillDir, "scripts", "generate_image.py"),
      "--prompt",
      prompt,
      "--size",
      "2k",
      "--quality",
      "hd",
      "--output-dir",
      generationDir,
    ],
    { cwd: imageSkillDir, timeoutMs: 1_800_000 },
  );
  const result = JSON.parse(stdout) as ImageGenerationResult;
  const size = parseSize(result.actual_size);
  if (!isImageSizeValid(size.width, size.height)) {
    throw new Error(`Image generation returned invalid dimensions: ${result.actual_size}`);
  }
  return result;
};

const main = async () => {
  await mkdir(outputRoot, { recursive: true });
  await mkdir(publicRuntimeDir, { recursive: true });

  const result = await generateImage();
  const actualSize = parseSize(result.actual_size);
  const requestedSize = parseSize(result.requested_size);
  const finalImage = path.join(outputRoot, "手绘绘本测试插画.png");
  const lineImage = path.join(outputRoot, "手绘绘本测试插画-线稿.png");
  if (path.resolve(result.image_path) !== path.resolve(finalImage)) {
    await copyFile(result.image_path, finalImage);
  }

  await run(
    "/opt/homebrew/bin/ffmpeg",
    [
      "-y",
      "-i",
      finalImage,
      "-vf",
      "format=gray,edgedetect=low=0.06:high=0.19,negate,eq=contrast=0.72:brightness=0.1",
      "-frames:v",
      "1",
      lineImage,
    ],
    { timeoutMs: 120_000 },
  );

  const runtimeColor = path.join(publicRuntimeDir, "storybook-color.png");
  const runtimeLine = path.join(publicRuntimeDir, "storybook-line.png");
  await copyFile(finalImage, runtimeColor);
  await copyFile(lineImage, runtimeLine);

  const requestCopy = path.join(outputRoot, "image-generation-request.json");
  const responseCopy = path.join(outputRoot, "image-generation-response.json");
  if (path.resolve(result.request_path) !== path.resolve(requestCopy)) {
    await copyFile(result.request_path, requestCopy);
  }
  if (path.resolve(result.response_path) !== path.resolve(responseCopy)) {
    await copyFile(result.response_path, responseCopy);
  }

  const manifest = {
    images: [
      createIllustratedImageManifestEntry({
        id: "storybook-scene-01",
        fileName: path.basename(finalImage),
        prompt,
        requestedSize,
        actualSize,
        sceneId,
        requestRecord: requestCopy,
        responseRecord: responseCopy,
      }),
    ],
  };
  const manifestPath = path.join(outputRoot, "generated-image-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const serveUrl = await bundle(path.join(projectRoot, "remotion", "index.ts"));
  const inputProps = {
    colorImage: "runtime/illustrated-scene-test/storybook-color.png",
    lineImage: "runtime/illustrated-scene-test/storybook-line.png",
    imageWidth: actualSize.width,
    imageHeight: actualSize.height,
  };
  const composition = await selectComposition({
    serveUrl,
    id: "IllustratedScenePreview",
    inputProps,
  });
  const stillPath = path.join(outputRoot, "单镜头代表帧.png");
  const videoPath = path.join(outputRoot, "手绘绘本单镜头测试.mp4");

  await renderStill({
    composition,
    serveUrl,
    output: stillPath,
    inputProps,
    frame: 120,
    imageFormat: "png",
  });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: videoPath,
    inputProps,
  });

  await rm(path.join(outputRoot, "_generation"), {
    recursive: true,
    force: true,
  });

  console.log(
    JSON.stringify(
      {
        image: finalImage,
        actualSize,
        actualRatio: actualSize.width / actualSize.height,
        manifest: manifestPath,
        still: stillPath,
        video: videoPath,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
