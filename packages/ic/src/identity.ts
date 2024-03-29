import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { Secp256k1KeyIdentity } from "@dfinity/identity-secp256k1";
import { getLogger } from "@omnia-gateway/core";
import * as bip39 from "bip39";
import hdkey from "hdkey";

const IDENTITY_FOLDER = `${process.cwd()}/data/ic`;

/**
 * Creates a new identity or loads an existing one from the file system.
 * If no seed phrase is provided, a new one is generated.
 */
export class IcIdentity {
  private _seedPhrase: string | undefined;
  private _identity: Secp256k1KeyIdentity | undefined;

  private logger = getLogger("IcIdentity");

  constructor(seedPhrase?: string) {
    this._seedPhrase = seedPhrase;

    // initialize the folder for the identity if it doesn't exist
    if (!existsSync(IDENTITY_FOLDER)) {
      mkdirSync(IDENTITY_FOLDER);
    }
  }

  getIdentity(): Secp256k1KeyIdentity {
    // check if the identity is saved in the file system
    // if not, create a new one
    // if yes, load it
    this._identity = this.loadIdentity() || this.createNewIdentity();

    return this._identity;
  }

  private loadIdentity(): Secp256k1KeyIdentity | undefined {
    if (existsSync(`${IDENTITY_FOLDER}/identity.json`)) {
      const keyPair = readFileSync(`${IDENTITY_FOLDER}/identity.json`, "utf-8");

      const identity = Secp256k1KeyIdentity.fromJSON(keyPair);

      // TODO: load seed phrase from private key

      this.logger.info("Identity loaded from file system");
      this.logger.info(`Key pair loaded from ${IDENTITY_FOLDER}/identity.json`);
      // this.logger.info(`Seed phrase: ${this._seedPhrase}`);
      this.logger.info(`Principal: ${identity.getPrincipal().toText()}`);

      return identity;
    }
  }

  private createNewIdentity(): Secp256k1KeyIdentity {
    if (!this._seedPhrase) {
      // 24 words seed phrase
      this._seedPhrase = bip39.generateMnemonic(256);
    }

    if (!bip39.validateMnemonic(this._seedPhrase)) {
      throw new Error("Invalid seed phrase");
    }

    const seed = bip39.mnemonicToSeedSync(this._seedPhrase);
    const root = hdkey.fromMasterSeed(seed);
    const addrnode = root.derive("m/44'/223'/0'/0/0");

    const identity = Secp256k1KeyIdentity.fromSecretKey(addrnode.privateKey);

    // save the private key
    writeFileSync(
      `${IDENTITY_FOLDER}/identity.json`,
      JSON.stringify(identity.toJSON()),
      "utf-8",
    );

    this.logger.info("New identity created");
    this.logger.info(`Key pair saved to ${IDENTITY_FOLDER}/identity.json`);
    this.logger.info(`Seed phrase: ${this._seedPhrase}`);
    this.logger.info(`Principal: ${identity.getPrincipal().toText()}`);

    return identity;
  }
}
