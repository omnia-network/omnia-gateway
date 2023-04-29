import { ThingDescription } from "wot-thing-description-types";
import {
  generateThingDescription,
  getMatterClustersAffordances,
} from "../../../src/utils/matter-wot-mapping";

describe("Matter WoT mapping", () => {
  it("maps cluster to affordances", async () => {
    // On/Off Matter cluster is the one with more affordances
    const affordances = getMatterClustersAffordances("6");

    expect(affordances).toEqual([
      ["td:hasPropertyAffordance", "saref:OnOffState"],
      ["td:hasActionAffordance", "saref:OffCommand"],
      ["td:hasActionAffordance", "saref:OnCommand"],
      ["td:hasActionAffordance", "saref:ToggleCommand"],
    ]);
  });

  it("generates a Thing Description", () => {
    const deviceId = "device-id";
    const td = generateThingDescription(deviceId, {
      6: {
        clusterId: 6, // On/Off
        endpointId: 1, // random
      },
      8: {
        clusterId: 8, // Level Control
        endpointId: 1, // random
      },
    });

    expect(td).toMatchObject<ThingDescription>({
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
      properties: {
        "6": expect.any(Object),
        "8": expect.any(Object),
      },
      actions: {
        "6": expect.any(Object),
        "8": expect.any(Object),
      },
    });
    expect(td.properties!["6"].uriVariables).toHaveProperty("attribute");
    expect(td.properties!["8"].uriVariables).toHaveProperty("attribute");
    expect(td.actions!["6"].input!.properties).toHaveProperty("command");
    expect(td.actions!["8"].input!.properties).toHaveProperty("command");

    // TODO: dive deeper into the TD to check if it's correct
  });
});
