import bindingHttp from "@node-wot/binding-http";
import { BaseGateway, ENV_VARIABLES } from "@omnia-gateway/core";
import { IcAccessKeysMiddleware, IcAgent } from "@omnia-gateway/ic";
import { ProxyClient } from "@omnia-gateway/proxy-client";
import { NodeId } from "@project-chip/matter.js/dist/cjs/common/NodeId.js";
import fetch from "node-fetch";
import { MatterController } from "./matter-controller/controller.js";
import { MatterWotDevice } from "./thngs/matter-wot-device.js";
import { SimpleWoTDevice } from "./thngs/simple-wot-device.js";
import {
  generateThingDescription,
  getMatterClusterAffordances,
} from "./utils/matter-wot-mapping.js";
import type { CHIPParsedResult, MatterDevice } from "./models/index.js";
import type { BaseGatewayOptions } from "@omnia-gateway/core";
import type { IcUpdate } from "@omnia-gateway/ic";

export type OmniaGatewayOptions = BaseGatewayOptions & {
  matterControllerChipWsPort: number;
  matterControllerChipToolPath: string;
  disableMatterController?: boolean;

  useProxy?: boolean;

  icIndentitySeedPhrase?: string;

  /**
   * If true, the gateway will expose a simple HTTP device that can be used for testing.
   * @see SimpleWoTDevice for more details.
   */
  exposeSimpleDevice?: boolean;
};

export class OmniaGateway extends BaseGateway<MatterDevice> {
  //// IC Agent
  private _icAgent: IcAgent;

  //// Access Keys
  private _accessKeysMiddleware: IcAccessKeysMiddleware;

  //// Matter Controller
  private _matterController: MatterController;
  private _disableMatterController = false;

  //// Proxy
  private _useProxy = false;
  private _proxyClient: ProxyClient;

  readonly exposeSimpleWoTDevice: boolean;

  constructor(options: OmniaGatewayOptions) {
    super({
      wotHttpServerConfig: options.wotHttpServerConfig,
      standaloneMode: options.standaloneMode,
    });

    let customFetch = fetch;

    // proxy must be initialized before other services start
    this._useProxy = options.useProxy ?? false;
    if (this._useProxy) {
      this._proxyClient = new ProxyClient(
        ENV_VARIABLES.OMNIA_PROXY_URL,
        ENV_VARIABLES.OMNIA_PROXY_WG_ADDRESS,
      );

      customFetch = this._proxyClient.proxyFetch.bind(this._proxyClient);
    }

    this._disableMatterController = options.disableMatterController ?? false;
    if (!this._disableMatterController) {
      this._matterController = new MatterController(
        options.matterControllerChipWsPort,
        options.matterControllerChipToolPath,
      );
    }

    // initialize the IC related properties only if we are not in standalone mode
    if (!this.standaloneMode) {
      this._icAgent = new IcAgent(customFetch);

      this._accessKeysMiddleware = new IcAccessKeysMiddleware({
        icAgent: this._icAgent,
      });
    }

    this.exposeSimpleWoTDevice = options.exposeSimpleDevice ?? false;
  }

  async start(): Promise<void> {
    if (this._useProxy) {
      await this._proxyClient.connect();
      // set the base uri for the TDs to be the proxy url
      this.wotHttpServerConfig.baseUri = this._proxyClient.proxyUrl;
    }

    if (!this.standaloneMode) {
      await this._icAgent.start();
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

    // start the base gateway
    await super.start();

    let registeredDevicesIds: string[] | null = null;

    if (!this.standaloneMode) {
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

    for (const deviceId in this.devicesStore.data) {
      try {
        const localDeviceData = this.devicesStore.data[deviceId];

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

        if (!this.standaloneMode) {
          // check if device is still registered in backend, otherwise remove it from the local database
          if (!registeredDevicesIds?.includes(deviceId)) {
            delete this.devicesStore.data[deviceId];
            await this.devicesStore.save();
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
        delete this.devicesStore.data[deviceId];
        await this.devicesStore.save();

        // TODO: we should also unpair the device from the controller in certain cases
        // TODO: unregister device from backend, since we can't talk to it anymore
      }
    }

    if (this._icAgent) {
      // start polling for updates
      this._icAgent.updates.on("update", this.icUpdatesHandler.bind(this));
      this._icAgent.pollForUpdates();
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
  private async icUpdatesHandler(payload: IcUpdate) {
    const pairingInfo = {
      nodeId: Math.floor(Math.random() * 65525) + 1,
      payload: payload.info.payload,
    };

    await this.pairDevice(pairingInfo);

    const deviceNodeId = new NodeId(BigInt(pairingInfo.nodeId));

    // get device info from matter controller
    const deviceInfo = await this._matterController.getDeviceInfo(deviceNodeId);

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
      const device: MatterDevice = {
        id: deviceId,
        matterNodeId: pairingInfo.nodeId,
        matterInfo: {
          ...deviceInfo,
          pairingCode: pairingInfo.payload,
        },
        matterClusters: deviceClusters,
      };

      this.devicesStore.data[deviceId] = device;
      await this.devicesStore.save();

      await this.exposeDevice(device);
    }
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

  private async exposeDevice(device: MatterDevice): Promise<void> {
    const td = generateThingDescription(device.id, device.matterClusters);

    const wotDevice = new MatterWotDevice(
      this.wotNamespace,
      td,
      this._matterController,
      device,
      this.tdDirectoryUri,
    );
    await wotDevice.startDevice();
  }

  async stop(): Promise<void> {
    this._matterController.stop();

    if (this._useProxy) {
      await this._proxyClient.disconnect();
    }

    if (this._accessKeysMiddleware && this._accessKeysMiddleware.stop) {
      this._accessKeysMiddleware.stop();
    }

    if (this._icAgent) {
      this._icAgent.stop();
    }

    this.logger.info("Omnia Gateway stopped");

    await super.stop();
  }

  private async exposeSimpleDevice() {
    const httpWotDevice = new SimpleWoTDevice(this.wotNamespace);

    await httpWotDevice.startDevice();
  }
}
