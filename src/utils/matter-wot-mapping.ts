import { readFileSync } from "fs";
import type { MatterWotMapping } from "../models";

const mapping: MatterWotMapping = JSON.parse(
  readFileSync("./matter/wot-mapping.json", "utf8"),
);

export const getMappedCluster = (
  clusterId: string,
): MatterWotMapping[string] => {
  return mapping[clusterId];
};
