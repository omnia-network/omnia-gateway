// import { LightSensor } from "./thngs/light-sensor.js";
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
// import { EndpointNumber } from "@project-chip/matter.js/dist/cjs/common/EndpointNumber.js";

const WEB_SERVER_PORT = 3000;
const WOT_SERVIENT_PORT = 8888;

// const TD_DIRECTORY_URI = "";    // can register generated TD to a TD directory

export class OmniaGateway {
  private _icAgent: http.Server;
  private _wotServient: Servient;
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

        req.on("end", () => {
          try {
            const requestBody = JSON.parse(body);
            switch (requestBody.command) {
              case "pair": {
                const deviceNodeId = new NodeId(BigInt(1));
                delete requestBody.command;
                const pairingInfo = {
                  nodeId: deviceNodeId,
                  ...requestBody,
                };
                this.pairDevice(pairingInfo);

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
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.write("Invalid body");
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
    // this._matterController = new MatterController(
    //   parseInt(ENV_VARIABLES.MATTER_CONTROLLER_CHIP_WS_PORT),
    //   ENV_VARIABLES.MATTER_CONTROLLER_CHIP_TOOL_PATH,
    // );
  }

  async start() {
    this._icAgent.listen(WEB_SERVER_PORT, () => {
      console.log(`Server running on port ${WEB_SERVER_PORT}`);
    });

    this._wotServient.addServer(
      new bindingHttp.HttpServer({ port: WOT_SERVIENT_PORT }),
    );

    // await this._matterController.start();
  }

  private async pairDevice(pairingInfo) {
    console.log(pairingInfo);
    // await this._matterController.pairDevice(
    //   pairingInfo.nodeId,
    //   pairingInfo.payload,
    //   ENV_VARIABLES.WIFI_SSID,
    //   ENV_VARIABLES.WIFI_PASSWORD,
    // );
  }
}

// // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment
// // @ts-ignore
// servient.start().then(async (WoT) => {
// const lightSensor = new LightSensor(WoT, TD_DIRECTORY_URI);
// await lightSensor.startDevice();

// const motionSensor = new MotionSensor(WoT, TD_DIRECTORY_URI);
// await motionSensor.startDevice();

// const lightActuator = new LightActuator(WoT, TD_DIRECTORY_URI);
// await lightActuator.startDevice();

// // console.log(omnia_backend);
// console.log(await omnia_backend.initGateway());

// try {
//   const deviceNodeId = new NodeId(BigInt(1));

//   await matterController.pairDevice(
//     deviceNodeId,
//     "MT:Y.K9042C00KA0648G00",
//     ENV_VARIABLES.WIFI_SSID,
//     ENV_VARIABLES.WIFI_PASSWORD,
//   );

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
