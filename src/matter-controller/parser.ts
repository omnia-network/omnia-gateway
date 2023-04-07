import type { CHIPData, CHIPParsedResult, CHIPValue, CHIPWSMessage } from "../models";

export const serializeResult = (result: CHIPParsedResult): string => {
  return JSON.stringify(result, null, 2);
};

const splitAtFirstChar = (toSplit: string, char: string): Array<string> => {
  const charIndex = toSplit.indexOf(char); // Find the index of the first char

  if (charIndex === -1) {
    return [toSplit];
  }

  const key = toSplit.slice(0, charIndex).trim(); // Extract the key before char
  const value = toSplit.slice(charIndex + 1).trim(); // Extract the value after char

  return [key, value];
};

const parseScalarValue = (value: string): CHIPValue => {
  if (value === undefined || value === null) {
    return null;
  }

  // some values are <value> (something)
  // we want to remove the (something)
  value = value.split("(")[0];

  // remove the quotes
  value = value.replace(/"/g, "");

  if (value === "true" || value === "false") {
    // If the value is a boolean, parse it to boolean
    return value === "true";
  } else if (value.startsWith("0x")) {
    // If the value is a hex string, treat it as a string
    return value;
  } else if (!isNaN(parseFloat(value))) {
    // If the value is a float, parse it to float
    return parseFloat(value);
  } else if (value.toLowerCase() === "null") {
    // If the value is null, return null
    return null;
  }

  // Otherwise, treat it as a string
  return value;
};

const parseCHIPResultToJSON = (
  inputString: string,
  arrayToFill: Array<unknown> = null,
): CHIPData => {
  const parsedJSON: CHIPData = {};

  inputString = inputString.replace(/[\n\s]/g, ""); // Remove all newlines and spaces

  const [key, value] = splitAtFirstChar(inputString, "=");

  // console.log(key, value);

  if (key === "") {
    if (value) {
      return parseCHIPResultToJSON(value);
    }
  }

  if (value.startsWith("{")) {
    // If the value is a sub-object, recursively parse it
    // count the number of "{" and "}" and find the index of the closing "}"
    // don't ignore the value after the closing "}" because it might be another key-value pair
    let openBrackets = 1;
    let closeBrackets = 0;
    let index = 1;
    while (openBrackets !== closeBrackets) {
      if (value[index] === "{") {
        openBrackets++;
      } else if (value[index] === "}") {
        closeBrackets++;
      }
      index++;
    }

    if (arrayToFill !== null) {
      arrayToFill.push(parseCHIPResultToJSON(value.slice(1, index - 1)));
    } else {
      parsedJSON[key] = parseCHIPResultToJSON(value.slice(1, index - 1));
    }

    if (value[index] === "," && value.slice(index + 1) !== "") {
      if (arrayToFill !== null) {
        parseCHIPResultToJSON(value.slice(index + 1), arrayToFill);
      } else {
        Object.assign(
          parsedJSON,
          parseCHIPResultToJSON(value.slice(index + 1)),
        );
      }
    } else if (value.slice(index) !== "" && value.slice(index) !== ",") {
      if (arrayToFill !== null) {
        parseCHIPResultToJSON(value.slice(index), arrayToFill);
      } else {
        Object.assign(parsedJSON, parseCHIPResultToJSON(value.slice(index)));
      }
    }
  } else if (value.startsWith("[")) {
    // If the value is an array, split it by "," and parse each element recursively
    // count the number of "[" and "]" and find the index of the closing "]"
    // don't ignore the value after the closing "]" because it might be another key-value pair
    let openBrackets = 1;
    let closeBrackets = 0;
    let index = 1;
    while (openBrackets !== closeBrackets) {
      if (value[index] === "[") {
        openBrackets++;
      } else if (value[index] === "]") {
        closeBrackets++;
      }
      index++;
    }

    const arrayContent = value.slice(1, index - 1);

    if (arrayContent === "") {
      parsedJSON[key] = [];
    } else if (
      arrayContent
        .split(",")
        .filter((el) => !!el)
        .filter((element) => !element.startsWith("0x")).length === 0
    ) {
      parsedJSON[key] = arrayContent
        .split(",")
        .map((element) => parseScalarValue(element));
    } else {
      parsedJSON[key] = [];
      parseCHIPResultToJSON(
        value.slice(1, index - 1),
        parsedJSON[key] as Array<unknown>,
      );

      if (value[index] === "," && value.slice(index + 1) !== "") {
        Object.assign(
          parsedJSON,
          parseCHIPResultToJSON(value.slice(index + 1)),
        );
      }
    }
  } else {
    // If the value is a scalar value, parse it and do recursion on the rest of the string
    const elements = splitAtFirstChar(value, ",");

    parsedJSON[key] = parseScalarValue(elements[0]);

    if (elements.length > 1 && elements[1] !== "") {
      Object.assign(parsedJSON, parseCHIPResultToJSON(elements[1]));
    }
  }

  return parsedJSON;
};

const INITIAL_DATA_MARKERS = ["InvokeResponseMessage =", "ReportDataMessage ="];

export const resultParser = (result: string): CHIPParsedResult => {
  let isData = false;
  let rawData = "";

  const results: CHIPParsedResult = [];

  for (const line of result.split("\n")) {
    if (isData) {
      rawData += line.replace(/[\n\s]/g, "");
    }

    // check if this line contains one of the initial data markers
    if (INITIAL_DATA_MARKERS.includes(line)) {
      isData = true;
      rawData += line.replace(/[\n\s]/g, "");
    } else if (line === "}" || line === "},") {
      isData = false;

      const parsedResult = parseCHIPResultToJSON(rawData);
      results.push(parsedResult);

      rawData = "";
    }
  }

  return results;
};

export const filterLogs = (logs: CHIPWSMessage["logs"]): CHIPWSMessage["logs"] => {
  return logs.filter((log) => log.module === "DMG");
};

export const decodeLogs = (logs: CHIPWSMessage["logs"]): string => {
  return logs.map((log) => Buffer.from(log.message, "base64").toString()).join("\n")
}
