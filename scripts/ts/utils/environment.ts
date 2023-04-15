import { config } from "dotenv";

// we assume this script is called from the root of the project, where the .env file is located
config();

export const {
  CONNECTEDHOMEIP_ROOT = "",
  OUTPUT_JSON_FILE_PATH = "",
  CLUSTERS_JSON_FILE_PATH = "",
  MATTER_WOT_MAPPING_FILE_PATH = "",
} = process.env;
