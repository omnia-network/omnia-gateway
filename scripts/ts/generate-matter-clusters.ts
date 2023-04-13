// this script parses the Matter clusters from the Matter repo
// and puts them in a JSON file, organized by cluster ID

import { config } from "dotenv";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
// import { convert } from "xmlbuilder2";
import { xml2js } from "xml-js";

// we assume this script is called from the root of the project, where the .env file is located
config();

const { CONNECTEDHOMEIP_ROOT = "", OUTPUT_JSON_FILE_PATH = "" } = process.env;

const main = () => {
  const clustersPath = join(
    CONNECTEDHOMEIP_ROOT,
    "src/app/zap-templates/zcl/data-model/chip",
  );

  console.log("Matter models path:", clustersPath);

  /// check if the path to the Matter repo is valid
  if (!existsSync(clustersPath)) {
    console.error("Invalid path to the Matter repo");
    return;
  }

  // check if output file exists
  if (!OUTPUT_JSON_FILE_PATH) {
    console.error("Invalid output file");
    return;
  }

  console.log("Output file:", OUTPUT_JSON_FILE_PATH);

  // get all cluster file names
  const clusterFileNames = readdirSync(clustersPath);

  const jsonClusters = {};

  // for each cluster file, parse it and add it to the final JSON file
  for (const clusterFile of clusterFileNames) {
    console.log("Parsing cluster:", clusterFile);

    const xmlContent = readFileSync(join(clustersPath, clusterFile), "utf8");
    const jsonContent = xml2js(xmlContent, {
      compact: true,
      attributesFn: (attributes, parent) => {
        Object.assign(parent, attributes || {});
        return undefined;
      },
    });

    if (!jsonContent["configurator"]) {
      console.warn(`\tNo configurator for file: ${clusterFile}, skipping...`);
      continue;
    }

    const cluster = jsonContent["configurator"]["cluster"];
    if (!cluster) {
      console.warn(`\tNo cluster for file: ${clusterFile}, skipping...`);
      continue;
    }

    const rawClusterCode = cluster["code"];
    if (!rawClusterCode || !rawClusterCode["_text"]) {
      console.warn(`\tNo cluster code for file: ${clusterFile}, skipping...`);
      continue;
    }

    const clusterId = parseInt(rawClusterCode["_text"], 16);
    if (isNaN(clusterId)) {
      console.warn(
        `\tInvalid cluster ID for file: ${clusterFile}, skipping...`,
      );
      continue;
    }

    if (!cluster["attribute"] && !cluster["command"]) {
      console.warn(
        `\tNo attributes and commands for file: ${clusterFile}, skipping...`,
      );
      continue;
    }

    // all keys have a format similar to:
    // "key": {"_text": "value"}
    // "key": {"_attributes": {"key": "value"}}
    // "key": {"_text": "value", "_attributes": {"key": "value"}}
    jsonClusters[clusterId] = cluster;
  }

  // write the final JSON file
  writeFileSync(OUTPUT_JSON_FILE_PATH, JSON.stringify(jsonClusters, null, 2));

  console.log("Done");
};

main();
