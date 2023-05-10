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
export const generateThingDescription = (
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
 * Get SAREF properties and actions for a Matter cluster. E.g.: a device with Matter cluster `6` can have this affordances:
 * ```
 * properties: ["OnOffState", ...],
 * actions: ["OnCommand", "OffCommand", ...],
 * ...
 * ```
 * @param clusterId the Matter cluster ID
 * @returns an object with `properties` and `actions` arrays
 */
export const getMatterClusterAffordances = (
  clusterId: string,
): {
  properties: string[];
  actions: string[];
} => {
  const cluster = getMappedCluster(clusterId);
  const ontologiesTypes = {
    properties: new Set<string>(),
    actions: new Set<string>(),
  };

  for (const propertyId in cluster.properties) {
    const property = cluster.properties[propertyId];
    for (const attribute of property.uriVariables.attribute.oneOf) {
      if (attribute["@type"]) {
        if (typeof attribute["@type"] === "string") {
          ontologiesTypes.properties.add(attribute["@type"]);
        } else {
          attribute["@type"].forEach((type) =>
            ontologiesTypes.properties.add(type),
          );
        }
      }
    }
  }

  for (const actionId in cluster.actions) {
    const action = cluster.actions[actionId];
    for (const command of action.input.properties.command.oneOf) {
      if (command["@type"]) {
        if (typeof command["@type"] === "string") {
          ontologiesTypes.actions.add(command["@type"]);
        } else {
          command["@type"].forEach((type) => ontologiesTypes.actions.add(type));
        }
      }
    }
  }

  return {
    properties: Array.from(ontologiesTypes.properties),
    actions: Array.from(ontologiesTypes.actions),
  };
};
