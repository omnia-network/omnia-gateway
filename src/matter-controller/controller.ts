import { ChildProcess, spawn } from "child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { getLogger } from "@omnia-gateway/core";
import {
  BasicInformationCluster,
  DescriptorCluster,
} from "@project-chip/matter.js";
import { AttributeId } from "@project-chip/matter.js/dist/cjs/common/AttributeId.js";
import { ClusterId } from "@project-chip/matter.js/dist/cjs/common/ClusterId.js";
import { EndpointNumber } from "@project-chip/matter.js/dist/cjs/common/EndpointNumber.js";
import { NodeId } from "@project-chip/matter.js/dist/cjs/common/NodeId.js";
import WebSocket from "ws";
import {
  CHIPGenericCommandId,
  CHIPParsedResult,
  DbMatterClusters,
  DbMatterDeviceInfo,
} from "../models";
import { parseCHIPMessage, parseWebSocketMessage } from "./parser.js";

const CHIP_TOOL_TMP_PATH = "/tmp";
const CHIP_TOOL_PERSISTENT_STORAGE_PATH = `${process.cwd()}/data/chip-tool`;

type MatterControllerOptions = {
  chipWsPort: number;
  chipToolBinPath: string;

  wifiSsid: string;
  wifiPassword: string;
};

export class MatterController {
  //// WebSocket properties to communicate with `chip-tool`
  readonly chipWsPort: number;
  private chipWs: WebSocket;

  //// `chip-tool` process execution properties
  readonly chipToolBinPath: string;
  private chipToolProcess: ChildProcess | null = null;
  private isChipToolRunning = false;
  private chipToolLogger = getLogger("chip-tool");

  //// Matter Controller properties
  private matterControllerLogger = getLogger("MatterController");

  readonly wifiSsid: string;
  readonly wifiPassword: string;

  constructor(options: MatterControllerOptions) {
    this.chipWsPort = options.chipWsPort;
    this.chipToolBinPath = options.chipToolBinPath;

    this.wifiSsid = options.wifiSsid;
    this.wifiPassword = options.wifiPassword;
  }

  /**
   * Starts the `chip-tool` from command line in `interactive` mode.
   * This exposes a WebSocket on port `this.chipWsPort`, to which this Matter Controller connects to.
   * @returns {Promise<void>}
   */
  start(): Promise<void> {
    // make sure the persistent data folder exists
    if (!existsSync(CHIP_TOOL_PERSISTENT_STORAGE_PATH)) {
      this.matterControllerLogger.info(
        `Creating persistent storage folder at ${CHIP_TOOL_PERSISTENT_STORAGE_PATH}`,
      );
      mkdirSync(CHIP_TOOL_PERSISTENT_STORAGE_PATH);
    }

    // before spawning the `chip-tool` process, we need to restore the persistent data
    // and put them in /tmp folder, where `chip-tool` expects them
    this.restoreMatterControllerData();

    this.chipToolProcess = spawn(this.chipToolBinPath, [
      "interactive",
      "server",
      "--port",
      this.chipWsPort.toString(),
    ]);

    return new Promise((resolve, reject) => {
      this.chipToolProcess?.on("spawn", () => {
        this.matterControllerLogger.info("chip-tool spawned");
      });

      this.chipToolProcess?.stdout?.on("data", (message) => {
        // we should not need this, as we are using the WebSocket
        // and messages are already streamed there
        // this.chipToolLogger.debug(`stdout: ${message.toString()}`);

        if (message.toString().includes("LWS_CALLBACK_EVENT_WAIT_CANCELLED")) {
          if (!this.isChipToolRunning) {
            this.matterControllerLogger.info("Matter controller started");
            this.isChipToolRunning = true;
          }

          if (!this.chipWs) {
            this.chipWs = new WebSocket(`ws://localhost:${this.chipWsPort}`);

            this.chipWs.onopen = (): void => {
              this.matterControllerLogger.info("WS opened");
              resolve();
            };

            this.chipWs.onclose = (): void => {
              this.matterControllerLogger.info("WS closed");
            };

            this.chipWs.onerror = (error): void => {
              this.matterControllerLogger.error(
                `WS error ${error.message}`,
                error.error,
              );
            };
          }
        }
      });

      this.chipToolProcess?.stderr?.on("data", (message) => {
        this.chipToolLogger.error(`stderr: ${message.toString()}`);
      });

      this.chipToolProcess?.on("error", (error) => {
        this.matterControllerLogger.error(
          `chip-tool error: ${error.message}`,
          error,
        );
        reject(error);
      });

      this.chipToolProcess?.on("exit", (code, signal) => {
        this.matterControllerLogger.info(
          `chip-tool exit: code:${code} signal:${signal}`,
        );
      });
    });
  }

