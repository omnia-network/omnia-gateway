export type CHIPValue = string | number | boolean | null;

export type CHIPData = Record<string, unknown | Array<unknown>>;

export type CHIPParsedResult = Array<CHIPData>;

export type CHIPWSResult = {
  error: "FAILURE";
};

export type CHIPWSLog = {
  /**
   * The CHIP module that generated the log
   */
  module: "TOO" | "CSM" | "DIS" | "DMG" | "EM" | "IN";
  category: "Info" | "Debug" | "Error";
  /**
   * The log message, `base64` encoded
   */
  message: string;
};

/**
 * The WebSocket message sent by the `chip-tool`.
 * Types from {@link https://github.com/project-chip/connectedhomeip/blob/1f8138495a3bc85d2539779c8284ea0f848bc080/examples/chip-tool/commands/interactive/InteractiveCommands.cpp#L105 connectedhomeip/examples/chip-tool}
 */
export type CHIPWSMessage = {
  results: Array<CHIPWSResult>;
  logs: Array<CHIPWSLog>;
};

export type CHIPGenericCommandId = number;
