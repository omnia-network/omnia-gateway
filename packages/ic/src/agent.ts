import { EventEmitter } from "events";
// eslint-disable-next-line import/named
import { ActorSubclass } from "@dfinity/agent";
import { getLogger } from "@omnia-gateway/core";
import fetch from "node-fetch";
import { createOmniaBackend } from "./canisters/omnia_backend/index.js";
import {
  DeviceAffordances,
  UpdateValue,
  _SERVICE,
} from "./canisters/omnia_backend/omnia_backend.did";
import { IcIdentity } from "./identity.js";
import { getUrl, httpNonceChallenge } from "./utils.js";

export type IcUpdate = UpdateValue;

declare interface IcUpdatesEmitter {
  emit(event: "update", payload: IcUpdate): boolean;
  on(event: "update", listener: (payload: IcUpdate) => void): this;
}

class IcUpdatesEmitter extends EventEmitter {
  constructor() {
    super();
  }
}

export class IcAgent {
  actor: ActorSubclass<_SERVICE>;
  private _identity: IcIdentity;
  private _fetch: typeof fetch;

  updates: IcUpdatesEmitter;
  updatesInterval: NodeJS.Timer | undefined;

  private logger = getLogger("IcAgent");

  constructor(customFetch: typeof fetch) {
    this._fetch = customFetch;
    this._identity = new IcIdentity();
    this.actor = createOmniaBackend({
      agentOptions: {
        host: getUrl().href,
        fetch: customFetch,
        identity: this._identity.getIdentity(),
      },
    });

    this.updates = new IcUpdatesEmitter();
  }

  async start() {
    const initGatewayRes = await callMethodWithChallenge((nonce) => {
      return this.actor.initGateway(nonce);
    }, this._fetch);

    if ("Ok" in initGatewayRes) {
      this.logger.info("Gateway initialized");
    } else {
      throw new Error(initGatewayRes.Err);
    }
  }

  pollForUpdates() {
    this.updatesInterval = setInterval(async () => {
      try {
        // TODO: the gateway should send requests to a canister query endpoint and get the update id
        // only if there are updates, then fetch the updates from the canister update endpoint
        const updates = await this.actor.getGatewayUpdates();
        if (updates.length != 0 && updates[0].command == "pair") {
          const managerPrincipalId = updates[0].virtual_persona_principal_id;

          this.logger.debug(`Manager ${managerPrincipalId}: received update`);

          this.updates.emit("update", updates[0]);
        }
      } catch (error) {
        this.logger.error(`Error fetching updates: ${error}`);
      }
    }, 5000);
  }

  async registerDevice(
    affordances: DeviceAffordances,
  ): Promise<string | undefined> {
    try {
      const deviceRegistrationResult = await callMethodWithChallenge(
        (nonce) => {
          return this.actor.registerDevice(nonce, affordances);
        },
        this._fetch,
      );
      if ("Ok" in deviceRegistrationResult) {
        return deviceRegistrationResult.Ok[0].device_uid;
      }
      throw new Error(deviceRegistrationResult.Err);
    } catch (error) {
      this.logger.error(`Error registering device: ${error}`);
    }
  }

  async stop() {
    if (this.updatesInterval) {
      clearInterval(this.updatesInterval);
    }

    if (this.updates) {
      this.updates.removeAllListeners();
    }
  }
}

const callMethodWithChallenge = async <T>(
  callback: (nonce: string) => Promise<T>,
  customFetch: typeof fetch,
): Promise<T> => {
  const nonce = await httpNonceChallenge(customFetch);
  return callback(nonce);
};
