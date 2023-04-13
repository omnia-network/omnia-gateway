import { ActorSubclass } from "@dfinity/agent";
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
    }, "ciao");
    console.log(initGatewayRes);
  }
}

const callMethodWithChallenge = async <T>(
  callback: (nonce: string) => Promise<T>,
  remoteIp: string,
): Promise<T> => {
  const nonce = await httpNonceChallenge(remoteIp);
  return callback(nonce);
};
