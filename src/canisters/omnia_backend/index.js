import { Actor, HttpAgent, fromHex } from "@dfinity/agent";
import fetch from "node-fetch";
import { ENV_VARIABLES } from "../../constants/environment.js";

// Imports and re-exports candid interface
import { idlFactory } from "./omnia_backend.did.js";
export { idlFactory } from "./omnia_backend.did.js";

export const canisterId = ENV_VARIABLES.OMNIA_BACKEND_CANISTER_ID;

/**
 * @param {string | import("@dfinity/principal").Principal} canisterId Canister ID of Agent
 * @param {{agentOptions?: import("@dfinity/agent").HttpAgentOptions; actorOptions?: import("@dfinity/agent").ActorConfig} | { agent?: import("@dfinity/agent").Agent; actorOptions?: import("@dfinity/agent").ActorConfig }} [options]
 * @return {import("@dfinity/agent").ActorSubclass<import("./omnia_backend.did")._SERVICE>}
 */
export const createActor = (options = {}) => {
  const agent =
    options.agent ||
    new HttpAgent(options.agentOptions);

  // Fetch root key for certificate validation during development
  if (ENV_VARIABLES.DFX_NETWORK !== "ic") {
    // use env root key if calling a replica not running on localhost
    // otherwise, fetch the root key from the local replica
    if (ENV_VARIABLES.OMNIA_BACKEND_ROOT_KEY_HEX) {
      agent.rootKey = fromHex(ENV_VARIABLES.OMNIA_BACKEND_ROOT_KEY_HEX);
    } else {
      agent
        .fetchRootKey()
        // uncomment the following block to print the local root key. Paste it in the OMNIA_BACKEND_ROOT_KEY_HEX env variable
        // .then((root_key) => {
        //   console.log([...new Uint8Array(root_key)]
        //     .map(x => x.toString(16).padStart(2, '0'))
        //     .join('')
        //   )
        // })
        .catch((err) => {
          console.warn(
            "Unable to fetch root key. Check to ensure that your local replica is running",
          );
          console.error(err);
        });
    }
  }

  // Creates an actor with using the candid interface and the HttpAgent
  return Actor.createActor(idlFactory, {
    agent,
    canisterId,
    ...(options ? options.actorOptions : {}),
  });
};

/**
 * An agent creator for omnia_backend canister, with customizable agentOptions
 * @param {import("@dfinity/agent").HttpAgentOptions} [agentOptions]
 * @returns {import("@dfinity/agent").ActorSubclass<import("./omnia_backend.did")._SERVICE>}
 */
export const createOmniaBackend = createActor;
