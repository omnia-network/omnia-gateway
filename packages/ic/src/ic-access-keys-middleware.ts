import EventEmitter from "events";
import { Principal } from "@dfinity/principal";
import { Store, getLogger } from "@omnia-gateway/core";
import { IcAgent } from "./agent.js";
import type {
  BaseAccessKeysMiddleware,
  MiddlewareRequestHandlerArgs,
  Timestamp,
} from "@omnia-gateway/core";
import type { IncomingMessage, ServerResponse } from "http";

const MISSING_OR_INVALID_HEADER_STATUS_CODE = 400;
const UNAUTHORIZED_STATUS_CODE = 401;

type IcAccessKeysMiddlewareParams = {
  icAgent: IcAgent;
};

type IncomingAccessKey = {
  key: string;
  nonce: bigint;
  signature: string;
  receivedAt?: Timestamp;
  metadata?: {
    [key: string]:
      | string
      | number
      | boolean
      | bigint
      | Record<string, unknown>
      | null;
  };
};

type VerifiedAccessKey = {
  lastVerifiedAt: Timestamp;
};

type AccessKeyIndex = IncomingAccessKey["key"];

type DbAccessKeys = {
  allowed: {
    [key: AccessKeyIndex]: VerifiedAccessKey;
  };
  incoming: {
    [key: AccessKeyIndex]: IncomingAccessKey[];
  };
};

type IdempotentRequests = {
  [key: string]: {
    status: "pending" | "done";
    response?: {
      status: number;
      body: string;
    };
  };
};

/**
 * Manages the access keys by verifying the keys against the Omnia Backend, using the IC Agent.
 */
export class IcAccessKeysMiddleware implements BaseAccessKeysMiddleware {
  private _icAgent: IcAgent;
  private _localDb: Store<DbAccessKeys>;

  private _checkEmitter: EventEmitter;
  private _checkInterval: NodeJS.Timeout | undefined;

  private _idempotentRequests: IdempotentRequests = {};
  private _idempotencyEmitter: EventEmitter;

  private logger = getLogger("IcAccessKeysMiddleware");

  constructor(params: IcAccessKeysMiddlewareParams) {
    this._icAgent = params.icAgent;
    this._checkEmitter = new EventEmitter();
    this._idempotencyEmitter = new EventEmitter();
    this._idempotencyEmitter.setMaxListeners(30); // IC replicas can be up to 30
  }

