import type { ShotStyle } from "./types";

export const resolveSceneStageInset = ({
  width,
  height,
  hasDirector,
  caseWorkflow,
}: {
  width: number;
  height: number;
  hasDirector: boolean;
  shotStyle?: ShotStyle;
  caseWorkflow: boolean;
}): string => {
  const isPortrait = height > width;

  if (isPortrait) {
    return hasDirector
      ? "150px 48px 320px 48px"
      : "160px 56px 330px 56px";
  }

  if (hasDirector) {
    return "0px";
  }

  if (caseWorkflow) {
    return "72px 110px 260px 120px";
  }

  return "90px 108px 118px 128px";
};

