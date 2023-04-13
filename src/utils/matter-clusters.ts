import { readFileSync } from "fs";
import { MatterAvailableClusters, MatterClusterId } from "../models";

const clusters: MatterAvailableClusters = JSON.parse(
  readFileSync("./matter/clusters.json", "utf8"),
);

export const getCluster = <T extends MatterClusterId>(
  clusterId: T,
): MatterAvailableClusters[T] => {
  return clusters[clusterId];
};
