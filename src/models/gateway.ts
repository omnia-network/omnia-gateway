import bindingHttp from "@node-wot/binding-http";

export type OmniaGatewayOptions = {
  wotHttpServerConfig: bindingHttp.HttpConfig;

  matterControllerChipWsPort: number;
  matterControllerChipToolPath: string;
  disableMatterController?: boolean;

  useProxy?: boolean;

  icIndentitySeedPhrase?: string;

  /**
   * If true, the gateway will not try to connect to the IC.
   * @default false
   */
  standaloneMode?: boolean;

  /**
   * If true, the gateway will expose a simple HTTP device that can be used for testing.
   * @see SimpleWoTDevice for more details.
   */
  exposeSimpleDevice?: boolean;
};