  /**
   * Stops this Matter controller. Closes the WebSocket and stops the `chip-tool` from command line.
   * @returns {void}
   * @throws {Error} if the Matter controller is not running.
   * @throws {Error} if the Matter controller is not stopped.
   */
  stop(): void {
    if (this.chipToolProcess) {
      this.chipToolProcess.kill();
      this.chipToolProcess = null;

      this.chipWs.close();

      this.persistMatterControllerData();

      this.matterControllerLogger.info("Matter controller stopped");
    }
  }

  /**
   * Sends a command to the Matter controller through the WebSocket.
   * It takes care to handle the WebSocket events, unsubscribe from them and handle the successCallback function.
   * @param {string} message the message to send
   * @param {Function} successCallback the callback to call when the message is received. It can throw an error, that will be caught and returned as a rejected promise.
   * @param {Function} errorCallback the callback to call when an error occurs
   * @returns {Promise<T>} the result of the `successCallback` function
   * @throws {Error} The error thrown by the `successCallback` function or the error of the WebSocket.
   */
  private async sendWsMessage<T>(
    message: string,
    successCallback: (event: WebSocket.MessageEvent) => T,
    errorCallback: (event: WebSocket.ErrorEvent) => Error,
  ): Promise<T> {
    this.matterControllerLogger.debug(`sending message: ${message}`);

    this.chipWs.send(message);

    return new Promise((resolve, reject) => {
      const messageHandler = (ev: WebSocket.MessageEvent): void => {
        try {
          resolve(successCallback(ev));
        } catch (e) {
          this.matterControllerLogger.error(
            `sendWsMessage: error while handling success callback: ${e.message}`,
            e,
          );
          reject(e);
        }
        this.chipWs.removeEventListener("message", messageHandler);
      };

      const errorHandler = (ev: WebSocket.ErrorEvent): void => {
        reject(errorCallback(ev));
        this.chipWs.removeEventListener("error", errorHandler);
      };

      this.chipWs.addEventListener("message", messageHandler);
      this.chipWs.addEventListener("error", errorHandler);
    });
  }

  /**
   * Parses the WebSocket message and returns the parsed result.
   * @param {string} message the message to parse
   * @returns {CHIPParsedResult} the parsed result of the command
   * @throws {Error} if the result of the command is empty
   */
  private parseWsMessage(message: string): CHIPParsedResult {
    const parsedMessage = parseWebSocketMessage(message);
    const result = parseCHIPMessage(parsedMessage);

    if (Object.keys(result).length === 0) {
      throw new Error("Command result is empty");
    }

    return result;
  }

  /**
   * Sends a `pairing code-wifi` command to the Matter controller through the WebSocket.
   * @param {NodeId} nodeId the node ID of the device to pair
   * @param {string} payload the QR code payload containing the device commissioning information
   * @param {string} ssid the WiFi SSID of the network to which the device should connect
   * @param {string} password the password of the network to connect to
   * @returns {Promise<void>}
   * @throws {Error} if the Matter controller is not running.
   * @throws {Error} if the pairing failed
   * @throws {Error} if ssid or password are missing
   */
  async pairDevice(nodeId: NodeId, payload: string): Promise<CHIPParsedResult> {
    if (!this.chipToolProcess) {
      throw new Error("Matter controller is not running");
    }

    const messageToSend = `pairing code-wifi ${nodeId.id} ${this.wifiSsid} ${this.wifiPassword} ${payload}`;

    return this.sendWsMessage(
      messageToSend,
      this.pairDeviceCallback.bind(this, nodeId, true),
      this.pairDeviceErrorCallback.bind(this, nodeId, true),
    );
  }

