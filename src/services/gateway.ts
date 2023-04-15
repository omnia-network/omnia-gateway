import { existsSync, mkdirSync } from "fs";
import http from "http";
import bindingHttp from "@node-wot/binding-http";
import { Servient } from "@node-wot/core";
import { NodeId } from "@project-chip/matter.js/dist/cjs/common/NodeId.js";
import { v4 } from "uuid";
import { ENV_VARIABLES } from "../constants/environment.js";
import { MatterController } from "../matter-controller/controller.js";
import { ProxyClient } from "../proxy/proxy-client.js";
import { MatterWotDevice } from "../thngs/matter-wot-device.js";
import { getMappedCluster } from "../utils/matter-wot-mapping.js";
import { Database } from "./local-db.js";
import type {
  CHIPParsedResult,
  DbDevice,
  OmniaGatewayOptions,
} from "../models";

const WEB_SERVER_PORT = 3000;
const TD_DIRECTORY_URI = "";

const DATA_FOLDER = `${process.cwd()}/data`;

export class OmniaGateway {
  //// IC Agent
  private _icAgent: http.Server;

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

    this._icAgent = http.createServer((req, res) => {
      if (
        req.method === "POST" &&
        req.headers["content-type"] === "application/json"
      ) {
        let body = "";

        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const requestBody = JSON.parse(body);
            switch (requestBody.command) {
              case "pair": {
                // think about how to generate nodeId, randomness could work instead of handling incremental values
                const nodeId = Math.floor(Math.random() * 65525) + 1;
                delete requestBody.command;

                // the pairing info received by the backend
                // for now, we just fake it
                const pairingInfo = {
                  nodeId: nodeId,
                  ...requestBody,
                };
                await this.pairDevice(pairingInfo);

                // get device info from matter controller
                const deviceInfo = await this._matterController.getDeviceInfo(
                  new NodeId(BigInt(nodeId)),
                );

                // get device clusters from matter controller
                const deviceClusters =
                  await this._matterController.getDeviceAvailableClusters(
                    new NodeId(BigInt(nodeId)),
                  );

                // TODO: register device on backend and get device id
                // for now, we use a random uuid as device id
                const deviceId = v4();
                const device = await this._localDb.storeCommissionedDevice(
                  deviceId,
                  {
                    id: deviceId,
                    matterNodeId: nodeId,
                    matterInfo: {
                      ...deviceInfo,
                      pairingCode: requestBody.payload,
                    },
                    matterClusters: deviceClusters,
                  },
                );

                this.exposeDevice(device);

                res.writeHead(200, { "Content-Type": "text/plain" });
                res.write("Device paired");
                res.end();
                break;
              }
              default: {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.write("Invalid command");
                res.end();
              }
            }
          } catch (err) {
            console.error(err);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.write("Internal error");
            res.end();
          }
        });
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.write("Invalid request");
        res.end();
      }
    });

    this.wotServientPort = options.wotServientPort;
    this._wotServient = new Servient();

    this._matterController = new MatterController(
      options.matterControllerChipWsPort,
      options.matterControllerChipToolPath,
    );
  }

  async start(): Promise<void> {
    if (!this.wotServientPort) {
      throw new Error("WOT_SERVIENT_PORT not set");
    }

    // must come before other services start
    const db = await this._localDb.start();

    if (this._useProxy) {
      await this._proxyClient.connect();
    }

    // we must ensure that the data folder exists before starting sub services
    // because they need it to store their data
    this.initializeDataFolder();

    await this._matterController.start();

    this._icAgent.listen(WEB_SERVER_PORT, () => {
      console.log(`Server running on port ${WEB_SERVER_PORT}`);
    });

    this._wotServient.addServer(
      new bindingHttp.HttpServer({
        address: "0.0.0.0",
        port: this.wotServientPort,
      }),
    );
    this._wotNamespace = await this._wotServient.start();

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

  async stop(): Promise<void> {
    this._matterController.stop();
    await this._wotServient.shutdown();

    if (this._useProxy) {
      await this._proxyClient.disconnect();
    }
  }
}
