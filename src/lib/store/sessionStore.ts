import { Store } from "./store";
import { Browser } from "../transport/browser";
import { MemoryStore } from "./memoryStore";

export class SessionStore implements Store {
  private readonly sessionStorage: Storage = null;
  private memoryStore: MemoryStore | null = null;

  constructor(browser: Browser) {
    if (this.isAvailable(browser)) {
      this.sessionStorage = browser.window().sessionStorage;
    } else {
      this.memoryStore = new MemoryStore();
    }
  }

  public isAvailable(browser: Browser): boolean {
    const testKey = "journify.io-test-browser-storage-key";
    try {
      browser
        .window()
        .sessionStorage.setItem(
          testKey,
          "journify.io-test-browser-storage-value"
        );
      browser.window().sessionStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  public get<T>(key: string): T | null {
    const val: string = this.sessionStorage
      ? this.sessionStorage.getItem(key)
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
      const stringValue = JSON.stringify(value);
      this.sessionStorage
        ? this.sessionStorage.setItem(key, stringValue)
        : this.memoryStore.set(key, stringValue);
    } catch (e) {
      console.warn(
        `Unable to set ${key} in session storage, storage may be full.`
      );
      console.warn(e);
      return null;
    }

    return value;
  }

  public remove(key: string): void {
    try {
      this.sessionStorage
        ? this.sessionStorage.removeItem(key)
        : this.memoryStore.remove(key);
    } catch (e) {
      console.warn(`Unable to remove ${key} from session storage.`);
      console.warn(e);
    }
  }
}
