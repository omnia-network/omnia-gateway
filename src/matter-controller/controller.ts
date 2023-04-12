import { ChildProcess, spawn } from "child_process";
import WebSocket from "ws";
import { parseWebSocketMessage, parseCHIPMessage } from "./parser.js";
import { CHIPGenericCommandId, CHIPParsedResult } from "../models";
import { AttributeId } from "@project-chip/matter.js/dist/dts/common/AttributeId";
import { ClusterId } from "@project-chip/matter.js/dist/dts/common/ClusterId";
import { NodeId } from "@project-chip/matter.js/dist/dts/common/NodeId";
import { EndpointNumber } from "@project-chip/matter.js/dist/dts/common/EndpointNumber";
import { getLogger } from "../services/logger.js";
import { ENV_VARIABLES } from "./../constants/environment.js";

export class MatterController {
  //// WebSocket properties to communicate with `chip-tool`
  readonly chipWsPort: number;
  private chipWs: WebSocket;

  //// `chip-tool` process execution properties
  readonly chipToolBinPath: string;
  private chipToolProcess: ChildProcess;
  private isChipToolRunning = false;
  private chipToolLogger = getLogger("chip-tool");

  //// Matter Controller properties
  private matterControllerLogger = getLogger("MatterController");
  // this flag is needed only for testing purposes, where the `chip-tool` is not available
  private useMatterController = ENV_VARIABLES.USE_MATTER_CONTROLLER;

  constructor(chipWsPort: number, chipToolBinPath: string) {
    this.chipWsPort = chipWsPort;
    this.chipToolBinPath = chipToolBinPath;
  }

  /**
   * Starts the `chip-tool` from command line in `interactive` mode.
   * This exposes a WebSocket on port `this.chipWsPort`, to which this Matter Controller connects to.
   * @returns {Promise<void>}
   */
  start(): Promise<void> {
    if (this.useMatterController) {
      this.chipToolProcess = spawn(this.chipToolBinPath, [
        "interactive",
        "server",
        "--port",
        this.chipWsPort.toString(),
      ]);

      return new Promise((resolve, reject) => {
        this.chipToolProcess.on("spawn", () => {
          this.matterControllerLogger.info("chip-tool spawned");
        });

        this.chipToolProcess.stdout.on("data", (message) => {
          // we should not need this, as we are using the WebSocket
          // and messages are already streamed there
          this.chipToolLogger.debug(`stdout: ${message.toString()}`);

          if (
            message.toString().includes("LWS_CALLBACK_EVENT_WAIT_CANCELLED")
          ) {
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

        this.chipToolProcess.stderr.on("data", (message) => {
          this.chipToolLogger.error(`stderr: ${message.toString()}`);
        });

        this.chipToolProcess.on("error", (error) => {
          this.matterControllerLogger.error(
            `chip-tool error: ${error.message}`,
            error,
          );
          reject(error);
        });

        this.chipToolProcess.on("exit", (code, signal) => {
          this.matterControllerLogger.info(
            `chip-tool exit: code:${code} signal:${signal}`,
          );
        });
      });
    }

    return Promise.resolve();
  }

  /**
   * Stops this Matter controller. Closes the WebSocket and stops the `chip-tool` from command line.
   * @returns {Promise<void>}
   * @throws {Error} if the Matter controller is not running.
   * @throws {Error} if the Matter controller is not stopped.
   */
  async stop(): Promise<void> {
    if (this.chipToolProcess) {
      this.chipToolProcess.kill();
      this.chipToolProcess = null;

      this.chipWs.close();

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
    if (this.useMatterController) {
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

    return Promise.resolve({} as T);
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
  async pairDevice(
    nodeId: NodeId,
    payload: string,
    ssid: string,
    password: string,
  ): Promise<CHIPParsedResult> {
    if (this.useMatterController) {
      if (!this.chipToolProcess) {
        throw new Error("Matter controller is not running");
      }

      if (!ssid || !password) {
        throw new Error("WiFi SSID or password are missing");
      }

      const messageToSend = `pairing code-wifi ${nodeId.id} ${ssid} ${password} ${payload}`;

      return this.sendWsMessage(
        messageToSend,
        this.pairDeviceCallback.bind(this, nodeId, true),
        this.pairDeviceErrorCallback.bind(this, nodeId, true),
      );
    }

    return Promise.resolve([] as CHIPParsedResult);
  }

  async unpairDevice(nodeId: NodeId): Promise<CHIPParsedResult> {
    if (this.useMatterController) {
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

    return Promise.resolve([] as CHIPParsedResult);
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
    if (this.useMatterController) {
      if (!this.chipToolProcess) {
        throw new Error("Matter controller is not running");
      }

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

    return Promise.resolve([] as CHIPParsedResult);
  }

  /**
   * Callback for the command WebSocket message event. Can throw an error if the message is not a valid CHIP message.
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
    if (this.useMatterController) {
      if (!this.chipToolProcess) {
        throw new Error("Matter controller is not running");
      }

      const messageToSend = `any read-by-id ${cluster.id} ${attribute.id} ${nodeId.id} ${endpointId.number}`;

      return this.sendWsMessage(
        messageToSend,
        this.readAttributeCallback.bind(this, cluster, attribute),
        this.readAttributeErrorCallback.bind(this, cluster, attribute),
      );
    }

    return Promise.resolve([] as CHIPParsedResult);
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
}
