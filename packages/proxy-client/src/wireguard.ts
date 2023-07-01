export const getWgConfig = (
  serverPublicKey: string,
  serverAddress: string,
  assignedIp: string,
  privateKey: string,
) => {
  return `[Interface]
PrivateKey = ${privateKey}
Address = ${assignedIp}/32
ListenPort = 51820

[Peer]
PublicKey = ${serverPublicKey}
AllowedIPs = 0.0.0.0/0
Endpoint = ${serverAddress}
PersistentKeepalive = 25`;
};
