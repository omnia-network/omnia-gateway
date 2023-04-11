import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Low, JSONFile } from "lowdb";

export class Database {
  private db: Low;

  constructor() {
    type Devices = {
      commissionedDevices: [];
    };

    // store commissioned devices in /build/src/db.json
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const file = join(__dirname, "db.json");

    const adapter = new JSONFile<Devices>(file);
    this.db = new Low(adapter);
  }

  async start() {
    await this.db.read();
    this.db.data ||= { commissionedDevices: [] };
    console.log(this.db.data);
  }

  public async storeCommissionedDevice(pairingInfo) {
    this.db.data["commissionedDevices"].push(pairingInfo);
    console.log(this.db.data["commissionedDevices"]);
    await this.db.write();
  }
}
