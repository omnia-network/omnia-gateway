import { WotDevice } from "../thngs/wot-device.js";
import http from "http";
import { Servient } from "@node-wot/core";
import bindingHttp from "@node-wot/binding-http";
import { v4 } from "uuid";
import { existsSync, mkdirSync } from "fs";
// import { omnia_backend } from "./canisters/omnia_backend/index.js";
import { MatterController } from "../matter-controller/controller.js";
import { ENV_VARIABLES } from "../constants/environment.js";
// import {
//   // IdentifyCluster,
//   OnOffCluster
// } from "@project-chip/matter.js";
// TODO: fix types for these imports
// import { ClusterId } from "@project-chip/matter.js/dist/cjs/common/ClusterId.js";
import { NodeId } from "@project-chip/matter.js/dist/cjs/common/NodeId.js";
// import { EndpointNumber } from "@project-chip/matter.js/dist/cjs/common/EndpointNumber.js";
import { Database } from "./local-db.js";
import { CHIPParsedResult, OmniaGatewayOptions } from "../models";

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

  constructor(options: OmniaGatewayOptions) {
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
                const nodeId = Math.floor(Math.random() * 255) + 1;
                delete requestBody.command;

                // the pairing info received by the backend
                // for now, we just fake it
                const pairingInfo = {
                  nodeId: nodeId,
                  ...requestBody,
                };
                const pairResult = await this.pairDevice(pairingInfo);

                // get device info from matter controller
                const deviceInfo = await this._matterController.getDeviceInfo(
                  new NodeId(BigInt(nodeId)),
                );

                // TODO: register device on backend and get device id
                // for now, we use a random uuid as device id
                const deviceId = v4();
                this._localDb.storeCommissionedDevice(deviceId, {
                  matterNodeId: nodeId,
                  matterData: {
                    ...deviceInfo,
                    pairingCode: requestBody.payload,
                    pairingResult: pairResult,
                  },
                });

                // TODO: get device info and use it to create TM
                const thingModel = this.generateThingModel(deviceId);
                this.exposeThing(thingModel, nodeId);

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

    // we must ensure that the data folder exists before starting sub services
    // because they need it to store their data
    this.initializeDataFolder();

    await this._matterController.start();

    this._icAgent.listen(WEB_SERVER_PORT, () => {
      console.log(`Server running on port ${WEB_SERVER_PORT}`);
    });

    this._wotServient.addServer(
      new bindingHttp.HttpServer({ port: this.wotServientPort }),
    );
    this._wotNamespace = await this._wotServient.start();

    const db = await this._localDb.start();
    for (const deviceId in db["commissionedDevices"]) {
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
          deviceInfo.productId !== localDeviceData.matterData.productId ||
          deviceInfo.vendorId !== localDeviceData.matterData.vendorId
        ) {
          throw new Error("Device is not the same");
        }

        // expose the device if all checks passed
        const thingModel = this.generateThingModel(deviceId);
        this.exposeThing(thingModel, localDeviceData.matterNodeId);
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

  private async pairDevice(pairingInfo): Promise<CHIPParsedResult> {
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

  private generateThingModel(deviceId: string): Record<string, unknown> {
    return {
      "@context": ["https://www.w3.org/2019/wot/td/v1", { "@language": "en" }],
      "@type": "",
      id: `urn:uuid:${deviceId}`,
      title: deviceId,
      description: "",
      securityDefinitions: {
        "": {
          scheme: "nosec",
        },
      },
      security: "",
      properties: {
        onoff: {
          title: "OnOff Matter Cluster Attributes",
          description: "Implementation of the OnOff Matter Cluster Attributes",
        },
      },
      actions: {
        onoff: {
          title: "OnOff Matter Cluster Commands",
          description: "Implementation of the OnOff Matter Cluster Commands",
        },
      },
    };
  }

  private async exposeThing(
    thingModel: Record<string, unknown>,
    nodeId: number,
  ): Promise<void> {
    const device = new WotDevice(
      this._wotNamespace,
      thingModel,
      this._matterController,
      new NodeId(BigInt(nodeId)),
      TD_DIRECTORY_URI,
    );
    await device.startDevice();
  }

  private initializeDataFolder(): void {
    if (!existsSync(DATA_FOLDER)) {
      mkdirSync(DATA_FOLDER);
    }
  }
}
