import { existsSync, mkdirSync } from "fs";
import bindingHttp from "@node-wot/binding-http";
import { Servient } from "@node-wot/core";
import { NodeId } from "@project-chip/matter.js/dist/cjs/common/NodeId.js";
import { omnia_backend } from "../canisters/omnia_backend/index.js";
import { ENV_VARIABLES } from "../constants/environment.js";
import { MatterController } from "../matter-controller/controller.js";
import { MatterWotDevice } from "../thngs/matter-wot-device.js";
import { getMappedCluster } from "../utils/matter-wot-mapping.js";
import { IcAgent } from "./ic-agent.js";
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

  //// WoT
  private _wotServient: Servient;
  private _wotNamespace: typeof WoT;
  readonly wotServientPort: number;

  //// local database
  private _localDb: Database;

  //// Matter Controller
  private _matterController: MatterController;

  constructor(options: OmniaGatewayOptions) {
    this._icAgent = new IcAgent(omnia_backend);

    this.wotServientPort = options.wotServientPort;
    this._wotServient = new Servient();

    this._localDb = new Database();

    this._matterController = new MatterController(
      options.matterControllerChipWsPort,
      options.matterControllerChipToolPath,
    );
  }

  async start(): Promise<void> {
    if (!this.wotServientPort) {
      throw new Error("WOT_SERVIENT_PORT not set");
    }

    await this._icAgent.start();

    // we must ensure that the data folder exists before starting sub services
    // because they need it to store their data
    this.initializeDataFolder();

    await this._matterController.start();

    this._wotServient.addServer(
      new bindingHttp.HttpServer({ port: this.wotServientPort }),
    );
    this._wotNamespace = await this._wotServient.start();

    const db = await this._localDb.start();
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

        // TODO: check if device is still registered in backend

        // expose the device if all checks passed
        this.exposeDevice(localDeviceData);
      } catch (err) {
        console.error(err);
        console.log(
          `Device ${deviceId} is not connected anymore, removing it from the database`,
        );
        await this._localDb.removeCommissionedDevice(deviceId);

        // TODO: we should also unpair the device from the controller in certain cases
      }
    }

    setInterval(async () => {
      const pairingInfo = await this._icAgent.pollForUpdates();
      if (pairingInfo !== undefined) {
        await this.pairDevice(pairingInfo);

        // get device info from matter controller
        const deviceInfo = await this._matterController.getDeviceInfo(
          new NodeId(BigInt(pairingInfo.nodeId)),
        );

        // get device clusters from matter controller
        const deviceClusters =
          await this._matterController.getDeviceAvailableClusters(
            new NodeId(BigInt(pairingInfo.nodeId)),
          );

        // register device on backend and get device id
        const deviceId = await this._icAgent.registerDevice();
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

  private generateThingModel(device: DbDevice): WoT.ExposedThingInit {
    const model = {
      "@context": ["https://www.w3.org/2019/wot/td/v1", { "@language": "en" }],
      "@type": "",
      id: `urn:uuid:${device.id}`,
      title: device.id,
      description: "",
      securityDefinitions: {
        "": {
          scheme: "nosec",
        },
      },
      security: "",
      properties: {},
      actions: {},
    };

    for (const clusterId in device.matterClusters) {
      const mappedCluster = getMappedCluster(clusterId);

      Object.assign(model.properties, mappedCluster.properties);
      Object.assign(model.actions, mappedCluster.actions);
    }

    return model;
  }

  private async exposeDevice(device: DbDevice): Promise<void> {
    const model = this.generateThingModel(device);

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
}
