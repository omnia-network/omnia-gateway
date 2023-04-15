import { ProxyConfig } from "./proxy";

export type DbMatterDeviceInfo = {
  vendorId: number;
  productId: number;

  // TODO: make it required, which means we need to change the way we initialize this object
  pairingCode?: string;
};

export type DbMatterCluster = {
  clusterId: number;
  endpointId: number;
};

export type DbMatterClusters = {
  [key: number]: DbMatterCluster;
};

export type DbDevice = {
  id: string;
  matterNodeId: number;
  matterInfo: DbMatterDeviceInfo;
  matterClusters: DbMatterClusters;
};

export type LocalDb = {
  commissionedDevices: {
    [key: string]: DbDevice;
  };
  proxyConfig?: ProxyConfig;
};
