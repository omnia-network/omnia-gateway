import { exec } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { promisify } from "util";
import { Store, getLogger } from "@omnia-gateway/core";
import fetch, { Request, Response } from "node-fetch";
import { getWgConfig } from "./wireguard.js";

const promisifiedExec = promisify(exec);

const WIREGUARD_FOLDER = `${process.cwd()}/data/wireguard`;

export type RegisterToVpnRequest = {
  public_key: string;
};

export type RegisterToVpnResponse = {
  server_public_key: string;
  assigned_ip: string;
  assigned_id: string;
  proxy_address: string;
};

export type PeerInfoResponse = {
  id: string;
  internal_ip: string;
  public_ip: string;
  public_key: string;
  proxy_address: string;
};

export type ProxyConfig = {
  proxyAddress: string;
  assignedProxyId: string;
};

/**
 * ProxyClient requires that {@link https://www.wireguard.com/ WireGuard} is installed on the system,
 * and that the `wg` and `wg-quick` binaries are available in the PATH.
 */
export class ProxyClient {
  /**
   * The HTTP URL of the proxy server, **including** protocol and port.
   */
  readonly proxyUrl: string;

  /**
   * The WireGuard address of the proxy server, **including** the port.
   */
  private wgAddress: string;

  private serverPublicKey: string | undefined;
  private internalIp: string | undefined;

  private _proxyConfig: ProxyConfig | undefined;
  get proxyConfig(): ProxyConfig | undefined {
    return this._proxyConfig;
  }

  private localDb: Store<ProxyConfig>;

  private logger = getLogger("ProxyClient");

  constructor(proxyUrl: string, wgAddress: string) {
    this.proxyUrl = proxyUrl;
    this.wgAddress = wgAddress;
  }

