import EventEmitter from "events";
import { Principal } from "@dfinity/principal";
import { Store, getLogger } from "@omnia-gateway/core";
import { IcAgent } from "./agent.js";
import type {
  BaseAccessKeysMiddleware,
  MiddlewareRequestHandlerArgs,
  Timestamp,
} from "@omnia-gateway/core";

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

/**
 * Manages the access keys by verifying the keys against the Omnia Backend, using the IC Agent.
 */
export class IcAccessKeysMiddleware implements BaseAccessKeysMiddleware {
  private _icAgent: IcAgent;
  private _localDb: Store<DbAccessKeys>;

  private _checkEmitter: EventEmitter;
  private _checkInterval: NodeJS.Timeout | undefined;

  private logger = getLogger("IcAccessKeysMiddleware");

  constructor(params: IcAccessKeysMiddlewareParams) {
    this._icAgent = params.icAgent;
    this._checkEmitter = new EventEmitter();
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
    // check if all headers are present
    const requestAccessKey = req.headers["x-omnia-access-key"];
    if (!requestAccessKey || typeof requestAccessKey !== "string") {
      this.logger.warn("X-Omnia-Access-Key header is missing or invalid");
      res.statusCode = MISSING_OR_INVALID_HEADER_STATUS_CODE;
      res.end("X-Omnia-Access-Key header is missing or invalid");
      return;
    }

    const rawNonce = req.headers["x-omnia-access-key-nonce"];
    if (!rawNonce || typeof rawNonce !== "string") {
      this.logger.warn("X-Omnia-Access-Key-Nonce is missing or invalid");
      res.statusCode = MISSING_OR_INVALID_HEADER_STATUS_CODE;
      res.end("X-Omnia-Access-Key-Nonce is missing or invalid");
      return;
    }

    // parse the nonce (parsing throws if the nonce is invalid, so we catch it and return an error)
    let requestAccessKeyNonce: bigint;
    try {
      requestAccessKeyNonce = BigInt(rawNonce);
    } catch (error) {
      this.logger.warn("X-Omnia-Access-Key-Nonce is invalid");
      res.statusCode = MISSING_OR_INVALID_HEADER_STATUS_CODE;
      res.end("X-Omnia-Access-Key-Nonce is invalid");
      return;
    }

    const requestAccessKeySignature =
      req.headers["x-omnia-access-key-signature"];
    if (
      !requestAccessKeySignature ||
      typeof requestAccessKeySignature !== "string"
    ) {
      this.logger.warn("X-Omnia-Access-Key-Signature is missing or invalid");
      res.statusCode = MISSING_OR_INVALID_HEADER_STATUS_CODE;
      res.end("X-Omnia-Access-Key-Signature is missing or invalid");
      return;
    }

    const requestCanisterId = req.headers["x-ic-canister-id"];
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
      this._localDb.data.incoming = incoming;
      await this._localDb.save();
    } else {
      const verifyResult = await this.verifyAccessKey(accessKey);
      if (!verifyResult.verified) {
        this.logger.error("Access key not verified");
        res.statusCode = UNAUTHORIZED_STATUS_CODE;
        res.end(
          `Access key not verified, reason: ${verifyResult.rejectReason}`,
        );
        return;
      }

      // store the access key as allowed
      allowed[requestAccessKey] = {
        lastVerifiedAt: new Date().getTime(),
      };
      this._localDb.data.allowed = allowed;
      await this._localDb.save();
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

      // remove the rejected requests from the incoming list
      for (const rejectedRequest of rejectedRequests) {
        if (incoming[rejectedRequest.key]) {
          delete incoming[rejectedRequest.key];
        }
        if (allowed[rejectedRequest.key]) {
          delete allowed[rejectedRequest.key];
        }
      }

      // only add the verified requests to the allowed list
      const verifiedKeys = incomingAccessKeys.filter(
        (ak) => rejectedRequests.findIndex((rr) => rr.key === ak.key) === -1,
      );
      for (const verifiedKey of verifiedKeys) {
        allowed[verifiedKey.key] = {
          lastVerifiedAt: new Date().getTime(),
        };
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
}
