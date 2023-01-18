import dotenv from "dotenv";

dotenv.config();

export const ENV_VARIABLES = {
  OMNIA_BACKEND_CANISTER_ID: process.env["OMNIA_BACKEND_CANISTER_ID"],
  OMNIA_BACKEND_HOST_URL: process.env["OMNIA_BACKEND_HOST_URL"],
  OMNIA_BACKEND_ROOT_KEY_HEX: process.env["OMNIA_BACKEND_ROOT_KEY_HEX"],
  DFX_NETWORK: process.env["DFX_NETWORK"],
};
