import { WotDevice } from "../thngs/wot-device.js";
import http from "http";
import { Servient } from "@node-wot/core";
import bindingHttp from "@node-wot/binding-http";
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
import { OmniaGatewayOptions } from "../models";

const WEB_SERVER_PORT = 3000;
const TD_DIRECTORY_URI = "";

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
                const nodeId = Math.floor(Math.random() * 255);
                delete requestBody.command;
                const pairingInfo = {
                  nodeId: nodeId,
                  ...requestBody,
                };
                await this.pairDevice(pairingInfo);
                this._localDb.storeCommissionedDevice(pairingInfo);

                // TODO: get device info and use it to create TM
                const thingModel = this.generateThingModel(nodeId);
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

    await this._matterController.start();

    this._icAgent.listen(WEB_SERVER_PORT, () => {
      console.log(`Server running on port ${WEB_SERVER_PORT}`);
    });

    this._wotServient.addServer(
      new bindingHttp.HttpServer({ port: this.wotServientPort }),
    );
    this._wotNamespace = await this._wotServient.start();

    const db = await this._localDb.start();
    for (const commissionedDevice of db["commissionedDevices"]) {
      const thingModel = this.generateThingModel(commissionedDevice.nodeId);
      this.exposeThing(thingModel, commissionedDevice.nodeId);
    }
  }

  private async pairDevice(pairingInfo): Promise<void> {
    console.log(pairingInfo);
    const deviceNodeId = new NodeId(BigInt(pairingInfo.nodeId));
    await this._matterController.pairDevice(
      deviceNodeId,
      pairingInfo.payload,
      ENV_VARIABLES.WIFI_SSID,
      ENV_VARIABLES.WIFI_PASSWORD,
    );

    // TODO: get device info e return it
  }

  private generateThingModel(nodeId): Record<string, unknown> {
    return {
      "@context": ["https://www.w3.org/2019/wot/td/v1", { "@language": "en" }],
      "@type": "",
      id: `new:${nodeId}`,
      title: `${nodeId}`,
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
    nodeId: NodeId,
  ): Promise<void> {
    const device = new WotDevice(
      this._wotNamespace,
      thingModel,
      this._matterController,
      nodeId,
      TD_DIRECTORY_URI,
    );
    await device.startDevice();
  }
}
