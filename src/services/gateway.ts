import { existsSync, mkdirSync } from "fs";
import bindingHttp from "@node-wot/binding-http";
import { Servient } from "@node-wot/core";
import fetch from "node-fetch";
import * as WoT from "wot-typescript-definitions";
import { createOmniaBackend } from "../canisters/omnia_backend/index.js";
import { ENV_VARIABLES } from "../constants/environment.js";
import { IcAgent } from "../ic-agent/agent.js";
import { IcIdentity } from "../ic-agent/identity.js";
import { MatterController } from "../matter-controller/controller.js";
import { AppDevices, OmniaGatewayOptions } from "../models/gateway.js";
import { ProxyClient } from "../proxy/proxy-client.js";
import { HttpWotDevice } from "../thngs/http-wot-device.js";
import { TtnWotDevice } from './../thngs/ttn-wot-device.js';
import { Database } from "./local-db.js";

const DATA_FOLDER = `${process.cwd()}/data`;

export class OmniaGateway {
  //// IC Agent
  private _icAgent: IcAgent;
  private _icIdentity: IcIdentity;

  //// WoT
  private _wotServient: Servient;
  private _wotNamespace: typeof WoT;
  readonly wotServientPort: number;

  //// local database
  private _localDb: Database;

  //// Matter Controller
  private _matterController: MatterController;
  private _disableMatterController = false;

  //// Proxy
  private _useProxy = false;
  private _proxyClient: ProxyClient;

  //// Configuration
  private _standaloneMode = false;

  // TODO: add a logger instance for the OmniaGateway

  constructor(options: OmniaGatewayOptions) {
    // must come before other services are initialized
    this._localDb = new Database();

    this._useProxy = options.useProxy ?? false;
    if (this._useProxy) {
      this._proxyClient = new ProxyClient(
        ENV_VARIABLES.OMNIA_PROXY_URL,
        ENV_VARIABLES.OMNIA_PROXY_WG_ADDRESS,
        this._localDb,
      );
    }

    this.wotServientPort = options.wotServientPort;
    this._wotServient = new Servient();

    this._disableMatterController = options.disableMatterController ?? false;
    if (!this._disableMatterController) {
      this._matterController = new MatterController(
        options.matterControllerChipWsPort,
        options.matterControllerChipToolPath,
      );
    }

    this._standaloneMode = options.standaloneMode ?? false;
    // initialize the IC identity only if we are not in standalone mode
    if (!this._standaloneMode) {
      this._icIdentity = new IcIdentity(options.icIndentitySeedPhrase);
    }
  }

  async start(): Promise<void> {
    if (!this.wotServientPort) {
      throw new Error("WOT_SERVIENT_PORT not set");
    }

    // we must ensure that the data folder exists before starting sub services
    // because they need it to store their data
    this.initializeDataFolder();

    if (this._useProxy) {
      await this._proxyClient.connect();
    }

    if (!this._standaloneMode) {
      // get the IC identity
      const icIdentity = this._icIdentity.getIdentity();

      const customFetch = this._useProxy
        ? this._proxyClient.proxyFetch.bind(this._proxyClient)
        : fetch;

      // the IC agent must be instantiated after the proxy client, because it uses the fetch from proxy client if proxy is enabled
      const omnia_backend = createOmniaBackend({
        agentOptions: {
          host: ENV_VARIABLES.DFX_NETWORK === 'ic' ? 'https://icp0.io' : ENV_VARIABLES.OMNIA_BACKEND_HOST_URL,
          fetch: customFetch,
          identity: icIdentity,
        },
      });
      this._icAgent = new IcAgent(omnia_backend, customFetch);
      await this._icAgent.start();
    }

    if (!this._disableMatterController) {
      await this._matterController.start();
    }

    this._wotServient.addServer(
      new bindingHttp.HttpServer({
        address: "0.0.0.0",
        port: this.wotServientPort,
      }),
    );
    this._wotNamespace = await this._wotServient.start();

    // get TTN temperature, humidity and co2 sensor
    const response = await fetch('https://eu1.cloud.thethings.network/api/v3/applications/smart-home-1234567890/devices', {
      method: 'get',
      headers: {
        'Authorization': 'Bearer NNSXS.SFJFPV2SNZAAR7AHDK2K4KTT4U36RSQSKM37VHI.5JACEQG2JONTOIZKA4NNX5JRKQSMX5FSOT37EN2YWDSRFAQ46R5Q',
        'Accept': 'application/json'
      }
    });
    const data = await response.json() as AppDevices;

    // expose TTN sensor
    this.exposeTtnDevice(data.end_devices[0].ids.device_id);

    // expose HTTP led
    this.exposeHttpDevice();

    console.log("Omnia Gateway started");
  }

  private initializeDataFolder(): void {
    if (!existsSync(DATA_FOLDER)) {
      mkdirSync(DATA_FOLDER);
    }
  }

  async stop(): Promise<void> {
    this._matterController.stop();
    await this._wotServient.shutdown();

    if (this._useProxy) {
      await this._proxyClient.disconnect();
    }
  }

  private async exposeTtnDevice(deviceId: string) {
    const td: WoT.ThingDescription = {
      "@context": [
        "https://www.w3.org/2019/wot/td/v1",
        {
          "@language": "en",
          saref: "https://saref.etsi.org/core/",
        },
      ],
      "@type": ["saref:Device"],
      id: `urn:uuid:${deviceId}`,
      title: deviceId,
      // description: "",
      securityDefinitions: {
        "": {
          scheme: "nosec",
        },
      },
      security: "",
      properties: {
        temperature: {
          type: "number",
          forms: [
            {
              href: ""
            }
          ]
        },
        humidity: {
          type: "number",
          forms: [
            {
              href: ""
            }
          ]
        },
        co2: {
          type: "number",
          forms: [
            {
              href: ""
            }
          ]
        }
      },
      actions: {},
    };

    const ttnWotDevice = new TtnWotDevice(this._wotNamespace, td);

    await ttnWotDevice.startDevice();
  }

  private async exposeHttpDevice() {
    const td: WoT.ThingDescription = {
      "@context": [
        "https://www.w3.org/2019/wot/td/v1",
        {
          "@language": "en",
          saref: "https://saref.etsi.org/core/",
        },
      ],
      "@type": ["saref:Device"],
      id: `urn:uuid:1234567890`,
      title: "1234567890",
      // description: "",
      securityDefinitions: {
        "": {
          scheme: "nosec",
        },
      },
      security: "",
      properties: {},
      actions: {
        setColor: {
          input: {
            type: "string",
          },
          forms: [{
            href: "",
          }]
        }
      },
    };

    const httpWotDevice = new HttpWotDevice(this._wotNamespace, td);

    await httpWotDevice.startDevice();
  }
}
