import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type IllustratedScenePreviewProps = {
  colorImage: string;
  lineImage: string;
  imageWidth: number;
  imageHeight: number;
};

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const containedImageSize = (
  imageWidth: number,
  imageHeight: number,
  maxWidth: number,
  maxHeight: number,
) => {
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
  };
};

export const IllustratedScenePreview: React.FC<IllustratedScenePreviewProps> = ({
  colorImage,
  lineImage,
  imageWidth,
  imageHeight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = interpolate(frame, [fps * 0.7, fps * 5.2], [0, 100], {
    ...clamp,
    easing: Easing.bezier(0.22, 0.72, 0.22, 1),
  });
  const lineOpacity = interpolate(frame, [fps * 4.4, fps * 6.4], [1, 0.16], clamp);
  const imageOpacity = interpolate(frame, [0, fps * 0.55], [0, 1], clamp);
  const scale = interpolate(frame, [0, fps * 8], [1, 1.035], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
  const verticalDrift = interpolate(frame, [0, fps * 8], [5, -5], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
  const containedSize = containedImageSize(imageWidth, imageHeight, 936, 1560);

  const imageStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f4efe5",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          width: containedSize.width,
          height: containedSize.height,
          opacity: imageOpacity,
          transform: `translateY(${verticalDrift}px) scale(${scale})`,
          transformOrigin: "center center",
          overflow: "hidden",
          borderRadius: 8,
          boxShadow: "0 26px 80px rgba(58, 48, 35, 0.12)",
          backgroundColor: "#f7f2e8",
        }}
      >
        <Img
          src={staticFile(lineImage)}
          style={{
            ...imageStyle,
            opacity: lineOpacity,
            filter: "contrast(0.92)",
          }}
        />
        <Img
          src={staticFile(colorImage)}
          style={{
            ...imageStyle,
            WebkitMaskImage: `linear-gradient(90deg, #000 0%, #000 ${Math.max(
              0,
              reveal - 10,
            )}%, rgba(0,0,0,0.72) ${reveal}%, transparent ${Math.min(100, reveal + 8)}%)`,
            maskImage: `linear-gradient(90deg, #000 0%, #000 ${Math.max(
              0,
              reveal - 10,
            )}%, rgba(0,0,0,0.72) ${reveal}%, transparent ${Math.min(100, reveal + 8)}%)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
