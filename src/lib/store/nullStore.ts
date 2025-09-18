import { Store } from "./store";

export class NullStore implements Store {
  public get = (): null => null;
  public set = (): null => null;
  public remove = (): void => {
    return;
  };
}
