import clusters from "../../matter/clusters.json";

export type MatterAvailableClusters = typeof clusters;
export type MatterClusterId = keyof MatterAvailableClusters;
export type MatterCluster = MatterAvailableClusters[MatterClusterId];
