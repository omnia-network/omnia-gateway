import fetch from "node-fetch";
import * as WoT from "wot-typescript-definitions";
import { HttpWotActionHandlerCommand } from "../models/http-wot-mapping";

/**
 * A WoT device that is connected to an HTTP device
 * It exposes the WoT Thing Description of the HTTP device.
 */
export class HttpWotDevice {
  thing: WoT.ExposedThing;
  deviceWoT: typeof WoT;
  td: WoT.ThingDescription;

  constructor(
    deviceWoT: typeof WoT,
    thingDescription: WoT.ThingDescription,
  ) {
    this.deviceWoT = deviceWoT;
    this.td = thingDescription;
  }

  public async startDevice() {
    this.thing = await this.deviceWoT.produce(this.td);
    this.td = this.thing.getThingDescription();
    this.initializeActions();

    await this.thing.expose();
    console.log("Exposed Thing:", this.td.title);
  }

  private initializeActions() {
    if (typeof this.td.actions === "object") {
      for (const [action, _info] of Object.entries(this.td.actions)) {
        // console.log("Registered default action handler for:", action, _info);
        this.thing.setActionHandler(
          action,
          this.actionHandler.bind(this, action),
        );
      }
    }
  }

  private async actionHandler(
    _action: string,
    inputData: WoT.InteractionOutput,
    _options?: WoT.InteractionOptions,
  ) {

      const dataValue = (await inputData.value()) as HttpWotActionHandlerCommand;
      console.log(dataValue);

    await fetch("http://192.168.178.11/color", {
      method: 'post',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: dataValue
    });
  }
}