  async unpairDevice(nodeId: NodeId): Promise<CHIPParsedResult> {
    if (!this.chipToolProcess) {
      throw new Error("Matter controller is not running");
    }

    const messageToSend = `pairing unpair ${nodeId.id}`;

    return this.sendWsMessage(
      messageToSend,
      this.pairDeviceCallback.bind(this, nodeId, false),
      this.pairDeviceErrorCallback.bind(this, nodeId, false),
    );
  }

  /**
   * Callback for the pairing WebSocket message.
   * @param {NodeId} nodeId the node ID of the device to pair
   * @param {boolean} isPairing `true` if the device is pairing, `false` if it is unpairing
   * @param {WebSocket.MessageEvent} event the WebSocket event
   * @returns {CHIPParsedResult} the parsed result of the command
   * @throws {Error} if the pairing failed
   */
  private pairDeviceCallback(
    nodeId: NodeId,
    isPairing: boolean,
    event: WebSocket.MessageEvent,
  ): CHIPParsedResult {
    const result = this.parseWsMessage(event.data.toString());

    this.matterControllerLogger.info(
      `${isPairing ? "pairing" : "unpairing"}Device: nodeId:${nodeId.id}`,
      result,
    );

    // persist the `chip-tool` data, so that if the controller is stopped accidentally, we can still restore it
    this.persistMatterControllerData();

    return result;
  }

  private pairDeviceErrorCallback(
    nodeId: NodeId,
    isPairing: boolean,
    error: WebSocket.ErrorEvent,
  ): Error {
    this.matterControllerLogger.error(
      `${isPairing ? "pairing" : "unpairing"}DeviceError: nodeId:${
        nodeId.id
      } error:${error.message}`,
      error.error,
    );

    return error.error;
  }

  /**
   * Sends a command to the Matter controller.
   * @param {ClusterId} cluster the cluster ID of the command to send
   * @param {CHIPGenericCommandId} commandId the command ID to send
   * @param {Record<string, unknown>} payload a JSON object (see `chip-tool any command-by-id` message for more info)
   * @param {NodeId} nodeId the node ID of the Matter device, as saved locally in the Matter controller
   * @param {EndpointNumber} endpointId the endpoint ID of the Matter device to send the command to
   * @returns {Promise<CHIPParsedResult>} the parsed result of the command
   * @throws {Error} if the Matter controller is not running.
   */
  async sendCommand(
    cluster: ClusterId,
    commandId: CHIPGenericCommandId,
    payload: Record<string, unknown>,
    nodeId: NodeId,
    endpointId: EndpointNumber,
  ): Promise<CHIPParsedResult> {
    if (!this.chipToolProcess) {
      throw new Error("Matter controller is not running");
    }

    // TODO: set a timeout, so that we don't wait forever if something goes wrong
    const messageToSend = `any command-by-id ${
      cluster.id
    } ${commandId} '${JSON.stringify(payload)}' ${nodeId.id} ${
      endpointId.number
    }`;

    return this.sendWsMessage(
      messageToSend,
      this.commandCallback.bind(this, cluster, commandId),
      this.commandErrorCallback.bind(this, cluster, commandId),
    );
  }

