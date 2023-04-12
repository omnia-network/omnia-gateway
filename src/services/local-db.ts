import { join } from "path";
import { Low, JSONFile } from "lowdb";
import { existsSync, mkdirSync } from "fs";
import { LocalDb } from "../models";

const DB_PATH = `${process.cwd()}/data`;

const INITIAL_DB: LocalDb = {
  commissionedDevices: [],
};

export class Database {
  private db: Low<LocalDb>;

  constructor() {
    // check if db_path exists, otherwise create it
    if (!existsSync(DB_PATH)) {
      mkdirSync(DB_PATH);
    }

    // store local database in data/db.json
    const adapter = new JSONFile<LocalDb>(join(DB_PATH, "db.json"));
    this.db = new Low(adapter);
  }

  async start(): Promise<LocalDb> {
    await this.db.read();
    this.db.data ||= INITIAL_DB;
    return this.db.data;
  }

  async storeCommissionedDevice(pairingInfo): Promise<void> {
    this.db.data["commissionedDevices"].push(pairingInfo);
    console.log(this.db.data["commissionedDevices"]);
    await this.db.write();
  }
}
