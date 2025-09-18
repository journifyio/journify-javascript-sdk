import { Store } from "./store";
import { MemoryStore } from "./memoryStore";

export class BrowserStore<S extends Storage> implements Store {
  private readonly browserStorage: S | null = null;
  private memoryStore: MemoryStore | null = null;

  public constructor(storage?: S) {
    if (storage) {
      this.browserStorage = storage;
    } else {
      this.memoryStore = new MemoryStore();
    }
  }

  public static isLocalStorageAvailable(): boolean {
    const testKey = "journify.io-test-browser-storage-key";
    try {
      localStorage.setItem(testKey, "journify.io-test-browser-storage-value");
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  public get<T>(key: string): T | null {
    const val: string = this.browserStorage
      ? this.browserStorage.getItem(key)
      : this.memoryStore.get(key);
    if (val) {
      try {
        return JSON.parse(val);
      } catch (e) {
        return JSON.parse(JSON.stringify(val));
      }
    }
    return null;
  }

  public set<T>(key: string, value: T): T | null {
    try {
      let persistedValue;
      switch (typeof value) {
        case "string":
        case "number":
        case "boolean":
          persistedValue = value.toString();
          break;
        default:
          persistedValue = JSON.stringify(value);
          break;
      }

      this.browserStorage
        ? this.browserStorage.setItem(key, persistedValue)
        : this.memoryStore.set(key, persistedValue);
    } catch (e) {
      console.warn(
        `Unable to set ${key} in browser storage, storage may be full.`
      );
      console.warn(e);
      return null;
    }

    return value;
  }

  public remove(key: string): void {
    try {
      this.browserStorage
        ? this.browserStorage.removeItem(key)
        : this.memoryStore.remove(key);
    } catch (e) {
      console.warn(`Unable to remove ${key} from browser storage.`);
      console.warn(e);
    }
  }
}
