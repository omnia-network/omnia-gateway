import { existsSync, mkdirSync } from "fs";
import bindingHttp from "@node-wot/binding-http";
import { Servient } from "@node-wot/core";
import { NodeId } from "@project-chip/matter.js/dist/cjs/common/NodeId.js";
import fetch from "node-fetch";
import * as WoT from "wot-typescript-definitions";
import { createOmniaBackend } from "../canisters/omnia_backend/index.js";
import { ENV_VARIABLES } from "../constants/environment.js";
import { IcAgent } from "../ic-agent/agent.js";
import { IcIdentity } from "../ic-agent/identity.js";
import { MatterController } from "../matter-controller/controller.js";
import { ProxyClient } from "../proxy/proxy-client.js";
import { MatterWotDevice } from "../thngs/matter-wot-device.js";
import { SimpleWoTDevice } from "../thngs/simple-wot-device.js";
import {
  generateThingDescription,
  getMatterClusterAffordances,
} from "../utils/matter-wot-mapping.js";
import {
  BaseAccessKeysMiddleware,
  IcAccessKeysMiddleware,
} from "./access-keys-middleware.js";
import { Database } from "./local-db.js";
import { getLogger } from "./logger.js";
import type {
  CHIPParsedResult,
  DbDevice,
  OmniaGatewayOptions,
} from "../models";

const TD_DIRECTORY_URI = "";

const DATA_FOLDER = `${process.cwd()}/data`;

export class OmniaGateway {
  //// IC Agent
  private _icAgent: IcAgent;
  private _icIdentity: IcIdentity;

  //// Access Keys
  private _accessKeysMiddleware: BaseAccessKeysMiddleware;

  //// WoT
  private _wotServient: Servient;
  private _wotNamespace: typeof WoT;
  readonly wotHttpServerConfig: bindingHttp.HttpConfig;
  readonly exposeSimpleWoTDevice: boolean;

  //// local database
  private _localDb: Database;

  //// Matter Controller
  private _matterController: MatterController;
  private _disableMatterController = false;

  //// Proxy
  private _useProxy = false;
  private _proxyClient: ProxyClient;

  //// Configuration
  private _standaloneMode = false;

  private logger = getLogger("OmniaGateway");

  constructor(options: OmniaGatewayOptions) {
    // must be initialized before other services start
    this._localDb = new Database();

    this._useProxy = options.useProxy ?? false;
    if (this._useProxy) {
      this._proxyClient = new ProxyClient(
        ENV_VARIABLES.OMNIA_PROXY_URL,
        ENV_VARIABLES.OMNIA_PROXY_WG_ADDRESS,
        this._localDb,
      );
    }

    this.wotHttpServerConfig = options.wotHttpServerConfig;
    this._wotServient = new Servient();

    this._disableMatterController = options.disableMatterController ?? false;
    if (!this._disableMatterController) {
      this._matterController = new MatterController(
        options.matterControllerChipWsPort,
        options.matterControllerChipToolPath,
      );
    }

    this._standaloneMode = options.standaloneMode ?? false;
    this.exposeSimpleWoTDevice = options.exposeSimpleDevice ?? false;

    // initialize the IC related properties only if we are not in standalone mode
    if (!this._standaloneMode) {
      this._icIdentity = new IcIdentity(options.icIndentitySeedPhrase);
    }
  }

  async start(): Promise<void> {
    // we must ensure that the data folder exists before starting sub services
    // because they need it to store their data
    this.initializeDataFolder();

    // must come before other services start
    const db = await this._localDb.start();

    if (this._useProxy) {
      await this._proxyClient.connect();
      // set the base uri for the TDs to be the proxy url
      this.wotHttpServerConfig.baseUri = this._proxyClient.proxyUrl;
    }

    if (!this._standaloneMode) {
      // get the IC identity
      const icIdentity = this._icIdentity.getIdentity();

      const customFetch = this._useProxy
        ? this._proxyClient.proxyFetch.bind(this._proxyClient)
        : fetch;

      // the IC agent must be instantiated after the proxy client, because it uses the fetch from proxy client if proxy is enabled
      const omnia_backend = createOmniaBackend({
        agentOptions: {
          host:
            ENV_VARIABLES.DFX_NETWORK === "ic"
              ? "https://icp0.io"
              : ENV_VARIABLES.OMNIA_BACKEND_HOST_URL,
          fetch: customFetch,
          identity: icIdentity,
        },
      });
      this._icAgent = new IcAgent(omnia_backend, customFetch);
      await this._icAgent.start();

      this._accessKeysMiddleware = new IcAccessKeysMiddleware({
        icAgent: this._icAgent,
        localDb: this._localDb,
      });
    }

    if (!this._disableMatterController) {
      await this._matterController.start();
    }

    // initialize the WoT middleware only if there is an access key middleware
    if (this._accessKeysMiddleware) {
      await this._accessKeysMiddleware.init();
      this.wotHttpServerConfig.middleware = new bindingHttp.HttpMiddleware(
        this._accessKeysMiddleware.handler.bind(this._accessKeysMiddleware),
      );
    }

    // create the WoT server
    const httpServer = new bindingHttp.HttpServer(this.wotHttpServerConfig);

    this._wotServient.addServer(httpServer);
    this._wotNamespace = await this._wotServient.start();

    let registeredDevicesIds: string[] | null = null;

    if (!this._standaloneMode) {
      // get registered devices in the backend
      const registeredDevices =
        await this._icAgent.actor.getRegisteredDevices();

      registeredDevicesIds = [];

      if ("Ok" in registeredDevices) {
        registeredDevicesIds.push(...registeredDevices.Ok);
      } else if ("Err" in registeredDevices) {
        this.logger.error(
          `Couldn't get registered devices: ${registeredDevices.Err}`,
        );
        // TODO: handle the error better, maybe retry or exit
      }
    }

    for (const deviceId in db.commissionedDevices) {
      try {
        const localDeviceData = await this._localDb.getCommissionedDevice(
          deviceId,
        );

        if (!this._disableMatterController) {
          // this should throw an error if the device is not connected or paired anymore
          const deviceInfo = await this._matterController.getDeviceInfo(
            new NodeId(BigInt(localDeviceData.matterNodeId)),
          );

          // just check if we're talking to the same device
          if (
            deviceInfo.productId !== localDeviceData.matterInfo.productId ||
            deviceInfo.vendorId !== localDeviceData.matterInfo.vendorId
          ) {
            // should never happen
            throw new Error("Matter device is not the same");
          }
        }

        if (!this._standaloneMode) {
          // check if device is still registered in backend, otherwise remove it from the local database
          if (!registeredDevicesIds?.includes(deviceId)) {
            await this._localDb.removeCommissionedDevice(deviceId);
            // TODO: we should also unpair the device from the controller in certain cases

            continue;
          }
        }

        // expose the device if all checks passed
        await this.exposeDevice(localDeviceData);
      } catch (err) {
        this.logger.error(`Error while exposing device ${deviceId}: ${err}`);
        this.logger.warn(
          `Device ${deviceId} is not connected anymore, removing it from the database`,
        );
        await this._localDb.removeCommissionedDevice(deviceId);

        // TODO: we should also unpair the device from the controller in certain cases
        // TODO: unregister device from backend, since we can't talk to it anymore
      }
    }

    if (!this._standaloneMode) {
      // start polling for updates
      this.startPollingForUpdates();
    }

    if (this.exposeSimpleWoTDevice) {
      await this.exposeSimpleDevice();
    }

    this.logger.info("Omnia Gateway started");
  }

