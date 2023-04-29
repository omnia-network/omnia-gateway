import {
  DataSchema,
  DataSchemaType,
  TypeDeclaration,
} from "wot-thing-description-types";

// override some keys to specify how the schema must be

export type AttributeDataSchema = DataSchema & {
  /**
   * Must be of type `integer`
   */
  type?: Extract<DataSchemaType, "integer">;
};

export type CommandDataSchema = DataSchema & {
  /**
   * Must be of type `object`
   */
  type?: Extract<DataSchemaType, "object">;
  properties: DataSchema & {
    id: DataSchema & {
      /**
       * Must be of type `integer`
       */
      type: Extract<DataSchemaType, "integer">;
      const: number;
    };
    payload?: DataSchema & {
      /**
       * Must be of type `object`
       */
      type: Extract<DataSchemaType, "object">;
    };
  };
};

/**
 * The `key` index is the Matter cluster ID
 */
export type MatterWotMapping = {
  [key: string]: {
    /**
     * The `key` index is the Matter cluster ID
     */
    properties: {
      [key: string]: DataSchema & {
        uriVariables: {
          attribute: DataSchema & {
            /**
             * Must be of type `integer`
             */
            type: Extract<DataSchemaType, "integer">;
            oneOf: Array<AttributeDataSchema>;
          };
        };
      };
    };
    /**
     * The `key` index is the Matter cluster ID
     */
    actions: {
      [key: string]: DataSchema & {
        input: {
          type: DataSchemaType;
          properties: {
            command: DataSchema & {
              /**
               * Must be of type `object`
               */
              type: Extract<DataSchemaType, "object">;
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

export type MatterOntologiesMapping = {
  [clusterId: string]: {
    attributes: {
      [attributeId: number]: {
        "@type": TypeDeclaration;
      };
    };
    commands: {
      [commandId: number]: {
        "@type": TypeDeclaration;
      };
    };
  };
};
