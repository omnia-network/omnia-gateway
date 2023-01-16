import * as WoT from "wot-typescript-definitions";
import request from "request";
import Ajv from "ajv";

const ajv = new Ajv();

export class WotDevice {
    public thing: WoT.ExposedThing;
    public deviceWoT: typeof WoT;
    public td: WoT.ExposedThingInit;

    // Thing Model -> fill in the empty quotation marks
    private thingModel: WoT.ExposedThingInit = {
        "@context": ["https://www.w3.org/2019/wot/td/v1", { "@language": "en" }],
        "@type": "",
        id: "new:thing",
        title: "thng",
        description: "",
        securityDefinitions: {
            "": {
                scheme: "nosec",
            },
        },
        security: "",
        properties: {
            myProperty: {
                title: "A short title for User Interfaces",
                description: "A longer string for humans to read and understand",
                unit: "",
                type: "null",
            },
        },
        actions: {
            myAction: {
                title: "A short title for User Interfaces",
                description: "A longer string for humans to read and understand",
                input: {
                    unit: "",
                    type: "number",
                },
                out: {
                    unit: "",
                    type: "string",
                },
            },
        },
        events: {
            myEvent: {
                title: "A short title for User Interfaces",
                description: "A longer string for humans to read and understand",
                data: {
                    unit: "",
                    type: "null",
                },
            },
        },
    };

    //TD Directory
    private tdDirectory: string;

    // property declarations
    private myProperty: WoT.InteractionInput;

    constructor(deviceWoT: typeof WoT, tdDirectory?: string) {
        // initialze WotDevice parameters
        this.deviceWoT = deviceWoT;
        if (tdDirectory) this.tdDirectory = tdDirectory;
    }

    public async startDevice() {
        console.log(`Producing Thing: ${this.thingModel.title}`);
        const exposedThing = await this.deviceWoT.produce(this.thingModel);
        console.log("Thing produced");

        this.thing = exposedThing;
        this.td = exposedThing.getThingDescription();
        this.initializeProperties(); // Initialize properties and add their handlers
        this.initializeActions(); // Initialize actions and add their handlers
        // Events do not need to be initialzed, can be emited from anywhere

        console.log(`Exposing Thing: ${this.thingModel.title}`);
        await this.thing.expose(); // Expose thing
        console.log("Exposed Thing");

        if (this.tdDirectory) {
            this.register(this.tdDirectory);
        }
        this.listenToMyEvent(); // used to listen to specific events provided by a library. If you don't have events, simply remove it
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

    private async myPropertyReadHandler(_options?: WoT.InteractionOptions) {
        // read something
        return this.myProperty;
    }

    private async myPropertyWriteHandler(inputData: WoT.InteractionOutput, _options?: WoT.InteractionOptions) {
        // write something to property
        this.myProperty = await inputData.value();
    }

    private async myActionHandler(inputData?: WoT.InteractionOutput, _options?: WoT.InteractionOptions) {
        // do something with inputData if available
        let dataValue: string | number | boolean | object | WoT.DataSchemaValue[];
        if (inputData) {
            dataValue = await inputData.value();
        }

        if (dataValue) {
            this.thing.emitEvent("myEvent", null); // Emiting an event (may be removed; only for demonstration purposes)
        }

        const outputData = "";

        // resolve that with outputData if available, else resolve that action was successful without returning anything
        if (outputData) {
            return outputData;
        } else {
            return null;
        }
    }

    private listenToMyEvent() {
        /*
		specialLibrary.getMyEvent()//change specialLibrary to your library
		.then((thisEvent) => {
			this.thing.emitEvent("myEvent",""); //change quotes to your own event data
    	});
    	*/
    }

    private initializeProperties() {
        //fill in add properties
        this.myProperty = ""; // replace quotes with the initial value
        this.thing.setPropertyReadHandler("myProperty", this.myPropertyReadHandler); // not applicable for write-only
        this.thing.setPropertyWriteHandler("myProperty", this.myPropertyWriteHandler); // not applicable for read-only
    }

    private initializeActions() {
        //fill in add actions
        this.thing.setActionHandler("myAction", async (inputData) => {
            const dataValue = await inputData.value();
            if (!ajv.validate(this.td.actions.myAction.input, dataValue)) {
                throw new Error("Invalid input");
            } else {
                return this.myActionHandler(inputData);
            }
        });
    }
}