import { readFileSync } from "fs";
import * as WoT from "wot-typescript-definitions";
import type { DbMatterClusters, MatterWotMapping } from "../models";

const mapping: MatterWotMapping = JSON.parse(
  readFileSync("./matter/wot-mapping.json", "utf8"),
);

export const getMappedCluster = (
  clusterId: string,
): MatterWotMapping[string] => {
  return mapping[clusterId];
};

/**
 * Generate a Thing Model for a Matter device
 */
export const generateThingModel = (
  deviceId: string,
  matterClusters: DbMatterClusters,
): WoT.ThingDescription => {
  const model: WoT.ThingDescription = {
    "@context": [
      "https://www.w3.org/2019/wot/td/v1",
      {
        "@language": "en",
        saref: "https://saref.etsi.org/core/",
      },
    ],
    "@type": ["saref:Device"],
    id: `urn:uuid:${deviceId}`,
    title: deviceId,
    // description: "",
    securityDefinitions: {
      "": {
        scheme: "nosec",
      },
    },
    security: "",
    properties: {},
    actions: {},
  };

  for (const clusterId in matterClusters) {
    const mappedCluster = getMappedCluster(clusterId);

    Object.assign(model.properties!, mappedCluster.properties);
    Object.assign(model.actions!, mappedCluster.actions);
  }

  return model;
};

/**
 * Get the ontologies implemented in this Matter cluster. E.g. cluster `6` (On/Off) implements `saref:Light`.
 * @param clusterId the Matter cluster ID
 * @returns {string[]} the array of ontologies implemented in this Matter cluster
 */
export const getMatterClusterOntologies = (clusterId: string): string[] => {
  const cluster = getMappedCluster(clusterId);
  const ontologiesTypes = new Set<string>();

  for (const propertyId in cluster.properties) {
    const property = cluster.properties[propertyId];
    if (property["@type"]) {
      if (typeof property["@type"] === "string") {
        ontologiesTypes.add(property["@type"]);
      } else {
        property["@type"].forEach((type) => ontologiesTypes.add(type));
      }
    }
  }

  for (const actionId in cluster.actions) {
    const action = cluster.actions[actionId];
    if (action["@type"]) {
      if (typeof action["@type"] === "string") {
        ontologiesTypes.add(action["@type"]);
      } else {
        action["@type"].forEach((type) => ontologiesTypes.add(type));
      }
    }
  }

  return Array.from(ontologiesTypes);
};
