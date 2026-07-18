import { runShinVideoLite, type ShinVideoLiteOptions } from "../lib/shin-video-lite";
import type { VideoStyle } from "../lib/editor-types";

const args = process.argv.slice(2);

const valueAfter = (name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
};

const has = (name: string): boolean => args.includes(name);

const help = () => {
  console.log(`Shin-video lite

Usage:
  npm run shin-video:lite -- --url <article-url>
  npm run shin-video:lite -- --article-file <article.md>
  npm run shin-video:lite -- --article "文章正文" --title "视频标题"

Options:
  --url <url>                 Read article from URL.
  --article <text>            Use inline article text.
  --article-file <path>       Use a local article file.
  --title <title>             Output project/video title.
  --voiceover-file <path>     Use an existing exact voiceover script without rewriting it.
  --audio <path>              Use an existing voiceover mp3.
  --subtitle-timeline <path>  Required with --audio. Must be from the same TTS request.
  --generated-image-manifest <path>
                               Add prepared AI concept images after scene generation.
  --tts-provider <provider>   minimax | volcengine | custom
  --voice-id <id>             Voice ID for the selected TTS provider.
  --style <style>             light-finance-mg | news-commentary | knowledge-explainer | fast-short-video | dark-data-analysis
  --aspect-ratio <ratio>      16:9 | 9:16
  --output-root <path>        Override output root.
  --skip-render               Generate production package but skip Remotion render.
  --dry-run                   No TTS provider or Remotion. Creates a structure-only package.
  --help                      Show help.
`);
};

const main = async () => {
  if (has("--help") || args.length === 0) {
    help();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const options: ShinVideoLiteOptions = {
    url: valueAfter("--url"),
    article: valueAfter("--article"),
    articlePath: valueAfter("--article-file"),
    title: valueAfter("--title"),
    outputRoot: valueAfter("--output-root"),
    voiceId: valueAfter("--voice-id"),
    ttsProvider: valueAfter("--tts-provider") as ShinVideoLiteOptions["ttsProvider"],
    voiceoverPath: valueAfter("--voiceover-file"),
    audioPath: valueAfter("--audio"),
    subtitleTimelinePath: valueAfter("--subtitle-timeline"),
    generatedImageManifestPath: valueAfter("--generated-image-manifest"),
    style: valueAfter("--style") as VideoStyle | undefined,
    aspectRatio: valueAfter("--aspect-ratio") as "16:9" | "9:16" | undefined,
    dryRun: has("--dry-run"),
    skipRender: has("--skip-render"),
  };

  const result = await runShinVideoLite(options);
  console.log(JSON.stringify(result, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