  /**
   * Initializes the checker that will periodically query the Omnia Backend to check the access keys.
   */
  async init() {
    this.logger.info("Initializing the IcAccessKeysMiddleware...");

    this._localDb = await Store.create<DbAccessKeys>("accessKeys");

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
    // check if the request is idempotent
    const idempotentKey = req.headers["idempotent-key"] as string | undefined;
    if (idempotentKey) {
      const idempotentRequest = this._idempotentRequests[idempotentKey];
      // if the request has already been processed, return the response
      if (idempotentRequest?.status === "done" && idempotentRequest?.response) {
        this.logger.debug(
          `Request with idempotent key ${idempotentKey} has already been processed, returning the response`,
        );

        return this.sendResponse(
          res,
          idempotentRequest.response.status,
          idempotentRequest.response.body,
        );
      } else if (idempotentRequest?.status === "pending") {
        this.logger.debug(
          `Request with idempotent key ${idempotentKey} is pending, waiting for it to be processed`,
        );
        // if the request is still pending, wait for it to be processed
        await new Promise((resolve) => {
          this._idempotencyEmitter.once("done", (ik) => {
            // check if the request has been processed for this idempotent key
            if (ik === idempotentKey) {
              resolve(undefined);
            }
          });
        });

        this.logger.debug(
          `Request with idempotent key ${idempotentKey} has finished processing, returning the response`,
        );

        // once the request has been processed, return the response
        return this.sendResponse(
          res,
          this._idempotentRequests[idempotentKey].response!.status,
          this._idempotentRequests[idempotentKey].response!.body,
        );
      } else {
        this.logger.debug(
          `Request with idempotent key ${idempotentKey} is not pending nor done, processing it`,
        );

        // set the request as pending
        this._idempotentRequests[idempotentKey] = {
          status: "pending",
        };
      }
    }

    // check if all headers are present
    const requestAccessKey = req.headers["x-omnia-access-key"];
    if (!requestAccessKey || typeof requestAccessKey !== "string") {
      const err = "X-Omnia-Access-Key header is missing or invalid";
      this.logger.error(err);

      return this.sendResponse(
        res,
        MISSING_OR_INVALID_HEADER_STATUS_CODE,
        err,
        idempotentKey,
      );
    }

    const rawNonce = req.headers["x-omnia-access-key-nonce"];
    if (!rawNonce || typeof rawNonce !== "string") {
      const err = "X-Omnia-Access-Key-Nonce header is missing or invalid";
      this.logger.error(err);

      return this.sendResponse(
        res,
        MISSING_OR_INVALID_HEADER_STATUS_CODE,
        err,
        idempotentKey,
      );
    }

    // parse the nonce (parsing throws if the nonce is invalid, so we catch it and return an error)
    let requestAccessKeyNonce: bigint;
    try {
      requestAccessKeyNonce = BigInt(rawNonce);
    } catch (error) {
      const err = "X-Omnia-Access-Key-Nonce header is invalid";
      this.logger.error(err);

      return this.sendResponse(
        res,
        MISSING_OR_INVALID_HEADER_STATUS_CODE,
        err,
        idempotentKey,
      );
    }

    const requestAccessKeySignature =
      req.headers["x-omnia-access-key-signature"];
    if (
      !requestAccessKeySignature ||
      typeof requestAccessKeySignature !== "string"
    ) {
      const err = "X-Omnia-Access-Key-Signature header is missing or invalid";
      this.logger.error(err);

      return this.sendResponse(
        res,
        MISSING_OR_INVALID_HEADER_STATUS_CODE,
        err,
        idempotentKey,
      );
    }

    const requestCanisterId = req.headers["x-ic-canister-id"];
    if (!requestCanisterId || typeof requestCanisterId !== "string") {
      const err = "X-IC-Canister-Id header is missing or invalid";
      this.logger.error(err);

      return this.sendResponse(
        res,
        MISSING_OR_INVALID_HEADER_STATUS_CODE,
        err,
        idempotentKey,
      );
    }

    const accessKey: IncomingAccessKey = {
      key: requestAccessKey,
      nonce: requestAccessKeyNonce,
      signature: requestAccessKeySignature,
      receivedAt: new Date().getTime(),
      metadata: {
        canisterId: requestCanisterId,
      },
    };

    // check if the access key has already been allowed
    const allowed = this._localDb.data.allowed;
    if (allowed[requestAccessKey]) {
      const incoming = this._localDb.data.incoming;

      // a check to avoid simple replay attacks
      if (
        incoming[requestAccessKey] &&
        incoming[requestAccessKey].find(
          (ak) => ak.nonce === requestAccessKeyNonce,
        )
      ) {
        const err = "Access key already used";
        this.logger.error(err);

        return this.sendResponse(
          res,
          UNAUTHORIZED_STATUS_CODE,
          err,
          idempotentKey,
        );
      }

      // store the access key as incoming
      if (!incoming[requestAccessKey]) {
        incoming[requestAccessKey] = [];
      }

      incoming[requestAccessKey].push(accessKey);
      this._localDb.data.incoming = incoming;
      await this._localDb.save();
    } else {
      const verifyResult = await this.verifyAccessKey(accessKey);
      if (!verifyResult.verified) {
        const err = `Access key not verified, reason: ${verifyResult.rejectReason}`;
        this.logger.error(err);

        return this.sendResponse(
          res,
          UNAUTHORIZED_STATUS_CODE,
          err,
          idempotentKey,
        );
      }

      // store the access key as allowed
      allowed[requestAccessKey] = {
        lastVerifiedAt: new Date().getTime(),
      };
      this._localDb.data.allowed = allowed;
      await this._localDb.save();
    }

    next();

    if (idempotentKey) {
      // set the request as done
      // TODO: we need to send the response of the Servient back to the caller,
      // because right now we are just sending an empty response.
      // We need to somehow get the response from the next() function, maybe as a callback?
      this._idempotentRequests[idempotentKey] = {
        status: "done",
        response: {
          status: 200,
          body: "",
        },
      };

      this._idempotencyEmitter.emit("done", idempotentKey);
    }

    // check if there are any access keys that need to be verified
    const incomingAccessKeys = await this.getAllIncomingAccessKeys();
    // if there are more than 10 access keys, we trigger the verification
    if (incomingAccessKeys.length >= 10) {
      this._checkEmitter.emit("check", incomingAccessKeys);
    }
  }

