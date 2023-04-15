import { DataSchema, DataSchemaType } from "wot-thing-model-types";

export type AttributeDataSchema = DataSchema & {
  /**
   * Must be of type `integer`
   */
  type?: DataSchemaType;
};

export type CommandDataSchema = DataSchema & {
  /**
   * Must be of type `object`
   */
  type?: DataSchemaType;
  title: string;
  description?: string;
  properties: {
    id: {
      /**
       * Must be of type `integer`
       */
      type: DataSchemaType;
      const: number;
    };
    payload?: {
      /**
       * Must be of type `object`
       */
      type: DataSchemaType;
      properties: {
        [key: string]: DataSchema;
      };
    };
  };
};

export type MatterWotMapping = {
  [key: string]: {
    properties: {
      [key: string]: {
        title: string;
        description?: string;
        uriVariables: {
          attribute: {
            /**
             * Must be of type `integer`
             */
            type: DataSchemaType;
            description: string;
            oneOf: Array<AttributeDataSchema>;
          };
        };
      };
    };
    actions: {
      [key: string]: {
        title: string;
        description?: string;
        input: {
          type: DataSchemaType;
          properties: {
            command: {
              /**
               * Must be of type `object`
               */
              type: DataSchemaType;
              description: string;
              oneOf: Array<CommandDataSchema>;
            };
          };
        };
      };
    };
  };
};

/**
 * The URI variables received by the WoT Property handler of a MatterWoT device.
 */
export type WotPropertyHandlerAttribute = {
  attribute: number;
};

/**
 * The body received by the WoT Action handler of a MatterWoT device.
 */
export type WotActionHandlerCommand = {
  command: {
    id: number;
    payload?: Record<string, unknown>;
  };
};
