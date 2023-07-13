import clusters from "../../matter/clusters.json";
import type { Device } from "@omnia-gateway/core";

// TODO: improve nested types

export type MatterClusterCommandArgument = {
  _attributes?: Record<string, string>;
  _text?: string;
};

export type MatterClusterElement = {
  _attributes?: Record<string, string>;
  _text?: string;
  description?: {
    _text: string;
  };
  access?: {
    _attributes?: Record<string, string>;
    _text?: string;
  };
  arg?: MatterClusterCommandArgument | Array<MatterClusterCommandArgument>;
};

export type MatterCluster = {
  name: {
    _text: string;
  };
  domain: {
    _text: string;
  };
  code: {
    _text: string;
  };
  define: {
    _text: string;
  };
  description?: {
    _text: string;
  };
  server?: {
    _attributes?: Record<string, string>;
    _text?: string;
  };
  client?: {
    _attributes?: Record<string, string>;
    _text?: string;
  };
  globalAttribute: {
    _attributes: Record<string, string>;
  };
  attribute?: MatterClusterElement | Array<MatterClusterElement>;
  command?: MatterClusterElement | Array<MatterClusterElement>;
};
export type MatterClusterId = keyof typeof clusters;
export type MatterAvailableClusters = {
  [key in MatterClusterId]: MatterCluster;
};

export type DbMatterDeviceInfo = {
  vendorId: number;
  productId: number;

  // TODO: make it required, which means we need to change the way we initialize this object
  pairingCode?: string;
};

export type MatterNodeId = number;

export type DbMatterCluster = {
  clusterId: number;
  endpointId: number;
};

export type DbMatterClusters = {
  [key: number]: DbMatterCluster;
};

export type MatterDevice = Device & {
  matterNodeId: MatterNodeId;
  matterInfo: DbMatterDeviceInfo;
  matterClusters: DbMatterClusters;
};
