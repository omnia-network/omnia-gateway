import { join } from "path";
import { JSONFile, Low } from "lowdb";
import { DbDevice, LocalDb, ProxyConfig, DbAccessKeys } from "../models";

const DB_PATH = `${process.cwd()}/data`;

const INITIAL_DB: LocalDb = {
  commissionedDevices: {},
};

export class Database {
  private db: Low<LocalDb>;

  constructor() {
    // store local database in data/db.json
    const adapter = new JSONFile<LocalDb>(join(DB_PATH, "db.json"));
    this.db = new Low(adapter);
  }

  async start(): Promise<LocalDb> {
    await this.db.read();
    this.db.data ||= INITIAL_DB;
    return this.db.data;
  }

  async storeCommissionedDevice(
    deviceId: keyof LocalDb["commissionedDevices"],
    device: DbDevice,
  ): Promise<DbDevice> {
    this.db.data!.commissionedDevices[deviceId] = device;
    await this.db.write();

    return device;
  }

  async getCommissionedDevice(
    deviceId: keyof LocalDb["commissionedDevices"],
  ): Promise<DbDevice> {
    const raw = this.db.data!.commissionedDevices[deviceId];
    return raw;
  }

  async removeCommissionedDevice(
    deviceId: keyof LocalDb["commissionedDevices"],
  ): Promise<void> {
    delete this.db.data!.commissionedDevices[deviceId];
    await this.db.write();
  }

  async storeProxyConfig(config: ProxyConfig) {
    this.db.data!.proxyConfig = config;
    await this.db.write();
  }

  async getProxyConfig(): Promise<ProxyConfig | undefined> {
    return this.db.data!.proxyConfig;
  }

  async getAccessKeys<T extends keyof DbAccessKeys>(dbKey: T): Promise<DbAccessKeys[T]> {
    if (!this.db.data!.accessKeys) {
      this.db.data!.accessKeys = {
        allowed: {},
        incoming: {},
      };
      await this.db.write();
    }
    return this.db.data!.accessKeys![dbKey];
  }

  async storeAccessKeys<T extends keyof DbAccessKeys>(dbKey: T, accessKeys: DbAccessKeys[T]) {
    if (!this.db.data!.accessKeys) {
      this.db.data!.accessKeys = {
        allowed: {},
        incoming: {},
      };
    }
    this.db.data!.accessKeys[dbKey] = accessKeys;
    await this.db.write();
  }
}
