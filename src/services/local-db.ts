import { join } from "path";
import { JSONFile, Low } from "lowdb";
import { DbDevice, LocalDb } from "../models";

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
}
