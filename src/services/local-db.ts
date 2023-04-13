import { join } from "path";
import { Low, JSONFile } from "lowdb";
import { LocalDb } from "../models";

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
    pairingInfo: LocalDb["commissionedDevices"][string],
  ): Promise<void> {
    this.db.data["commissionedDevices"][deviceId] = pairingInfo;
    console.log(this.db.data["commissionedDevices"]);
    await this.db.write();
  }

  async getCommissionedDevice(
    deviceId: keyof LocalDb["commissionedDevices"],
  ): Promise<LocalDb["commissionedDevices"][string]> {
    const raw = this.db.data["commissionedDevices"][deviceId];
    return raw;
  }

  async removeCommissionedDevice(
    deviceId: keyof LocalDb["commissionedDevices"],
  ): Promise<void> {
    delete this.db.data["commissionedDevices"][deviceId];
    await this.db.write();
  }
}