  private async getAllIncomingAccessKeys(): Promise<IncomingAccessKey[]> {
    const existingAccessKeys = this._localDb.data.incoming;
    const accessKeys: IncomingAccessKey[] = [];

    for (const accessKey of Object.values(existingAccessKeys)) {
      accessKeys.push(...accessKey);
    }

    return accessKeys;
  }

  private async verifyAccessKey(
    accessKey: IncomingAccessKey,
  ): Promise<{ verified: boolean; rejectReason?: string }> {
    const response = await this._icAgent.actor.reportSignedRequests([
      {
        unique_access_key: {
          key: accessKey.key,
          nonce: accessKey.nonce,
        },
        signature_hex: accessKey.signature,
        requester_canister_id: Principal.from(accessKey.metadata!.canisterId),
      },
    ]);

    if ("Ok" in response) {
      // if the key is valid, no rejected keys will be returned
      if (response.Ok.length === 0) {
        return {
          verified: true,
        };
      } else {
        // just log the rejection error
        const rejectReason = JSON.stringify(response.Ok[0].reason);
        this.logger.error(
          `Access key ${accessKey.key} rejected reason: ${rejectReason}`,
        );
        return {
          verified: false,
          rejectReason,
        };
      }
    }

    return {
      verified: false,
      rejectReason: "Unknown error",
    };
  }

  private async verifyAccessKeys(
    incomingAccessKeys: IncomingAccessKey[] | undefined,
  ): Promise<void> {
    if (!incomingAccessKeys) {
      incomingAccessKeys = await this.getAllIncomingAccessKeys();
    }

    if (incomingAccessKeys.length === 0) {
      return;
    }

    this.logger.debug(`Verifying ${incomingAccessKeys.length} access keys`);

    const allowed = this._localDb.data.allowed;
    const incoming = this._localDb.data.incoming;

    const reportResult = await this._icAgent.actor.reportSignedRequests(
      incomingAccessKeys.map((ak) => ({
        unique_access_key: {
          key: ak.key,
          nonce: ak.nonce,
        },
        signature_hex: ak.signature,
        requester_canister_id: Principal.from(ak.metadata!.canisterId),
      })),
    );

    if ("Ok" in reportResult) {
      const rejectedRequests = reportResult.Ok;

      // remove the rejected requests from the incoming list and the allowed list
      for (const rejectedRequest of rejectedRequests) {
        if (incoming[rejectedRequest.key]) {
          delete incoming[rejectedRequest.key];
        }
        if (allowed[rejectedRequest.key]) {
          delete allowed[rejectedRequest.key];
        }
      }

      // only add the verified requests to the allowed list and remove them from the incoming list
      const verifiedKeys = incomingAccessKeys.filter(
        (ak) => rejectedRequests.findIndex((rr) => rr.key === ak.key) === -1,
      );
      for (const verifiedKey of verifiedKeys) {
        allowed[verifiedKey.key] = {
          lastVerifiedAt: new Date().getTime(),
        };
        delete incoming[verifiedKey.key];
      }

      this.logger.debug(
        `Verified ${verifiedKeys.length} access keys, rejected ${rejectedRequests.length} access keys`,
      );
    } else {
      this.logger.error("Error while verifying access keys", reportResult);
      return;
    }

    this._localDb.data = {
      allowed,
      incoming,
    };
    await this._localDb.save();
  }

  private sendResponse(
    res: ServerResponse<IncomingMessage>,
    status: number,
    body: string,
    idempotentKey?: string,
  ): void {
    // set the idempotent response if the idempotent key is set
    if (idempotentKey) {
      this._idempotentRequests[idempotentKey] = {
        status: "done",
        response: {
          status,
          body,
        },
      };

      this._idempotencyEmitter.emit("done", idempotentKey);
    }

    res.statusCode = status;
    res.end(body);
  }
}