  /**
   * Polling should be started only if the connection to the backend is working,
   * otherwise we end up polling continuously without any result
   * TODO: to be moved to the IcAgent, passing a callback function from this instance for when an update is received
   */
  private startPollingForUpdates() {
    setInterval(async () => {
      const pairingInfo = await this._icAgent.pollForUpdates();
      if (pairingInfo !== undefined) {
        await this.pairDevice(pairingInfo);

        const deviceNodeId = new NodeId(BigInt(pairingInfo.nodeId));

        // get device info from matter controller
        const deviceInfo = await this._matterController.getDeviceInfo(
          deviceNodeId,
        );

        // get device clusters from matter controller
        const deviceClusters =
          await this._matterController.getDeviceAvailableClusters(deviceNodeId);

        // we use sets to avoid duplicates
        const affordances = {
          properties: new Set<string>(),
          actions: new Set<string>(),
        };
        for (const cluster in deviceClusters) {
          const clusterAffordances = getMatterClusterAffordances(cluster);
          clusterAffordances.properties.forEach((property) =>
            affordances.properties.add(property),
          );
          clusterAffordances.actions.forEach((action) =>
            affordances.actions.add(action),
          );
        }

        this.logger.info("Registering device with affordances:", affordances);

        // register device on backend and get device id
        const deviceId = await this._icAgent.registerDevice({
          properties: Array.from(affordances.properties),
          actions: Array.from(affordances.actions),
        });
        if (deviceId) {
          const device = await this._localDb.storeCommissionedDevice(deviceId, {
            id: deviceId,
            matterNodeId: pairingInfo.nodeId,
            matterInfo: {
              ...deviceInfo,
              pairingCode: pairingInfo.payload,
            },
            matterClusters: deviceClusters,
          });

          await this.exposeDevice(device);
        }
      }
    }, 5000);
  }

  private async pairDevice(pairingInfo: {
    nodeId: number;
    payload: string;
  }): Promise<CHIPParsedResult> {
    const deviceNodeId = new NodeId(BigInt(pairingInfo.nodeId));

    const pairDeviceResult = await this._matterController.pairDevice(
      deviceNodeId,
      pairingInfo.payload,
      ENV_VARIABLES.WIFI_SSID,
      ENV_VARIABLES.WIFI_PASSWORD,
    );

    // TODO: get device info e return it

    return pairDeviceResult;
  }

  private async exposeDevice(device: DbDevice): Promise<void> {
    const td = generateThingDescription(device.id, device.matterClusters);

    const wotDevice = new MatterWotDevice(
      this._wotNamespace,
      td,
      this._matterController,
      device,
      TD_DIRECTORY_URI,
    );
    await wotDevice.startDevice();
  }

  private initializeDataFolder(): void {
    if (!existsSync(DATA_FOLDER)) {
      mkdirSync(DATA_FOLDER);
    }
  }

  async stop(): Promise<void> {
    this._matterController.stop();
    await this._wotServient.shutdown();

    if (this._useProxy) {
      await this._proxyClient.disconnect();
    }

    if (this._accessKeysMiddleware && this._accessKeysMiddleware.stop) {
      this._accessKeysMiddleware.stop();
    }
  }

  private async exposeSimpleDevice() {
    const httpWotDevice = new SimpleWoTDevice(this._wotNamespace);

    await httpWotDevice.startDevice();
  }
}
