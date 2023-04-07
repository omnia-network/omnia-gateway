import { ChildProcess, spawn } from "child_process";
import { decodeLogs, filterLogs, resultParser } from "./parser.js";
import { CHIPGenericCommandId, CHIPParsedResult, CHIPWSMessage } from "../models";
import { ClusterId } from "@project-chip/matter.js/dist/dts/common/ClusterId";
// import { AnySchema } from "@project-chip/matter.js";
import { NodeId } from "@project-chip/matter.js/dist/dts/common/NodeId";
import { EndpointNumber } from "@project-chip/matter.js/dist/dts/common/EndpointNumber";
import { getMatterControllerFileTransport, matterControllerLogger } from "../services/logger.js";

export class MatterController {
  chipWsPort: number;
  chipToolBinPath: string;
  private chipWs: WebSocket;
  private chipToolProcess: ChildProcess;

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
    this.chipToolProcess = spawn(
      this.chipToolBinPath,
      ["interactive", "server"],
      {
        detached: true,
      }
    );

    this.chipToolProcess.on("spawn", () => {
      console.log("chip-tool spawned");

      this.chipWs = new WebSocket(`ws://localhost:${this.chipWsPort}`);

      this.chipWs.onopen = (): void => {
        console.log("WS opened");
      };

      this.chipWs.onclose = (): void => {
        console.log("WS closed");
      };

      this.chipWs.onerror = (error): void => {
        console.log("WS error", error);
      };

      console.log("Matter controller started");
    });

    // we should not need this, as we are using the WebSocket
    // and messages are already streamed there
    // this.chipToolProcess.on("message", (message) => {
    //   console.log("chip-tool message", message);
    // });

    this.chipToolProcess.on("error", (error) => {
      console.log("chip-tool error", error);
    });

    this.chipToolProcess.on("exit", (code, signal) => {
      console.log("chip-tool exit", code, signal);
    });

    // this.chipWs.on("open", () => {
    //   console.log("Matter controller started");
    // });
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
   * @param {CHIPGenericCluster} cluster
   * @returns {Promise<CHIPParsedResult>}
   * @throws {Error} if the Matter controller is not running.
   */
  async sendCommand(
    cluster: ClusterId,
    commandId: CHIPGenericCommandId,
    payload: number,
    nodeId: NodeId,
    endpointId: EndpointNumber
  ): Promise<CHIPParsedResult> {
    if (!this.chipToolProcess) {
      throw new Error("Matter controller is not running");
    }

    return new Promise((resolve, reject) => {
      this.chipWs.send(`any command-by-id ${cluster.id} ${commandId} ${payload} ${nodeId} ${endpointId}`);

      this.chipWs.addEventListener("message", this.commandCallback.bind(this, cluster, commandId, resolve));
      this.chipWs.addEventListener("error", this.commandErrorCallback.bind(this, cluster, commandId, reject));
    });
  }

  private commandCallback(cluster: ClusterId, commandId: CHIPGenericCommandId, resolve: (v: unknown) => void, message: string): void {
    const parsedMessage = JSON.parse(message) as CHIPWSMessage;

    const dataLogs = filterLogs(parsedMessage.logs);
    const data = decodeLogs(dataLogs);

    const result = resultParser(data);

    this.log(`${Date.now()}-${cluster}-${commandId}`, "info", result);

    this.chipWs.removeEventListener("message", this.commandCallback.bind(this, cluster, resolve));
  }

  private commandErrorCallback(cluster: ClusterId, commandId: CHIPGenericCommandId, reject: (e: Error) => void, error: string): void {

    console.log("commandErrorCallback", cluster, error);

    this.chipWs.removeEventListener("error", this.commandErrorCallback.bind(this, cluster, commandId, reject));
  }

  private log(filename: string, level: string, message: unknown): void {
    const fileLogger = getMatterControllerFileTransport(filename);
    matterControllerLogger.add(fileLogger);
    matterControllerLogger.log(level, message);
    matterControllerLogger.remove(fileLogger);
  }

}

// const pairingCommand = async () => {
  // exec("~/matter/bin/chip-tool pairing ble-wifi 0x1 OmniaRouter omnianetwork 20202021 3840", execCb.bind(null, 'pairing'));
  // exec(
  //   "~/matter/bin/chip-tool onoff on 0x1 0x1",
  //   execCb.bind(null, "onoff-on"),
  // );

  // const f = fs.readFileSync('./logs/1680802879113-pairing-output.log', 'utf8');

  // const filteredOutput = filterOutput(f);

  // const currentTimestamp = Date.now();

  // const logsFolder = `./logs/${currentTimestamp}`;

  // fs.mkdirSync(logsFolder, { recursive: true });

  // const result = resultParser(filteredOutput);
  // fs.writeFileSync(`${logsFolder}/test-result.json`, serializeResult(result));
// };
