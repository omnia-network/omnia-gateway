import { join } from "path";
import { Adapter, Low, TextFile } from "lowdb";

export type LocalDb = Record<string, unknown>;

const DB_PATH = `${process.cwd()}/data`;

const INITIAL_DB: LocalDb = {};

// an adapter that allows us to serialize and deserialize BigInts
class CustomJSONFile<T> implements Adapter<T> {
  #adapter: TextFile;

  constructor(filename: string) {
    this.#adapter = new TextFile(filename);
  }

  async read(): Promise<T | null> {
    const data = await this.#adapter.read();
    if (data === null) {
      return null;
    } else {
      return JSON.parse(data, (_, value) => {
        if (typeof value === "string") {
          // this is a hack to get around the fact that BigInts are not supported by JSON
          // TODO: find a better way to do this
          try {
            return BigInt(value);
          } catch (_e) {
            // ignore
          }
        }
        return value;
      }) as T;
    }
  }

  write(obj: T): Promise<void> {
    return this.#adapter.write(
      JSON.stringify(obj, (_, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      }),
    );
  }
}

const adapter = new CustomJSONFile<LocalDb>(join(DB_PATH, "db.json"));
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
