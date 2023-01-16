//Where your concrete implementation is included
import { WotDevice } from "./thng.js";

/*
This project supports the registration of the generated TD to a TD directory
Fill in the directory URI where the HTTP POST request to send the TD will be made
If you leave it empty, registration thread will never execute, otherwise it will try to register every 10 seconds 
*/
const TD_DIRECTORY = "";

import { Servient } from "@node-wot/core";
//Importing the required bindings
import bindingHttp from "@node-wot/binding-http";
const { HttpServer } = bindingHttp;
//CoapServer = require("@node-wot/binding-coap").CoapServer
//MqttBrokerServer = require("@node-wot/binding-mqtt").MqttBrokerServer

//Creating the instances of the binding servers
const httpServer = new HttpServer({ port: 8080 });
//const coapServer = new CoapServer({port: 5683});
//const mqttServer = new MqttBrokerServer("test.mosquitto.org"); //change it according to the broker address

//Building the servient object
const servient = new Servient();
//Adding different bindings to the server
servient.addServer(httpServer);
//servient.addServer(coapServer);
//servient.addServer(mqttServer);

servient.start().then(async (WoT) => {
    const wotDevice = new WotDevice(WoT, TD_DIRECTORY); // you can change the wotDevice to something that makes more sense
    await wotDevice.startDevice();
});