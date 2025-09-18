import { Group, GroupFactory } from "../../lib/domain/group";
import { Traits } from "../../lib/domain/traits";

export class GroupMock implements Group {
  private readonly groupId: string;
  private readonly traits: Traits;
  public funcs: GroupMockFuncs;

  public constructor(groupId: string, traits: Traits, funcs: GroupMockFuncs) {
    this.groupId = groupId;
    this.traits = traits;
    this.funcs = funcs;
  }

  public identify(groupId?: string, traits: Traits = {}) {
    this.funcs?.identify(groupId, traits);
  }

  public getGroupId(): string | null {
    return this.groupId;
  }

  public getTraits(): Traits | null {
    return this.traits;
  }
}

export interface GroupMockFuncs {
  identify?: jest.Func;
}

export class GroupFactoryMock implements GroupFactory {
  public mockedGroup: Group;
  public constructor(mockedGroup: Group) {
    this.mockedGroup = mockedGroup;
  }

  public loadGroup(): Group {
    return this.mockedGroup;
  }
}
