import dotenv from "dotenv";

dotenv.config();

export const ENV_VARIABLES = {
  STANDALONE_MODE: process.env.STANDALONE_MODE === "true", // default to false
  EXPOSE_SIMPLE_DEVICE: process.env.EXPOSE_SIMPLE_DEVICE === "true", // default to false

  OMNIA_BACKEND_CANISTER_ID: process.env.OMNIA_BACKEND_CANISTER_ID || "",
  OMNIA_BACKEND_HOST_URL: process.env.OMNIA_BACKEND_HOST_URL || "",
  OMNIA_BACKEND_ROOT_KEY_HEX: process.env.OMNIA_BACKEND_ROOT_KEY_HEX || "",
  DFX_NETWORK: process.env.DFX_NETWORK || "",

  MATTER_CONTROLLER_CHIP_WS_PORT:
    process.env.MATTER_CONTROLLER_CHIP_WS_PORT || "",
  MATTER_CONTROLLER_CHIP_TOOL_PATH:
    process.env.MATTER_CONTROLLER_CHIP_TOOL_PATH || "",
  ENABLE_MATTER_CONTROLLER: process.env.ENABLE_MATTER_CONTROLLER === "true", // default to false

  WIFI_SSID: process.env.WIFI_SSID || "",
  WIFI_PASSWORD: process.env.WIFI_PASSWORD || "",

  SERVIENT_PORT: process.env.SERVIENT_PORT || "",

  ENABLE_PROXY: process.env.ENABLE_PROXY === "true", // default to false
  OMNIA_PROXY_URL: process.env.OMNIA_PROXY_URL || "",
  OMNIA_PROXY_WG_ADDRESS: process.env.OMNIA_PROXY_WG_ADDRESS || "",
};
