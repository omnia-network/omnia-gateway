import { AttributeId } from "@project-chip/matter.js/dist/cjs/common/AttributeId.js";
import { ClusterId } from "@project-chip/matter.js/dist/cjs/common/ClusterId.js";
import { EndpointNumber } from "@project-chip/matter.js/dist/cjs/common/EndpointNumber.js";
import { NodeId } from "@project-chip/matter.js/dist/cjs/common/NodeId.js";
import fetch from "node-fetch";
import * as WoT from "wot-typescript-definitions";
import { MatterController } from "../matter-controller/controller.js";
import type {
  DbDevice,
  WotActionHandlerCommand,
  WotPropertyHandlerAttribute,
} from "../models/index.js";

/**
 * A WoT device that is connected to a Matter device.
 * It exposes the WoT Thing Description of the Matter device.
 */
export class MatterWotDevice {
  thing: WoT.ExposedThing;
  deviceWoT: typeof WoT;
  td: WoT.ThingDescription;

  private nodeId: NodeId;
  private tdDirectory: string;
  private matterController: MatterController;
  private localDevice: DbDevice;

  constructor(
    deviceWoT: typeof WoT,
    thingDescription: WoT.ThingDescription,
    matterController: MatterController,
    localDevice: DbDevice,
    tdDirectory?: string,
  ) {
    this.deviceWoT = deviceWoT;
    this.td = thingDescription;
    this.matterController = matterController;
    this.localDevice = localDevice;
    this.nodeId = new NodeId(BigInt(localDevice.matterNodeId));
    if (tdDirectory) this.tdDirectory = tdDirectory;
  }

  public async startDevice() {
    this.thing = await this.deviceWoT.produce(this.td);
    this.td = this.thing.getThingDescription();
    this.initializeProperties();
    this.initializeActions();

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

  private async propertyReadHandler(
    property: string,
    _options?: WoT.InteractionOptions,
  ) {
    if (!_options?.uriVariables) {
      throw new Error("No uriVariables provided");
    }

    const uriVariables = _options.uriVariables as WotPropertyHandlerAttribute;

    const clusterId = parseInt(property, 10);
    const attributeId = uriVariables.attribute;
    const matterCluster = this.localDevice.matterClusters[clusterId];
    if (!matterCluster) {
      throw new Error("No cluster found");
    }

    const readResult = await this.matterController.readAttribute(
      new ClusterId(matterCluster.clusterId),
      new AttributeId(attributeId),
      this.nodeId,
      new EndpointNumber(matterCluster.endpointId),
    );

    return readResult;
  }

  private async actionHandler(
    action: string,
    inputData?: WoT.InteractionOutput,
    _options?: WoT.InteractionOptions,
  ) {
    if (!inputData) {
      throw new Error("No inputData provided");
    }
    const dataValue = (await inputData.value()) as WotActionHandlerCommand;

    const clusterId = parseInt(action, 10);
    const matterCluster = this.localDevice.matterClusters[clusterId];
    if (!matterCluster) {
      throw new Error("No cluster found");
    }

    const commandResult = await this.matterController.sendCommand(
      new ClusterId(matterCluster.clusterId),
      dataValue.command.id,
      dataValue.command.payload || {},
      this.nodeId,
      new EndpointNumber(matterCluster.endpointId),
    );

    return commandResult;
  }
}
