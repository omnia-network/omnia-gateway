import fetch from "node-fetch";
import * as WoT from "wot-typescript-definitions";

/**
 * A WoT device that is connected to a device on The Things Network.
 * It exposes the WoT Thing Description of the TTN device.
 */
export class TtnWotDevice {
  thing: WoT.ExposedThing;
  deviceWoT: typeof WoT;
  td: WoT.ThingDescription;

  private tdDirectory: string;

  constructor(
    deviceWoT: typeof WoT,
    thingDescription: WoT.ThingDescription,
    tdDirectory?: string,
  ) {
    this.deviceWoT = deviceWoT;
    this.td = thingDescription;
    if (tdDirectory) this.tdDirectory = tdDirectory;
  }

  public async startDevice() {
    this.thing = await this.deviceWoT.produce(this.td);
    this.td = this.thing.getThingDescription();
    this.initializeProperties();

    await this.thing.expose();
    console.log("Exposed Thing:", this.td.title);

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
    })
      .then((response) => {
        if (response.status < 300) {
          console.log("TD registered!");
        } else {
          console.warn(
            "Failed to register TD. Will try again in 10 Seconds...",
          );
          setTimeout(() => {
            this.register(directory);
          }, 10000);
          return;
        }
      })
      .catch((error) => {
        console.debug(error);
        console.warn("Failed to register TD. Will try again in 10 Seconds...");
        setTimeout(() => {
          this.register(directory);
        }, 10000);
        return;
      });
  }

  private initializeProperties() {
    if (typeof this.td.properties === "object") {
      for (const [property, _info] of Object.entries(this.td.properties)) {
        // console.log(
        //   "Registered default property handler for:",
        //   property,
        //   _info,
        // );
        this.thing.setPropertyReadHandler(
          property,
          this.propertyReadHandler.bind(this, property),
        );
      }
    }
  }

  private async propertyReadHandler(
    property: string,
    _options?: WoT.InteractionOptions,
    ) {
    const response = await fetch(`https://eu1.cloud.thethings.network/api/v3/as/applications/smart-home-1234567890/devices/${this.td.title}/packages/storage/uplink_message?limit=1&order=-received_at`, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer NNSXS.SFJFPV2SNZAAR7AHDK2K4KTT4U36RSQSKM37VHI.5JACEQG2JONTOIZKA4NNX5JRKQSMX5FSOT37EN2YWDSRFAQ46R5Q',
        'Accept': 'application/json'
      }
    });
    const data = await response.json() as {
      result: {
        uplink_message: {
          frm_payload: string
        }
      };
    };

    let readOffset = 0;

    switch (property) {
      case "temperature":
        readOffset = 0;
        break;
      case "humidity":
        readOffset = 4;
        break;
      case "co2":
        readOffset = 8;
        break;
    }

    const dataBuf = Buffer.from(data.result.uplink_message.frm_payload, 'base64');
    const value = dataBuf.readFloatBE(readOffset);

    return value;
  }
}
