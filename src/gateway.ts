import { WotDevice } from "./thngs/wot-device.js";
// import { MotionSensor } from "./thngs/motion-sensor.js";
// import { LightActuator } from "./thngs/light-actuator.js";
import http from "http";
import { Servient } from "@node-wot/core";
import bindingHttp from "@node-wot/binding-http";
// import { omnia_backend } from "./canisters/omnia_backend/index.js";
// import { MatterController } from "./matter-controller/controller.js";
// import { ENV_VARIABLES } from "./constants/environment.js";
// import {
//   // IdentifyCluster,
//   OnOffCluster
// } from "@project-chip/matter.js";
// TODO: fix types for these imports
// import { ClusterId } from "@project-chip/matter.js/dist/cjs/common/ClusterId.js";
import { NodeId } from "@project-chip/matter.js/dist/cjs/common/NodeId.js";
import { Database } from "./local_db.js";
// import { EndpointNumber } from "@project-chip/matter.js/dist/cjs/common/EndpointNumber.js";

const WEB_SERVER_PORT = 3000;
const WOT_SERVIENT_PORT = 8888;
const TD_DIRECTORY_URI = "";

export class OmniaGateway {
  private _icAgent: http.Server;
  private _wotServient: Servient;
  private _wotNamespace: typeof WoT;
  private _localDb: Database;
  // private _matterController: MatterController;

  constructor() {
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
                const thingModel = {
                  "@context": [
                    "https://www.w3.org/2019/wot/td/v1",
                    { "@language": "en" },
                  ],
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
                      description:
                        "Implementation of the OnOff Matter Cluster Attributes",
                    },
                  },
                  actions: {
                    onoff: {
                      title: "OnOff Matter Cluster Commands",
                      description:
                        "Implementation of the OnOff Matter Cluster Commands",
                    },
                  },
                };
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
    this._wotServient = new Servient();
    this._localDb = new Database();
    // this._matterController = new MatterController(
    //   parseInt(ENV_VARIABLES.MATTER_CONTROLLER_CHIP_WS_PORT),
    //   ENV_VARIABLES.MATTER_CONTROLLER_CHIP_TOOL_PATH,
    // );
  }

  async start() {
    // await this._matterController.start();

    this._icAgent.listen(WEB_SERVER_PORT, () => {
      console.log(`Server running on port ${WEB_SERVER_PORT}`);
    });

    this._wotServient.addServer(
      new bindingHttp.HttpServer({ port: WOT_SERVIENT_PORT }),
    );
    this._wotNamespace = await this._wotServient.start();
    this._localDb.start();
  }

  private async pairDevice(pairingInfo) {
    console.log(pairingInfo);
    // const deviceNodeId = new NodeId(BigInt(pairingInfo.nodeId));
    // await this._matterController.pairDevice(
    //   deviceNodeId,
    //   pairingInfo.payload,
    //   ENV_VARIABLES.WIFI_SSID,
    //   ENV_VARIABLES.WIFI_PASSWORD,
    // );

    // TODO: get device info e return it
  }

  private async exposeThing(thingModel, _nodeId: NodeId) {
    const device = new WotDevice(
      this._wotNamespace,
      thingModel,
      // this._matterController,
      // nodeId,
      TD_DIRECTORY_URI,
    );
    await device.startDevice();
  }
}

// // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment
// // @ts-ignore
// // console.log(omnia_backend);
// console.log(await omnia_backend.initGateway());

// try {
//   // await matterController.sendCommand(
//   //   new ClusterId(IdentifyCluster.id),
//   //   IdentifyCluster.commands.identify.requestId,
//   //   {"0x0": "u:10"},
//   //   deviceNodeId,
//   //   new EndpointNumber(1),
//   // );

//   await matterController.sendCommand(
//     new ClusterId(OnOffCluster.id),
//     OnOffCluster.commands.on.requestId,
//     {},
//     deviceNodeId,
//     new EndpointNumber(1),
//   );

//   await matterController.unpairDevice(deviceNodeId);

//   await matterController.stop();
// } catch (error) {
//   console.error(error);
//   await matterController.stop();
// }
// });
