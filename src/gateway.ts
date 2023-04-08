// import { LightSensor } from "./thngs/light-sensor.js";
// import { MotionSensor } from "./thngs/motion-sensor.js";
// import { LightActuator } from "./thngs/light-actuator.js";
import { Servient } from "@node-wot/core";
import bindingHttp from "@node-wot/binding-http";
// import { omnia_backend } from "./canisters/omnia_backend/index.js";
import { MatterController } from "./matter-controller/controller.js";
import { ENV_VARIABLES } from "./constants/environment.js";
import {
  // IdentifyCluster,
  OnOffCluster
} from "@project-chip/matter.js";
// TODO: fix types for these imports
import { ClusterId } from "@project-chip/matter.js/dist/cjs/common/ClusterId.js";
import { NodeId } from "@project-chip/matter.js/dist/cjs/common/NodeId.js";
import { EndpointNumber } from "@project-chip/matter.js/dist/cjs/common/EndpointNumber.js";

const { HttpServer } = bindingHttp;

const httpServer = new HttpServer({ port: 8888 });
const servient = new Servient();

servient.addServer(httpServer);

// const TD_DIRECTORY_URI = "";    // can register generated TD to a TD directory

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment
// @ts-ignore
servient.start().then(async (WoT) => {
  // const lightSensor = new LightSensor(WoT, TD_DIRECTORY_URI);
  // await lightSensor.startDevice();

  // const motionSensor = new MotionSensor(WoT, TD_DIRECTORY_URI);
  // await motionSensor.startDevice();

  // const lightActuator = new LightActuator(WoT, TD_DIRECTORY_URI);
  // await lightActuator.startDevice();

  // // console.log(omnia_backend);
  // console.log(await omnia_backend.initGateway());

  const matterController = new MatterController(
    parseInt(ENV_VARIABLES.MATTER_CONTROLLER_CHIP_WS_PORT),
    ENV_VARIABLES.MATTER_CONTROLLER_CHIP_TOOL_PATH,
  );

  try {
    await matterController.start();
  
    const lightNodeId = new NodeId(BigInt(1));
    // const switchNodeId = new NodeId(BigInt(2));
  
    // await matterController.pairDevice(
    //   lightNodeId,
    //   "MT:Y.K9042C00KA0648G00",
    //   ENV_VARIABLES.WIFI_SSID,
    //   ENV_VARIABLES.WIFI_PASSWORD,
    // );

    // await matterController.pairDevice(
    //   switchNodeId,
    //   "MT:Y.K9042C00KA0648G00",
    //   ENV_VARIABLES.WIFI_SSID,
    //   ENV_VARIABLES.WIFI_PASSWORD,
    // );
  
    // await matterController.sendCommand(
    //   new ClusterId(IdentifyCluster.id),
    //   IdentifyCluster.commands.identify.requestId,
    //   {"0x0": "u:10"},
    //   deviceNodeId,
    //   new EndpointNumber(1),
    // );
  
    await matterController.sendCommand(
      new ClusterId(OnOffCluster.id),
      OnOffCluster.commands.toggle.requestId,
      {},
      lightNodeId,
      new EndpointNumber(1),
    );

    const attr = await matterController.readAttribute(
      new ClusterId(OnOffCluster.id),
      OnOffCluster.attributes.onOff,
      lightNodeId,
      new EndpointNumber(1),
    );

    console.log(attr);

    await matterController.sendCommand(
      new ClusterId(OnOffCluster.id),
      OnOffCluster.commands.toggle.requestId,
      {},
      lightNodeId,
      new EndpointNumber(1),
    );

    const attr2 = await matterController.readAttribute(
      new ClusterId(OnOffCluster.id),
      OnOffCluster.attributes.onOff,
      lightNodeId,
      new EndpointNumber(1),
    );

    console.log(attr2);
  
    // await matterController.unpairDevice(deviceNodeId);
  
    await matterController.stop();
  } catch (error) {
    console.error(error);
    await matterController.stop();
  }

});
