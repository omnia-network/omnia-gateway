export type OmniaGatewayOptions = {
  wotServientPort: number;
  matterControllerChipWsPort: number;
  matterControllerChipToolPath: string;

  useProxy?: boolean;

  icIndentitySeedPhrase?: string;
};
