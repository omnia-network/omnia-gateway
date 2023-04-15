export type RegisterToVpnRequest = {
  public_key: string;
};

export type RegisterToVpnResponse = {
  server_public_key: string;
  assigned_ip: string;
  assigned_id: string;
  proxy_address: string;
};

export type PeerInfoResponse = {
  id: string;
  internal_ip: string;
  public_ip: string;
  public_key: string;
  proxy_address: string;
};

export type ProxyConfig = {
  proxyAddress: string;
  assignedProxyId: string;
};
