import EventEmitter from "events";
import { Principal } from "@dfinity/principal";
import bindingHttp from "@node-wot/binding-http";
import { IcAgent } from "../ic-agent/agent.js";
import { IncomingAccessKey } from "../models/local-db";
import { Database } from "./local-db.js";
import { getLogger } from "./logger.js";

type MiddlewareRequestHandlerArgs =
  Parameters<bindingHttp.MiddlewareRequestHandler>;
type MiddlewareRequestHandlerReturn =
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

const MISSING_OR_INVALID_HEADER_STATUS_CODE = 400;
const UNAUTHORIZED_STATUS_CODE = 401;

type IcAccessKeysMiddlewareParams = {
  icAgent: IcAgent;
  localDb: Database;
};

/**
 * Manages the access keys by verifying the keys against the Omnia Backend, using the IC Agent.
 */
export class IcAccessKeysMiddleware implements BaseAccessKeysMiddleware {
  private _icAgent: IcAgent;
  private _localDb: Database;

  private _checkEmitter: EventEmitter;
  private _checkInterval: NodeJS.Timeout | undefined;

  private logger = getLogger("IcAccessKeysMiddleware");

  constructor(params: IcAccessKeysMiddlewareParams) {
    this._icAgent = params.icAgent;
    this._localDb = params.localDb;
    this._checkEmitter = new EventEmitter();
  }

  /**
   * Initializes the checker that will periodically query the Omnia Backend to check the access keys.
   */
  async init() {
    this.logger.info("Initializing the IcAccessKeysMiddleware...");

    this._checkEmitter.on("check", this.verifyAccessKeys.bind(this));

    this._checkInterval = setInterval(() => {
      this._checkEmitter.emit("check");
    }, 1000 * 30);
  }

  async stop() {
    this.logger.info("Stopping the IcAccessKeysMiddleware...");
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
    }
    this._checkEmitter.removeAllListeners();
  }

  async handler(...[req, res, next]: MiddlewareRequestHandlerArgs) {
    // check if all headers are present
    const requestAccessKey = req.headers["X-Omnia-Access-Key"];
    if (!requestAccessKey || typeof requestAccessKey !== "string") {
      this.logger.warn("X-Omnia-Access-Key header is missing or invalid");
      res.statusCode = MISSING_OR_INVALID_HEADER_STATUS_CODE;
      res.end("X-Omnia-Access-Key header is missing or invalid");
      return;
    }

    const rawNonce = parseInt(
      req.headers["X-Omnia-Access-Key-Nonce"] as string,
    );
    if (isNaN(rawNonce)) {
      this.logger.warn("X-Omnia-Access-Key-Nonce is missing or invalid");
      res.statusCode = MISSING_OR_INVALID_HEADER_STATUS_CODE;
      res.end("X-Omnia-Access-Key-Nonce is missing or invalid");
      return;
    }
    const requestAccessKeyNonce = BigInt(rawNonce);

    const requestAccessKeySignature =
      req.headers["X-Omnia-Access-Key-Signature"];
    if (
      !requestAccessKeySignature ||
      typeof requestAccessKeySignature !== "string"
    ) {
      this.logger.warn("X-Omnia-Access-Key-Signature is missing or invalid");
      res.statusCode = MISSING_OR_INVALID_HEADER_STATUS_CODE;
      res.end("X-Omnia-Access-Key-Signature is missing or invalid");
      return;
    }

    const requestCanisterId = req.headers["X-IC-Canister-Id"];
    if (!requestCanisterId || typeof requestCanisterId !== "string") {
      this.logger.warn("X-IC-Canister-Id is missing or invalid");
      res.statusCode = MISSING_OR_INVALID_HEADER_STATUS_CODE;
      res.end("X-IC-Canister-Id is missing or invalid");
      return;
    }

    const accessKey: IncomingAccessKey = {
      key: requestAccessKey,
      nonce: requestAccessKeyNonce,
      signature: requestAccessKeySignature,
      receivedAt: new Date().getTime(),
      metadata: {
        canisterId: req.headers["X-Omnia-Access-Key-Canister-Id"] as string,
      },
    };

    // check if the access key has already been allowed
    const allowed = await this._localDb.getAccessKeys("allowed");
    if (allowed[requestAccessKey]) {
      const incoming = await this._localDb.getAccessKeys("incoming");

      // a check to avoid simple replay attacks
      if (
        incoming[requestAccessKey] &&
        incoming[requestAccessKey].find(
          (ak) => ak.nonce === requestAccessKeyNonce,
        )
      ) {
        this.logger.warn("Access key already used");
        res.statusCode = UNAUTHORIZED_STATUS_CODE;
        res.end("Access key already used");
        return;
      }

      // store the access key as incoming
      if (!incoming[requestAccessKey]) {
        incoming[requestAccessKey] = [];
      }

      incoming[requestAccessKey].push(accessKey);
      await this._localDb.storeAccessKeys("incoming", incoming);
    } else {
      const verified = await this.verifyAccessKey(accessKey);
      if (!verified) {
        this.logger.warn("Access key not verified");
        res.statusCode = UNAUTHORIZED_STATUS_CODE;
        res.end("Access key not verified");
        return;
      }

      // store the access key as allowed
      allowed[requestAccessKey] = {
        lastVerifiedAt: new Date().getTime(),
      };
      await this._localDb.storeAccessKeys("allowed", allowed);
    }

    next();

    // check if there are any access keys that need to be verified
    const incomingAccessKeys = await this.getAllIncomingAccessKeys();
    // if there are more than 10 access keys, we trigger the verification
    if (incomingAccessKeys.length >= 10) {
      this._checkEmitter.emit("check", incomingAccessKeys);
    }
  }

  private async getAllIncomingAccessKeys(): Promise<IncomingAccessKey[]> {
    const existingAccessKeys = await this._localDb.getAccessKeys("incoming");
    const accessKeys: IncomingAccessKey[] = [];

    for (const accessKey of Object.values(existingAccessKeys)) {
      accessKeys.push(...accessKey);
    }

    return accessKeys;
  }

  private async verifyAccessKey(
    accessKey: IncomingAccessKey,
  ): Promise<boolean> {
    const response = await this._icAgent.actor.reportSignedRequest({
      unique_access_key: {
        key: accessKey.key,
        nonce: accessKey.nonce,
      },
      signature_hex: accessKey.signature,
      requester_canister_id: Principal.from(accessKey.metadata!.canisterId),
    });

    if ("Ok" in response) {
      return true;
    }

    return false;
  }

  private async verifyAccessKeys(
    incomingAccessKeys: IncomingAccessKey[] | undefined,
  ): Promise<void> {
    if (!incomingAccessKeys) {
      incomingAccessKeys = await this.getAllIncomingAccessKeys();
    }

    const allowed = await this._localDb.getAccessKeys("allowed");
    const incoming = await this._localDb.getAccessKeys("incoming");

    for (const accessKey of Object.values(incomingAccessKeys)) {
      const verified = await this.verifyAccessKey(accessKey);

      if (verified) {
        allowed[accessKey.key] = {
          lastVerifiedAt: new Date().getTime(),
        };
      }

      // in any case, we remove the access key from the incoming list
      // the access key is identified by the key and the nonce
      incoming[accessKey.key] = incoming[accessKey.key].filter(
        (ak) => ak.nonce !== accessKey.nonce,
      );
      if (incoming[accessKey.key].length === 0) {
        delete incoming[accessKey.key];
      }
    }

    await this._localDb.storeAccessKeys("allowed", allowed);
    await this._localDb.storeAccessKeys("incoming", incoming);
  }
}