  /**
   * Callback for the command WebSocket message event. Can throw an error if the message is not a valid CHIP message.
   * TODO: investigate if we can use the trace logs also (https://github.com/project-chip/connectedhomeip/tree/master/examples/chip-tool#using-message-tracing)
   * @param {ClusterId} cluster the cluster ID of the command sent
   * @param {CHIPGenericCommandId} commandId the command ID sent
   * @param {WebSocket.MessageEvent} event the WebSocket message event
   * @returns {CHIPParsedResult} the parsed result of the command
   * @throws {Error} if the result of the command is empty
   */
  private commandCallback(
    cluster: ClusterId,
    commandId: CHIPGenericCommandId,
    event: WebSocket.MessageEvent,
  ): CHIPParsedResult {
    const result = this.parseWsMessage(event.data.toString());

    this.matterControllerLogger.debug(
      `commandCallback: cluster:${cluster.id} commandId:${commandId}`,
      result,
    );

    return result;
  }

  private commandErrorCallback(
    cluster: ClusterId,
    commandId: CHIPGenericCommandId,
    error: WebSocket.ErrorEvent,
  ): Error {
    this.matterControllerLogger.error(
      `commandErrorCallback: cluster:${cluster.id} commandId:${commandId} error:${error.message}`,
      error.error,
    );

    return error.error;
  }

  /**
   * Sends a read attribute command to the Matter controller.
   * @param {ClusterId} cluster the cluster ID of the attribute to read
   * @param {AttributeId} attributeId the attribute ID to read
   * @param {NodeId} nodeId the node ID of the Matter device, as saved locally in the Matter controller
   * @param {EndpointNumber} endpointId the endpoint ID of the Matter device to read the attribute from
   * @returns {Promise<CHIPParsedResult>} the parsed result of the command
   * @throws {Error} if the Matter controller is not running.
   */
  async readAttribute(
    cluster: ClusterId,
    attribute: AttributeId,
    nodeId: NodeId,
    endpointId: EndpointNumber,
  ): Promise<CHIPParsedResult> {
    if (!this.chipToolProcess) {
      throw new Error("Matter controller is not running");
    }

    // TODO: set a timeout, so that we don't wait forever if something goes wrong
    const messageToSend = `any read-by-id ${cluster.id} ${attribute.id} ${nodeId.id} ${endpointId.number}`;

    return this.sendWsMessage(
      messageToSend,
      this.readAttributeCallback.bind(this, cluster, attribute),
      this.readAttributeErrorCallback.bind(this, cluster, attribute),
    );
  }

  /**
   * Callback for the read attribute WebSocket message event. Can throw an error if the message is not a valid CHIP message.
   * @param {ClusterId} cluster the cluster ID of the attribute read
   * @param {AttributeId} attributeId the attribute ID read
   * @param {WebSocket.MessageEvent} event the WebSocket message event
   * @returns {CHIPParsedResult} the parsed result of the command
   * @throws {Error} if the result of the command is empty
   */
  private readAttributeCallback(
    cluster: ClusterId,
    attribute: AttributeId,
    event: WebSocket.MessageEvent,
  ): CHIPParsedResult {
    const result = this.parseWsMessage(event.data.toString());

    this.matterControllerLogger.debug(
      `readAttributeCallback: cluster:${cluster.id} attributeId:${attribute.id}`,
      result,
    );

    return result;
  }

  private readAttributeErrorCallback(
    cluster: ClusterId,
    attribute: AttributeId,
    error: WebSocket.ErrorEvent,
  ): Error {
    this.matterControllerLogger.error(
      `readAttributeErrorCallback: cluster:${cluster.id} attributeId:${attribute.id} error:${error.message}`,
      error.error,
    );

    return error.error;
  }

  /**
   * chip-tool saves data in /tmp system folder, and there's no way to change it as of now.
   * This method copies the data to `data/chip-tool` folder, so that it can be restored after a reboot, using `restoreMatterControllerData` method.
   */
  private persistMatterControllerData(): void {
    // this can be inefficient if the /tmp folder is big
    const files = readdirSync(CHIP_TOOL_TMP_PATH).filter((f) =>
      f.startsWith("chip_"),
    );

    files.forEach((f) => {
      copyFileSync(
        join(CHIP_TOOL_TMP_PATH, f),
        join(CHIP_TOOL_PERSISTENT_STORAGE_PATH, f),
      );
    });
  }

