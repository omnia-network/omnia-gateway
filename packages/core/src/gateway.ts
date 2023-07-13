import { existsSync, mkdirSync } from "fs";
import bindingHttp from "@node-wot/binding-http";
import { Servient } from "@node-wot/core";
import { Store } from "./local-db.js";
import { getLogger } from "./logger.js";

const TD_DIRECTORY_URI = "";

const DATA_FOLDER = `${process.cwd()}/data`;

export type Device = {
  id: string;
};

type DevicesStore<T> = {
  [key: string]: T;
};

export type BaseGatewayOptions = {
  wotHttpServerConfig: bindingHttp.HttpConfig;

  /**
   * If true, the gateway will not try to connect to the IC.
   * @default false
   */
  standaloneMode?: boolean;
};

export class BaseGateway<DeviceType extends Device> {
  //// Local db
  protected devicesStore: Store<DevicesStore<DeviceType>>;

  //// WoT
  protected wotServient: Servient;
  protected wotNamespace: typeof WoT;
  readonly tdDirectoryUri = TD_DIRECTORY_URI;
  readonly wotHttpServerConfig: bindingHttp.HttpConfig;

  //// Configuration
  readonly standaloneMode: boolean = false;

  protected logger = getLogger("OmniaGateway");

  constructor(options: BaseGatewayOptions) {
    // we must ensure that the data folder exists before starting sub services
    // because they need it to store their data
    this.initializeDataFolder();

    this.wotHttpServerConfig = options.wotHttpServerConfig;
    this.wotServient = new Servient();

    this.standaloneMode = options.standaloneMode ?? false;
  }

  async start(): Promise<void> {
    // initialize the local db
    this.devicesStore = await Store.create<DevicesStore<DeviceType>>("devices");

    // create the WoT server
    const httpServer = new bindingHttp.HttpServer(this.wotHttpServerConfig);

    this.wotServient.addServer(httpServer);
    this.wotNamespace = await this.wotServient.start();

    this.logger.info("Base Gateway started");
  }

  private initializeDataFolder(): void {
    if (!existsSync(DATA_FOLDER)) {
      mkdirSync(DATA_FOLDER);
    }
  }

  async stop(): Promise<void> {
    await this.wotServient.shutdown();

    this.logger.info("Base Gateway stopped");
  }
}
