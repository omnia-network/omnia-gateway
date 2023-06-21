import * as WoT from "wot-typescript-definitions";

const td: WoT.ThingDescription = {
  "@context": [
    "https://www.w3.org/2019/wot/td/v1",
    {
      "@language": "en",
      saref: "https://saref.etsi.org/core/",
    },
  ],
  "@type": ["saref:Device"],
  title: "simple-device",
  securityDefinitions: {
    "": {
      scheme: "nosec",
    },
  },
  security: "",
  properties: {
    value: {
      type: "string",
      forms: [
        {
          href: "",
        },
      ],
    },
  },
  actions: {
    setValue: {
      input: {
        type: "string",
      },
      forms: [
        {
          href: "",
        },
      ],
    },
  },
};

/**
 * A simple WoT device that exposes a single property and action.
 * Used for testing purposes.
 */
export class SimpleWoTDevice {
  thing: WoT.ExposedThing;
  deviceWoT: typeof WoT;
  td: WoT.ThingDescription;

  value: string;

  constructor(deviceWoT: typeof WoT) {
    this.deviceWoT = deviceWoT;
    this.td = td;
  }

  public async startDevice() {
    this.thing = await this.deviceWoT.produce(this.td);
    this.td = this.thing.getThingDescription();
    this.initializeActions();
    this.initializeProperties();

    await this.thing.expose();
    console.log("Exposed Thing:", this.td.title);
  }

  private initializeProperties() {
    if (typeof this.td.properties === "object") {
      for (const [property, _info] of Object.entries(this.td.properties)) {
        this.thing.setPropertyReadHandler(
          property,
          this.propertyReadHandler.bind(this, property),
        );
        this.thing.setPropertyWriteHandler(
          property,
          this.propertyWriteHandler.bind(this, property),
        );
      }
    }
  }

  private initializeActions() {
    if (typeof this.td.actions === "object") {
      for (const [action, _info] of Object.entries(this.td.actions)) {
        this.thing.setActionHandler(
          action,
          this.actionHandler.bind(this, action),
        );
      }
    }
  }

  private async propertyReadHandler(
    _property: string,
    _options?: WoT.InteractionOptions,
  ) {
    console.log("Received property read:", _property);
    return this.value;
  }

  private async propertyWriteHandler(
    _property: string,
    inputData: WoT.InteractionOutput,
    _options?: WoT.InteractionOptions,
  ) {
    console.log("Received property write:", _property, inputData);
    const value = (await inputData.value())?.toString() || "";
    this.value = value;
  }

  private async actionHandler(
    _action: string,
    inputData: WoT.InteractionOutput,
    _options?: WoT.InteractionOptions,
  ) {
    console.log("Received action:", _action, inputData);
    const value = (await inputData.value())?.toString() || "";
    this.value = value;
  }
}
