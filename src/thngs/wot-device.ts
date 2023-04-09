import * as WoT from "wot-typescript-definitions";
import fetch from "node-fetch";
import { MatterController } from "../matter-controller/controller";

export class WotDevice {
  public thing: WoT.ExposedThing;
  public deviceWoT: typeof WoT;
  public td: WoT.ExposedThingInit;

  private thingModel: WoT.ExposedThingInit;
  private tdDirectory: string;
  private matterController: MatterController;

  constructor(
    deviceWoT: typeof WoT,
    thingModel: WoT.ExposedThingInit,
    matterController: MatterController,
    tdDirectory?: string,
  ) {
    this.deviceWoT = deviceWoT;
    this.thingModel = thingModel;
    this.matterController = matterController;
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
    if (typeof this.td.properties === "object") {
      for (const [property, _info] of Object.entries(this.td.properties)) {
        console.log(
          "Registered default property read handler for: ",
          property,
          _info,
        );
        this.thing.setPropertyReadHandler(
          `${property}`,
          this.defaultPropertyReadHandler,
        );
      }
    }
  }

  private initializeActions() {
    if (typeof this.td.actions === "object") {
      for (const [action, _info] of Object.entries(this.td.actions)) {
        console.log("Registered default action handler for: ", action, _info);
        this.thing.setActionHandler(`${action}`, async (inputData) =>
          this.defaultActionHandler(inputData),
        );
      }
    }
  }

  private async defaultPropertyReadHandler(_options?: WoT.InteractionOptions) {
    console.log("Default property");
    return "Default property";
  }

  private async defaultActionHandler(
    inputData?: WoT.InteractionOutput,
    _options?: WoT.InteractionOptions,
  ) {
    let dataValue: WoT.DataSchemaValue;
    if (inputData) {
      dataValue = await inputData.value();
    }
    // this.matterController.sendCommand(
    //     new ClusterId(OnOffCluster.id),
    //     OnOffCluster.commands.on.requestId,
    //     {},
    //     deviceNodeId,
    //     new EndpointNumber(1),
    //   );
    console.log("Action:", dataValue);

    return "Default action";
  }
}