  /**
   * Connect the Gateway to the proxy server, using WireGuard under the hood.
   * @throws {Error} if WireGuard is configured but the proxy config is not found in the local database
   * @throws {Error} if WireGuard fails to start
   */
  async connect(): Promise<void> {
    // make sure wireguard directory exists
    if (!existsSync(WIREGUARD_FOLDER)) {
      mkdirSync(WIREGUARD_FOLDER);
    }

    // create the local database
    this.localDb = await Store.create<ProxyConfig>("proxyConfig");

    // check if WireGuard is already configured
    if (this.wgConfigExists()) {
      this.logger.info("WireGuard config found");
      await this.startWireguard();

      // load the proxy config from the local database
      this.loadConfig();

      this.logger.info("Getting peer info from proxy...");
      // get the peer info from the proxy, so that we can restore internal variables
      const response = await fetch(
        `http://${this.proxyConfig?.proxyAddress}/peer-info`,
      );
      if (!response.ok) {
        throw new Error(
          `Failed to get peer info from proxy: ${
            response.statusText
          } ${await response.text()}`,
        );
      }

      const body = (await response.json()) as PeerInfoResponse;

      this._proxyConfig = {
        proxyAddress: body.proxy_address,
        assignedProxyId: body.id,
      };
    } else {
      this.logger.info("WireGuard config not found");

      // initialize the WireGuard tunnel, so that we have a public key
      this.logger.info("Initializing WireGuard keys...");
      await this.initializeWireguardKeys();

      // register to the proxy server
      this.logger.info("Registering to proxy...");
      const response = await fetch(`${this.proxyUrl}/register-to-vpn`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          public_key: this.getWgPublicKey(),
        } as RegisterToVpnRequest),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to connect to proxy: ${
            response.statusText
          } ${await response.text()}`,
        );
      }

      const body = (await response.json()) as RegisterToVpnResponse;

      this.serverPublicKey = body.server_public_key;
      this.internalIp = body.assigned_ip;

      this._proxyConfig = {
        proxyAddress: body.proxy_address,
        assignedProxyId: body.assigned_id,
      };

      this.logger.info("Successfully registered to proxy");

      // create the WireGuard config
      this.logger.info("Creating WireGuard config...");
      this.createWgConfig();

      // start the WireGuard tunnel
      await this.startWireguard();
    }

    // save the proxy config to the local database
    // so that we can restore it next time the Gateway starts
    await this.saveConfig();

    this.logger.info(
      `Proxy connected! Peer id: ${this._proxyConfig.assignedProxyId}`,
    );
  }

  /**
   * Disconnect the Gateway from the proxy server, and stop the WireGuard tunnel.
   * @throws {Error} if WireGuard fails to stop
   */
  async disconnect(): Promise<void> {
    if (this.wgConfigExists()) {
      this.logger.info("Stopping WireGuard...");
      await this.stopWireguard();
    }
  }

  private async initializeWireguardKeys(): Promise<void> {
    const { stderr } = await promisifiedExec(
      `umask 077 && wg genkey | tee ${WIREGUARD_FOLDER}/privatekey | wg pubkey > ${WIREGUARD_FOLDER}/publickey`,
    );
    if (stderr) {
      throw new Error(`Failed to initialize WireGuard keys: ${stderr}`);
    }
  }

  private getWgPrivateKey(): string {
    return readFileSync(`${WIREGUARD_FOLDER}/privatekey`, "utf-8")
      .split("\n")[0]
      .trim();
  }

  private getWgPublicKey(): string {
    return readFileSync(`${WIREGUARD_FOLDER}/publickey`, "utf-8")
      .split("\n")[0]
      .trim();
  }

  private wgConfigExists(): boolean {
    if (!existsSync(`${WIREGUARD_FOLDER}/wg0.conf`)) {
      return false;
    }
    return true;
  }

  private createWgConfig(): void {
    const wgConfig = getWgConfig(
      this.serverPublicKey!,
      this.wgAddress,
      this.internalIp!,
      this.getWgPrivateKey(),
    );

    writeFileSync(`${WIREGUARD_FOLDER}/wg0.conf`, wgConfig);
  }

  private async startWireguard(): Promise<void> {
    // apparently wg-quick logs to stderr even if everything is fine
    // so we have to check the error message to see if it's a real error
    try {
      this.logger.info("Starting WireGuard...");

      await promisifiedExec(`wg-quick up ${WIREGUARD_FOLDER}/wg0.conf`);

      this.logger.info("WireGuard started successfully");
    } catch (e) {
      if (e.message.includes("wg0") && e.message.includes("already exists")) {
        // in this case, we have to delete the interface first
        this.logger.warn("WireGuard interface already exists, deleting...");

        await this.stopWireguard();

        // now we can start the tunnel
        return this.startWireguard();
      }

      this.logger.error(e);
      throw e;
    }
  }

  private async stopWireguard(): Promise<void> {
    // apparently wg-quick logs to stderr even if everything is fine
    // so we have to check the error message to see if it's a real error
    try {
      this.logger.info("Stopping WireGuard...");

      await promisifiedExec(`wg-quick down ${WIREGUARD_FOLDER}/wg0.conf`);

      // TODO: do we also need to delete the interface? There could be the case where the interface is not deleted properly
      // await promisifiedExec(`sudo ip link delete wg0`);

      this.logger.info("WireGuard stopped successfully");
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  private async saveConfig(): Promise<void> {
    if (!this._proxyConfig) {
      throw new Error("Proxy config not initialized");
    }
    this.localDb.data = this._proxyConfig;
    await this.localDb.save();
  }

  private loadConfig(): void {
    // the proxy config should be loaded at this point, because the WireGuard tunnel is already configured
    if (this.localDb.isEmpty()) {
      throw new Error("Failed to load proxy config from local database");
    }

    this._proxyConfig = this.localDb.data;
  }

  /**
   * A wrapper around the fetch function that prepares the request to make it acceptable by the proxy server.
   * @param args
   * @returns
   */
  proxyFetch(...args: Parameters<typeof fetch>): Promise<Response> {
    if (!this._proxyConfig) {
      throw new Error("Proxy config not initialized");
    }

    const [urlArg, options] = args;

    let destinationUrl: URL;

    // we need to extract the url from the Request object,
    // and put the base url in the headers and append the path to the proxy url
    if (urlArg instanceof URL) {
      destinationUrl = urlArg;
    } else if (urlArg instanceof Request) {
      destinationUrl = new URL(urlArg.url);
    } else {
      destinationUrl = new URL(urlArg);
    }

    // add the proxy id to the headers
    if (options && options.headers) {
      // @ts-ignore
      options.headers["X-Destination-Url"] = destinationUrl.origin;
      // @ts-ignore
      // not sure if setting the Host header is the best way to avoid host errors,
      // maybe better to do it directly in the proxy server
      // TODO: investigate
      options.headers.Host = destinationUrl.host;
    } else {
      args[1] = {
        ...options,
        headers: {
          "X-Destination-Url": destinationUrl.origin,
          // same as in previous case, see comment above
          Host: destinationUrl.host,
        },
      };
    }

    args[0] = new URL(
      `${destinationUrl.pathname}${destinationUrl.search}`,
      `http://${this._proxyConfig.proxyAddress}`,
    ).toString();

    return fetch(...args);
  }
}
