// eslint-disable-next-line import/named
import { ActorSubclass } from "@dfinity/agent";
// eslint-disable-next-line import/named
import { _SERVICE } from "../canisters/omnia_backend/omnia_backend.did.js";
import { httpNonceChallenge } from "../utils/nonce-challenge.js";

export class IcAgent {
  private _actor: ActorSubclass<_SERVICE>;

  constructor(actor: ActorSubclass<_SERVICE>) {
    this._actor = actor;
  }

  async start() {
    const initGatewayRes = await callMethodWithChallenge((nonce) => {
      return this._actor.initGateway(nonce);
    }, "localhost");
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
  }

  async registerDevice(): Promise<string | undefined> {
    try {
      const deviceRegistrationResult = await callMethodWithChallenge(
        (nonce) => {
          return this._actor.registerDevice(nonce);
        },
        "localhost",
      );
      if ("Ok" in deviceRegistrationResult) {
        return deviceRegistrationResult.Ok.device_uid;
      }
      throw new Error(deviceRegistrationResult.Err);
    } catch (error) {
      console.error("Error registering device:", error);
    }
  }
}

const callMethodWithChallenge = async <T>(
  callback: (nonce: string) => Promise<T>,
  remoteIp: string,
): Promise<T> => {
  const nonce = await httpNonceChallenge(remoteIp);
  return callback(nonce);
};
