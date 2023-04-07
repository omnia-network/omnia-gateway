import { ChildProcess, spawn } from "child_process";
import WebSocket from "ws";
import { decodeLogs, filterLogs, resultParser } from "./parser.js";
import {
  CHIPGenericCommandId,
  CHIPParsedResult,
  CHIPWSMessage,
} from "../models";
import { ClusterId } from "@project-chip/matter.js/dist/dts/common/ClusterId";
import { NodeId } from "@project-chip/matter.js/dist/dts/common/NodeId";
import { EndpointNumber } from "@project-chip/matter.js/dist/dts/common/EndpointNumber";
import {
  getMatterControllerFileTransport,
  matterControllerLogger,
} from "../services/logger.js";

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
        console.log("chip-tool spawned");
      });

      this.chipToolProcess.stdout.on("data", (message) => {
        // we should not need this, as we are using the WebSocket
        // and messages are already streamed there
        console.log("chip-tool stdout", message.toString());

        if (message.toString().includes("LWS_CALLBACK_EVENT_WAIT_CANCELLED")) {
          if (!this.isChipToolRunning) {
            console.log("Matter controller started");
            this.isChipToolRunning = true;
          }

          if (!this.chipWs) {
            this.chipWs = new WebSocket(`ws://localhost:${this.chipWsPort}`);

            this.chipWs.onopen = (): void => {
              console.log("WS opened");
              resolve();
            };

            this.chipWs.onclose = (): void => {
              console.log("WS closed");
            };

            this.chipWs.onerror = (error): void => {
              console.log("WS error", error);
            };
          }
        }
      });

      this.chipToolProcess.stderr.on("data", (message) => {
        console.log("chip-tool stderr", message.toString());
      });

      this.chipToolProcess.on("error", (error) => {
        console.log("chip-tool error", error);
        reject(error);
      });

      this.chipToolProcess.on("exit", (code, signal) => {
        console.log("chip-tool exit", code, signal);
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

      console.log("Matter controller stopped");
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

    console.log("sending message", messageToSend);

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
    const parsedMessage = JSON.parse(event.data.toString()) as CHIPWSMessage;

    const dataLogs = filterLogs(parsedMessage.logs);
    if (dataLogs.length === 0) {
      console.log("no data logs", parsedMessage.logs);
      reject(new Error("no data logs"));
      return;
    }

    const data = decodeLogs(dataLogs);
    if (!data) {
      console.log("no data to parse", dataLogs);
      reject(new Error("no data to parse"));
      return;
    }

    console.log("data", data);

    const result = resultParser(data);

    this.log(`${Date.now()}-${cluster.id}-${commandId}`, "info", result);

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
    console.log("commandErrorCallback", cluster, error.error);

    reject(error.error);

    this.chipWs.removeEventListener(
      "error",
      this.commandErrorCallback.bind(this, cluster, commandId, reject),
    );
  }

  private log(filename: string, level: string, message: unknown): void {
    const fileLogger = getMatterControllerFileTransport(filename);
    matterControllerLogger.add(fileLogger);
    matterControllerLogger.log(level, message);
    matterControllerLogger.remove(fileLogger);
  }
}
