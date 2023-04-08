import {
  parseWebSocketMessage,
  parseCHIPMessage,
} from "../../../src/matter-controller/parser";
import {
  expectedEmptyParsedMessage,
  rawEmptyMessage,
} from "./ws-messages/empty";
import {
  expectedOnOffParsedMessage,
  rawOnOffMessage,
} from "./ws-messages/onoff";
import {
  expectedPairingParsedMessage,
  rawPairingMessage,
} from "./ws-messages/pairing";

describe("Matter Controller: websocket parser", () => {
  it("should parse the websocket message (empty data)", async () => {
    const parsedWSMessage = parseWebSocketMessage(rawEmptyMessage);
    const parsedResult = parseCHIPMessage(parsedWSMessage);

    expect(parsedResult).toEqual(expectedEmptyParsedMessage);
  });
  it("should parse the websocket message (with pairing data)", async () => {
    const parsedWSMessage = parseWebSocketMessage(rawPairingMessage);
    const parsedResult = parseCHIPMessage(parsedWSMessage);

    expect(parsedResult).toEqual(expectedPairingParsedMessage);
  });
  it("should parse the websocket message (with command data)", async () => {
    const parsedWSMessage = parseWebSocketMessage(rawOnOffMessage);
    const parsedResult = parseCHIPMessage(parsedWSMessage);

    expect(parsedResult).toEqual(expectedOnOffParsedMessage);
  });
});