  /**
   * Restores the Matter controller data from `data/chip-tool` folder.
   * This method is called after a reboot, to restore the data saved by `backupMatterControllerData` method.
   */
  private restoreMatterControllerData(): void {
    const files = readdirSync(CHIP_TOOL_PERSISTENT_STORAGE_PATH).filter((f) =>
      f.startsWith("chip_"),
    );

    files.forEach((f) => {
      copyFileSync(
        join(CHIP_TOOL_PERSISTENT_STORAGE_PATH, f),
        join(CHIP_TOOL_TMP_PATH, f),
      );
    });
  }

  /**
   * Calls the `basicinformation` cluster command and parses the result
   * There's no way to retrieve data all together, so for now we just repeat calls to the `basicinformation` cluster command for each attribute
   * @param {NodeId} nodeId the node ID of the Matter device, as saved locally in the Matter controller
   * @returns {Promise<MatterDeviceInfo>} the parsed result of the command
   * @throws {Error} if somthing goes wrong while calling the `basicinformation` cluster command
   */
  async getDeviceInfo(nodeId: NodeId): Promise<DbMatterDeviceInfo> {
    const vendorIdResult = await this.readAttribute(
      new ClusterId(BasicInformationCluster.id),
      new AttributeId(BasicInformationCluster.attributes.vendorId.id),
      nodeId,
      new EndpointNumber(0),
    );

    const vendorId = (vendorIdResult[0] as any).ReportDataMessage
      .AttributeReportIBs[0].AttributeReportIB.AttributeDataIB.Data;

    const productIdResult = await this.readAttribute(
      new ClusterId(BasicInformationCluster.id),
      new AttributeId(BasicInformationCluster.attributes.productId.id),
      nodeId,
      new EndpointNumber(0),
    );

    const productId = (productIdResult[0] as any).ReportDataMessage
      .AttributeReportIBs[0].AttributeReportIB.AttributeDataIB.Data;

    return {
      vendorId,
      productId,
    };
  }

  /**
   * Calls the `descriptor server-list` cluster command and parses the result
   * @param nodeId the node ID of the Matter device, as saved locally in the Matter controller
   * @returns {Promise<MatterAvailableClusters>} the parsed result of the command
   */
  async getDeviceAvailableClusters(nodeId: NodeId): Promise<DbMatterClusters> {
    // cycle on endpoints to discover available clusters
    // TODO: this could maybe be done in a more programmatic way, but still not sure how
    //       we could maybe use the descriptor parts-list command
    let endpointId = 0;
    const availableClusters: DbMatterClusters = {};
    let endpointFound = true;

    while (endpointFound) {
      try {
        const descriptorResult = await this.readAttribute(
          new ClusterId(DescriptorCluster.id),
          new AttributeId(DescriptorCluster.attributes.serverList.id),
          nodeId,
          new EndpointNumber(endpointId),
        );

        const ibs = (descriptorResult[0] as any).ReportDataMessage
          .AttributeReportIBs;

        if (!ibs || ibs.length === 0) {
          throw new Error("No AttributeReportIBs found");
        }

        // this is the status reported if the endpioint is not found
        // we shouldn't need this if we check for AttributeDataIB in the loop
        // if (ibs[0]["AttributeReportIB"]["AttributeStatusIB"]["StatusIB"]["status"] === "0x7f") {
        //   throw new Error("Attribute not found");
        // }

        for (const ib of ibs) {
          const dataIb = ib.AttributeReportIB.AttributeDataIB;
          if (!dataIb) {
            throw new Error("No AttributeDataIB found");
          }

          const data = dataIb.Data;
          if (typeof data === "number") {
            availableClusters[data] = {
              clusterId: data,
              endpointId,
            };
          }
        }

        endpointId++;
      } catch (error) {
        this.matterControllerLogger.warn(
          `getDeviceAvailableClusters: endpoint ${endpointId} not found`,
          error,
        );
        endpointFound = false;
      }
    }

    return availableClusters;
  }
}
