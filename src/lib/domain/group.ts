import { Traits, GROUP_TRAITS_PERSISTENCE_KEY } from "./traits";
import { StoresGroup } from "../store/store";

const GROUP_ID_PERSISTENCE_KEY = "journifyio_group_id";

export interface Group {
  identify(groupId: string, traits?: Traits);
  getGroupId(): string | null;
  getTraits(): Traits | null;
}

export interface GroupFactory {
  loadGroup(): Group;
}

export class GroupFactoryImpl implements GroupFactory {
  private readonly stores: StoresGroup;

  public constructor(stores: StoresGroup) {
    this.stores = stores;
  }

  public loadGroup(): Group {
    return new GroupImpl(this.stores);
  }
}

class GroupImpl implements Group {
  private readonly stores: StoresGroup;
  private groupId: string;
  private traits: Traits = {};

  public constructor(stores: StoresGroup) {
    this.stores = stores;
    this.initGroupId();
    this.initTraits();
  }

  public identify(groupId: string, traits: Traits = {}) {
    if (groupId) {
      this.setGroupId(groupId);
    }

    const newTraits = {
      ...this.getTraits(),
      ...traits,
    };

    this.setTraits(newTraits);
  }

  public getGroupId(): string | null {
    return this.groupId;
  }

  public getTraits(): Traits | null {
    return this.traits;
  }

  private initGroupId() {
    this.groupId = this.stores.get(GROUP_ID_PERSISTENCE_KEY);
    if (this.groupId) {
      this.stores.set(GROUP_ID_PERSISTENCE_KEY, this.groupId);
    }
  }

  private initTraits() {
    const traits = this.stores.get(GROUP_TRAITS_PERSISTENCE_KEY);
    this.setTraits(traits as Traits);
  }

  private setTraits(newTraits: Traits) {
    const traits = {
      ...this.traits,
      ...(newTraits ?? {}),
    };
    this.stores.set(GROUP_TRAITS_PERSISTENCE_KEY, traits);
  }

  private setGroupId(groupId: string) {
    this.groupId = groupId;
    this.stores.set(GROUP_ID_PERSISTENCE_KEY, groupId);
  }
}
