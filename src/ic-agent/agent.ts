// eslint-disable-next-line import/named
import { ActorSubclass } from "@dfinity/agent";
import fetch from "node-fetch";
// eslint-disable-next-line import/named
import { _SERVICE } from "../canisters/omnia_backend/omnia_backend.did.js";
import { httpNonceChallenge } from "../utils/nonce-challenge.js";

export class IcAgent {
  private _actor: ActorSubclass<_SERVICE>;
  private _fetch: typeof fetch;

  constructor(actor: ActorSubclass<_SERVICE>, customFetch: typeof fetch) {
    this._actor = actor;
    this._fetch = customFetch;
  }

  async start() {
    const initGatewayRes = await callMethodWithChallenge((nonce) => {
      return this._actor.initGateway(nonce);
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
      const updates = await this._actor.getGatewayUpdates();
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
    return;
  }
}

const callMethodWithChallenge = async <T>(
  callback: (nonce: string) => Promise<T>,
  customFetch: typeof fetch,
): Promise<T> => {
  const nonce = await httpNonceChallenge(customFetch);
  return callback(nonce);
};
