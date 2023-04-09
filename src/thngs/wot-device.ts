import * as WoT from "wot-typescript-definitions";
import fetch from "node-fetch";

export class WotDevice {
  public thing: WoT.ExposedThing;
  public deviceWoT: typeof WoT;
  public td: WoT.ExposedThingInit;

  private thingModel: WoT.ExposedThingInit;
  private tdDirectory: string;

  constructor(
    deviceWoT: typeof WoT,
    thingModel: WoT.ExposedThingInit,
    tdDirectory?: string,
  ) {
    this.deviceWoT = deviceWoT;
    this.thingModel = thingModel;
    if (tdDirectory) this.tdDirectory = tdDirectory;
  }

  public async startDevice() {
    this.thing = await this.deviceWoT.produce(this.thingModel);
    this.td = this.thing.getThingDescription();
    this.initializeProperties();
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
    this.thing.setPropertyReadHandler("myProperty", this.myPropertyReadHandler);
  }

  private initializeActions() {
    this.thing.setActionHandler("myAction", async (inputData) => {
      return this.myActionHandler(inputData);
    });
  }

  private async myPropertyReadHandler(_options?: WoT.InteractionOptions) {
    console.log("Reading property");
    // read sensor value
    return "Sensor value";
  }

  private async myActionHandler(
    inputData?: WoT.InteractionOutput,
    _options?: WoT.InteractionOptions,
  ) {
    let dataValue: WoT.DataSchemaValue;
    if (inputData) {
      dataValue = await inputData.value();
    }

    console.log("Action:", dataValue);

    return "Action executed";
  }
}
