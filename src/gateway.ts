import { LightSensor } from "./thngs/light-sensor.js";
import { MotionSensor } from "./thngs/motion-sensor.js";
import { LightActuator } from "./thngs/light-actuator.js";
import { Servient } from "@node-wot/core";
import bindingHttp from "@node-wot/binding-http";
import { omnia_backend } from "./canisters/omnia_backend/index.js";

const { HttpServer } = bindingHttp;

const httpServer = new HttpServer({ port: 8888 });
const servient = new Servient();

servient.addServer(httpServer);

const TD_DIRECTORY_URI = "";    // can register generated TD to a TD directory

servient.start().then(async (WoT) => {
    const lightSensor = new LightSensor(WoT, TD_DIRECTORY_URI);
    await lightSensor.startDevice();

    const motionSensor = new MotionSensor(WoT, TD_DIRECTORY_URI);
    await motionSensor.startDevice();

    const lightActuator = new LightActuator(WoT, TD_DIRECTORY_URI);
    await lightActuator.startDevice();

    // console.log(omnia_backend);
    console.log(await omnia_backend.getProfile());
});