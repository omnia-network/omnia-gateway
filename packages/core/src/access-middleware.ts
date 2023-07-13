import bindingHttp from "@node-wot/binding-http";

export type MiddlewareRequestHandlerArgs =
  Parameters<bindingHttp.MiddlewareRequestHandler>;
export type MiddlewareRequestHandlerReturn =
  ReturnType<bindingHttp.MiddlewareRequestHandler>;

/**
 * The base implementation for the HTTP middleware.
 * **NOTE**: this is just an interface that must be used as a guideline for the actual middleware implementation.
 */
export interface BaseAccessKeysMiddleware {
  /**
   * Initializes the middleware, for example by loading the access keys from the local database.
   * This method should be called once, when the server starts.
   * @returns a promise that resolves when the initialization is complete.
   */
  init(): Promise<void>;

  /**
   * Runs the logic to verify the access keys and eventually return the appropriate HTTP error.
   */
  handler(
    ...args: MiddlewareRequestHandlerArgs
  ): MiddlewareRequestHandlerReturn;

  /**
   * (OPTIONAL) Stops the middleware, for example by stopping the periodic checks.
   * This method should be called once, when the server stops.
   */
  stop?(): Promise<void>;
}
