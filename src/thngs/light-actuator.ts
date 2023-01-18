import * as WoT from "wot-typescript-definitions";
import fetch from "node-fetch";
import Ajv from "ajv";

const ajv = new Ajv();

export class LightActuator {
    public thing: WoT.ExposedThing;
    public deviceWoT: typeof WoT;
    public td: WoT.ExposedThingInit;

    private thingModel: WoT.ExposedThingInit = {
        "@context": ["https://www.w3.org/2019/wot/td/v1", { "@language": "en" }],
        "@type": "",
        id: "new:light-actuator",
        title: "light-actuator",
        description: "",
        securityDefinitions: {
            "": {
                scheme: "nosec",
            },
        },
        security: "",
        actions: {
            lightState: {
                title: "Set light state",
                description: "Set state of light actuator",
                input: {
                    unit: "",
                    type: "boolean",
                }
            },
        }
    };

    private tdDirectory: string;

    constructor(deviceWoT: typeof WoT, tdDirectory?: string) {
        this.deviceWoT = deviceWoT;
        if (tdDirectory) this.tdDirectory = tdDirectory;
    }

    public async startDevice() {
        const exposedThing = await this.deviceWoT.produce(this.thingModel);

        this.thing = exposedThing;
        this.td = exposedThing.getThingDescription();
        this.initializeActions();

        await this.thing.expose();
        console.log("Exposed Thing:", this.thingModel.title);

        if (this.tdDirectory) {
            this.register(this.tdDirectory);
        }
    }

    public register(directory: string) {
        console.log("Registering TD in directory: " + directory);
        fetch(directory, {
            method: "POST",
            body: JSON.stringify(this.thing.getThingDescription()),
            headers: { "Content-Type": "application/json" },
        }).then((response) => {
            if (response.status < 300) {
                console.log("TD registered!");
            } else {
                console.warn("Failed to register TD. Will try again in 10 Seconds...");
                setTimeout(() => {
                    this.register(directory);
                }, 10000);
                return;
            }
        }).catch((error) => {
            console.debug(error);
            console.warn("Failed to register TD. Will try again in 10 Seconds...");
            setTimeout(() => {
                this.register(directory);
            }, 10000);
            return;
        });
    }

    private async lightStateActionHandler(inputData?: WoT.InteractionOutput, _options?: WoT.InteractionOptions) {
        let dataValue: string | number | boolean | object | WoT.DataSchemaValue[];
        if (inputData) {
            dataValue = await inputData.value();
        }

        console.log("Setting light to:", dataValue);

        return null;
    }

    private initializeActions() {
        this.thing.setActionHandler("lightState", async (inputData) => {
            const dataValue = await inputData.value();
            if (!ajv.validate(this.td.actions.lightState.input, dataValue)) {
                throw new Error("Invalid input");
            } else {
                return this.lightStateActionHandler(inputData);
            }
        });
    }
}