import { Store } from "./store";

export class MemoryStore implements Store {
  private cache: Record<string, unknown> = {};

  public get<T>(key: string): T | null {
    return this.cache[key] as T | null;
  }

  public set<T>(key: string, value: T | null): T | null {
    this.cache[key] = value;
    return value;
  }

  public remove(key: string): void {
    delete this.cache[key];
  }
}
