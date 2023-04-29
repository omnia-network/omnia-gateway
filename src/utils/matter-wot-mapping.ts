import { readFileSync } from "fs";
import * as WoT from "wot-typescript-definitions";
import type { DbMatterClusters, MatterWotMapping } from "../models";

const mapping: MatterWotMapping = JSON.parse(
  readFileSync("./matter/wot-mapping.json", "utf8"),
);

const getMappedCluster = (clusterId: string): MatterWotMapping[string] => {
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
