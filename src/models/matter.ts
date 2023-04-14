import clusters from "../../matter/clusters.json";

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
