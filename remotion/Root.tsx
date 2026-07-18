import type { CalculateMetadataFunction } from "remotion";
import { Composition } from "remotion";
import { ShinVideo } from "./Video";
import { StormVideo } from "./StormVideo";
import {
  IllustratedScenePreview,
} from "./IllustratedScenePreview";
import { defaultRenderInput, type RenderInput } from "../lib/types";

const calculateMetadata: CalculateMetadataFunction<RenderInput> = ({ props }) => {
  return {
    durationInFrames: Math.max(1, Math.ceil(props.duration * props.fps)),
    fps: props.fps,
    width: props.width,
    height: props.height,
  };
};

const AUDIO_PATH = "storm-audio.mp3";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="ShinVideo"
        component={ShinVideo}
        durationInFrames={Math.ceil(defaultRenderInput.duration * defaultRenderInput.fps)}
        fps={defaultRenderInput.fps}
        width={defaultRenderInput.width}
        height={defaultRenderInput.height}
        defaultProps={defaultRenderInput}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id="StormVideo"
        component={StormVideo}
        durationInFrames={Math.ceil(84.9 * 30)}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          audioPath: AUDIO_PATH,
          fps: 30,
          width: 1920,
          height: 1080,
        }}
      />
      <Composition
        id="IllustratedScenePreview"
        component={IllustratedScenePreview}
        durationInFrames={8 * 30}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          colorImage: "runtime/illustrated-scene-test/storybook-color.png",
          lineImage: "runtime/illustrated-scene-test/storybook-line.png",
          imageWidth: 2560,
          imageHeight: 1440,
        }}
      />
    </>
  );
};
