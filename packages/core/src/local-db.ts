import { join } from "path";
import { JSONFile, Low } from "lowdb";

export type LocalDb = Record<string, unknown>;

const DB_PATH = `${process.cwd()}/data`;

const INITIAL_DB: LocalDb = {};

const adapter = new JSONFile<LocalDb>(join(DB_PATH, "db.json"));
const localDb = new Low(adapter);

export class Store<T extends Record<string, unknown>> {
  private db = localDb;
  key: string;

  get data(): T {
    return this.db.data![this.key] as T;
  }
  set data(data: T) {
    this.db.data![this.key] = data;
  }

  static async create<T extends Record<string, unknown>>(
    key: string,
  ): Promise<Store<T>> {
    const store = new Store<T>();
    store.key = key;

    // load the database from the file
    await store.db.read();

    // set the initial data if it does not exist
    if (!store.db.data) {
      store.db.data = INITIAL_DB;
      await store.db.write();
    }

    if (!store.db.data[key]) {
      store.db.data[store.key] = {};
      await store.db.write();
    }

    return store;
  }

  /**
   * Save the data to the database.
   * @param data The data to save.
   */
  async save(): Promise<void> {
    await this.db.write();
  }

  isEmpty(): boolean {
    return Object.keys(this.data).length === 0;
  }
}

// Type utils for the database
export type Timestamp = ReturnType<Date["getTime"]>;
