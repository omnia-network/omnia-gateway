// import { LightSensor } from "./thngs/light-sensor.js";
// import { MotionSensor } from "./thngs/motion-sensor.js";
// import { LightActuator } from "./thngs/light-actuator.js";
import { Servient } from "@node-wot/core";
import bindingHttp from "@node-wot/binding-http";
// import { omnia_backend } from "./canisters/omnia_backend/index.js";
import { MatterController } from "./matter-controller/controller.js";
import { ENV_VARIABLES } from "./constants/environment.js";
import { OnOffCluster } from "@project-chip/matter.js";
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

  await matterController.start();

  await matterController.sendCommand(
    new ClusterId(OnOffCluster.id),
    OnOffCluster.commands.on.requestId,
    "{}",
    new NodeId(BigInt(1)),
    new EndpointNumber(1),
  );

  await matterController.stop();
});
