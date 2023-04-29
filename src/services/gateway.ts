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
import {
  generateThingModel,
  getMatterClusterOntologies,
} from "../utils/matter-wot-mapping.js";
import { Database } from "./local-db.js";
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

  //// WoT
  private _wotServient: Servient;
  private _wotNamespace: typeof WoT;
  readonly wotServientPort: number;

  //// local database
  private _localDb: Database;

  //// Matter Controller
  private _matterController: MatterController;

  //// Proxy
  private _useProxy = false;
  private _proxyClient: ProxyClient;

  // TODO: add a logger instance for the OmniaGateway

  constructor(options: OmniaGatewayOptions) {
    // must come before other services are initialized
    this._localDb = new Database();

    if (options.useProxy) {
      this._useProxy = options.useProxy;

      this._proxyClient = new ProxyClient(
        ENV_VARIABLES.OMNIA_PROXY_URL,
        ENV_VARIABLES.OMNIA_PROXY_WG_ADDRESS,
        this._localDb,
      );
    }

    this.wotServientPort = options.wotServientPort;
    this._wotServient = new Servient();

    this._matterController = new MatterController(
      options.matterControllerChipWsPort,
      options.matterControllerChipToolPath,
    );

    this._icIdentity = new IcIdentity(options.icIndentitySeedPhrase);
  }

  async start(): Promise<void> {
    if (!this.wotServientPort) {
      throw new Error("WOT_SERVIENT_PORT not set");
    }

    // we must ensure that the data folder exists before starting sub services
    // because they need it to store their data
    this.initializeDataFolder();

    // must come before other services start
    const db = await this._localDb.start();

    if (this._useProxy) {
      await this._proxyClient.connect();
    }

    // get the IC identity
    const icIdentity = this._icIdentity.getIdentity();

    const customFetch = this._useProxy
      ? this._proxyClient.proxyFetch.bind(this._proxyClient)
      : fetch;

    // the IC agent must be instantiated after the proxy client, because it can use the proxy fetch
    const omnia_backend = createOmniaBackend({
      agentOptions: {
        host: ENV_VARIABLES.OMNIA_BACKEND_HOST_URL,
        fetch: customFetch,
        identity: icIdentity,
      },
    });
    this._icAgent = new IcAgent(omnia_backend, customFetch);
    await this._icAgent.start();

    await this._matterController.start();

    this._wotServient.addServer(
      new bindingHttp.HttpServer({
        address: "0.0.0.0",
        port: this.wotServientPort,
      }),
    );
    this._wotNamespace = await this._wotServient.start();

    // get registered devices in the backend
    const registeredDevices = await this._icAgent.actor.getRegisteredDevices();

    const registeredDevicesIds: string[] = [];

    if ("Ok" in registeredDevices) {
      registeredDevicesIds.push(...registeredDevices.Ok);
    } else if ("Err" in registeredDevices) {
      console.error(
        `Couldn't get registered devices: ${registeredDevices.Err}`,
      );
      // TODO: handle the error better, maybe retry or exit
    }

    for (const deviceId in db.commissionedDevices) {
      try {
        const localDeviceData = await this._localDb.getCommissionedDevice(
          deviceId,
        );

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
          throw new Error("Device is not the same");
        }

        // check if device is still registered in backend
        if (registeredDevicesIds.includes(deviceId)) {
          // expose the device if all checks passed
          this.exposeDevice(localDeviceData);
        } else {
          await this._localDb.removeCommissionedDevice(deviceId);
          // TODO: we should also unpair the device from the controller in certain cases
        }
      } catch (err) {
        console.error(err);
        console.log(
          `Device ${deviceId} is not connected anymore, removing it from the database`,
        );
        await this._localDb.removeCommissionedDevice(deviceId);

        // TODO: we should also unpair the device from the controller in certain cases
        // TODO: unregister device from backend, since we can't talk to it anymore
      }
    }

    // this should be triggered only if the connection to the backend is working,
    // otherwise we end up polling continuously without any result
    // TODO: to be moved to the IcAgent, passing a callback function from this instance for when an update is received
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

        // register device on backend and get device id
        // we use a set to avoid duplicates
        const affordances = new Set<string>();
        for (const cluster in deviceClusters) {
          getMatterClusterOntologies(cluster).forEach((ontology) =>
            affordances.add(ontology),
          );
        }

        console.log("Registering device with affordances:", affordances);

        const deviceId = await this._icAgent.registerDevice(
          Array.from(affordances),
        );
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

          this.exposeDevice(device);
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
    const model = generateThingModel(device.id, device.matterClusters);

    const wotDevice = new MatterWotDevice(
      this._wotNamespace,
      model,
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
  }
}
