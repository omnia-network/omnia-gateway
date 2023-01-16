import * as WoT from "wot-typescript-definitions";
import request from "request";

export class LightSensor {
    public thing: WoT.ExposedThing;
    public deviceWoT: typeof WoT;
    public td: WoT.ExposedThingInit;

    private thingModel: WoT.ExposedThingInit = {
        "@context": ["https://www.w3.org/2019/wot/td/v1", { "@language": "en" }],
        "@type": "",
        id: "new:light-sensor",
        title: "light-sensor",
        description: "",
        securityDefinitions: {
            "": {
                scheme: "nosec",
            },
        },
        security: "",
        properties: {
            brightness: {
                title: "Brightness",
                description: "Brightness level in the room",
                unit: "lumen",
                type: "number",
                readOnly: true,
            },
        },
        
    };

    private tdDirectory: string;

    private brightness: WoT.InteractionInput;

    constructor(deviceWoT: typeof WoT, tdDirectory?: string) {
        this.deviceWoT = deviceWoT;
        if (tdDirectory) this.tdDirectory = tdDirectory;
    }

    public async startDevice() {
        const exposedThing = await this.deviceWoT.produce(this.thingModel);

        this.thing = exposedThing;
        this.td = exposedThing.getThingDescription();
        this.initializeProperties();

        await this.thing.expose();
        console.log("Exposed Thing:", this.thingModel.title);

        if (this.tdDirectory) {
            this.register(this.tdDirectory);
        }
    }

    public register(directory: string) {
        console.log("Registering TD in directory: " + directory);
        request.post(directory, { json: this.thing.getThingDescription() }, (error, response, _body) => {
            if (!error && response.statusCode < 300) {
                console.log("TD registered!");
            } else {
                console.debug(error);
                console.debug(response);
                console.warn("Failed to register TD. Will try again in 10 Seconds...");
                setTimeout(() => {
                    this.register(directory);
                }, 10000);
                return;
            }
        });
    }

    private initializeProperties() {
        this.brightness = 10;
        this.thing.setPropertyReadHandler("brightness", async (_options) => {
            return this.brightness;
        });
    }
}