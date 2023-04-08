import { ChildProcess, spawn } from "child_process";
import WebSocket from "ws";
import { parseWebSocketMessage, parseCHIPMessage } from "./parser.js";
import { CHIPGenericCommandId, CHIPParsedResult } from "../models";
import { ClusterId } from "@project-chip/matter.js/dist/dts/common/ClusterId";
import { NodeId } from "@project-chip/matter.js/dist/dts/common/NodeId";
import { EndpointNumber } from "@project-chip/matter.js/dist/dts/common/EndpointNumber";
import { matterControllerLogger } from "../services/logger.js";

export class MatterController {
  chipWsPort: number;
  chipToolBinPath: string;
  private chipWs: WebSocket;
  private chipToolProcess: ChildProcess;
  private isChipToolRunning = false;

  constructor(chipWsPort: number, chipToolBinPath: string) {
    this.chipWsPort = chipWsPort;
    this.chipToolBinPath = chipToolBinPath;
  }

  /**
   * Starts the `chip-tool` from command line in `interactive` mode.
   * This exposes a WebSocket on port `this.chipWsPort`, to which this Matter Controller connects to.
   * @returns {Promise<void>}
   */
  async start(): Promise<void> {
    this.chipToolProcess = spawn(this.chipToolBinPath, [
      "interactive",
      "server",
      "--port",
      this.chipWsPort.toString(),
    ]);

    return new Promise((resolve, reject) => {
      this.chipToolProcess.on("spawn", () => {
        matterControllerLogger.info("chip-tool spawned");
      });

      this.chipToolProcess.stdout.on("data", (message) => {
        // we should not need this, as we are using the WebSocket
        // and messages are already streamed there
        matterControllerLogger.debug(`chip-tool stdout: ${message.toString()}`);

        if (message.toString().includes("LWS_CALLBACK_EVENT_WAIT_CANCELLED")) {
          if (!this.isChipToolRunning) {
            matterControllerLogger.info("Matter controller started");
            this.isChipToolRunning = true;
          }

          if (!this.chipWs) {
            this.chipWs = new WebSocket(`ws://localhost:${this.chipWsPort}`);

            this.chipWs.onopen = (): void => {
              matterControllerLogger.info("WS opened");
              resolve();
            };

            this.chipWs.onclose = (): void => {
              matterControllerLogger.info("WS closed");
            };

            this.chipWs.onerror = (error): void => {
              matterControllerLogger.error(
                `WS error ${error.message}`,
                error.error,
              );
            };
          }
        }
      });

      this.chipToolProcess.stderr.on("data", (message) => {
        matterControllerLogger.error(`chip-tool stderr: ${message.toString()}`);
      });

      this.chipToolProcess.on("error", (error) => {
        matterControllerLogger.error(
          `chip-tool error: ${error.message}`,
          error,
        );
        reject(error);
      });

      this.chipToolProcess.on("exit", (code, signal) => {
        matterControllerLogger.info(
          `chip-tool exit: code:${code} signal:${signal}`,
        );
      });
    });
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

      matterControllerLogger.info("Matter controller stopped");
    }
  }

  /**
   * Sends a command to the Matter controller.
   * @param {ClusterId} cluster the cluster ID of the command to send
   * @param {CHIPGenericCommandId} commandId the command ID to send
   * @param {string} payload a stringified JSON object (see `chip-tool any command-by-id` message for more info)
   * @param {NodeId} nodeId the node ID of the Matter device, as saved locally in the Matter controller
   * @param {EndpointNumber} endpointId the endpoint ID of the Matter device to send the command to
   * @returns {Promise<CHIPParsedResult>} the parsed result of the command
   * @throws {Error} if the Matter controller is not running.
   */
  async sendCommand(
    cluster: ClusterId,
    commandId: CHIPGenericCommandId,
    payload: string,
    nodeId: NodeId,
    endpointId: EndpointNumber,
  ): Promise<CHIPParsedResult> {
    if (!this.chipToolProcess) {
      throw new Error("Matter controller is not running");
    }

    const messageToSend = `any command-by-id ${cluster.id} ${commandId} '${payload}' ${nodeId.id} ${endpointId.number}`;

    matterControllerLogger.debug(`sending message: ${messageToSend}`);

    return new Promise((resolve, reject) => {
      this.chipWs.send(messageToSend);

      this.chipWs.addEventListener(
        "message",
        this.commandCallback.bind(this, cluster, commandId, resolve, reject),
      );
      this.chipWs.addEventListener(
        "error",
        this.commandErrorCallback.bind(this, cluster, commandId, reject),
      );
    });
  }

  private commandCallback(
    cluster: ClusterId,
    commandId: CHIPGenericCommandId,
    resolve: (v: unknown) => void,
    reject: (e: Error) => void,
    event: WebSocket.MessageEvent,
  ): void {
    const parsedMessage = parseWebSocketMessage(event.data.toString());

    const result = parseCHIPMessage(parsedMessage);

    if (Object.keys(result).length === 0) {
      matterControllerLogger.error(
        `commandCallback: cluster:${cluster.id} commandId:${commandId} result is empty`,
      );
      reject(new Error("Command result is empty"));
      return;
    }

    matterControllerLogger.debug(
      `commandCallback: cluster:${cluster.id} commandId:${commandId}`,
      result,
    );
    matterControllerLogger.info(
      `Command success: cluster:${cluster.id} commandId:${commandId}`,
    );

    resolve(result);

    this.chipWs.removeEventListener(
      "message",
      this.commandCallback.bind(this, cluster, commandId, resolve, reject),
    );
  }

  private commandErrorCallback(
    cluster: ClusterId,
    commandId: CHIPGenericCommandId,
    reject: (e: Error) => void,
    error: WebSocket.ErrorEvent,
  ): void {
    matterControllerLogger.error(
      `commandErrorCallback: cluster:${cluster.id} commandId:${commandId} error:${error.message}`,
      error.error,
    );

    reject(error.error);

    this.chipWs.removeEventListener(
      "error",
      this.commandErrorCallback.bind(this, cluster, commandId, reject),
    );
  }
}
