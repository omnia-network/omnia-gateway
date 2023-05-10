// eslint-disable-next-line import/named
import { ActorSubclass } from "@dfinity/agent";
import fetch from "node-fetch";
import {
  DeviceAffordances,
  _SERVICE,
} from "../canisters/omnia_backend/omnia_backend.did";
import { httpNonceChallenge } from "../utils/nonce-challenge.js";

export class IcAgent {
  actor: ActorSubclass<_SERVICE>;
  private _fetch: typeof fetch;

  // TODO: add a logger instance for the IcAgent

  constructor(actor: ActorSubclass<_SERVICE>, customFetch: typeof fetch) {
    this.actor = actor;
    this._fetch = customFetch;
  }

  async start() {
    const initGatewayRes = await callMethodWithChallenge((nonce) => {
      return this.actor.initGateway(nonce);
    }, this._fetch);
    console.log("Gateway principal ID: ", initGatewayRes);
  }

  async pollForUpdates(): Promise<
    | {
        nodeId: number;
        payload: string;
      }
    | undefined
  > {
    try {
      // TODO: the gateway should send requests to a canister query endpoint and get the update id
      // only if there are updates, then fetch the updates from the canister update endpoint
      const updates = await this.actor.getGatewayUpdates();
      if (updates.length != 0 && updates[0].command == "pair") {
        const nodeId = Math.floor(Math.random() * 65525) + 1;
        const payload = updates[0].info.payload;
        const managerPrincipalId = updates[0].virtual_persona_principal_id;

        console.log(`Manager: ${managerPrincipalId} pairing new device`);
        const pairingInfo = {
          nodeId: nodeId,
          payload: payload,
        };
        return pairingInfo;
      }
    } catch (error) {
      console.error("Error fetching updates:", error);
    }
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
      console.error("Error registering device:", error);
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
