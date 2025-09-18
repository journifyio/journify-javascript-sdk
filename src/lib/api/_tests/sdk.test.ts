import { Sdk, SdkDependencies } from "../sdk";
import { User } from "../../domain/user";
import { EventQueue } from "../../transport/queue";
import { UserMock, UserMockFuncs } from "../../../test/mocks/user";
import { Traits } from "../../domain/traits";
import {
  EventFactoryFuncs,
  EventFactoryMock,
} from "../../../test/mocks/eventFactory";
import { JournifyEvent, JournifyEventType } from "../../domain/event";
import {
  EventQueueMock,
  EventQueueMockFuncs,
} from "../../../test/mocks/eventQueue";
import { Context } from "../../transport/context";
import {
  ContextFactoryFuncs,
  ContextFactoryMock,
  ContextMock,
} from "../../../test/mocks/context";
import { Group, GroupFactory } from "../../domain/group";
import {
  GroupFactoryMock,
  GroupMock,
  GroupMockFuncs,
} from "../../../test/mocks/group";
import { SdkSettings } from "../../transport/plugins/plugin";
import { ExternalIds } from "../../domain/externalId";

describe("Sdk class", () => {
  describe("identify method", () => {
    it("Should dispatch identify event with the right user data", async () => {
      const initialUserId = "initial-user-id-example";
      const initialAnonymousId = "initial-anonymous-id-example";
      const initialTraits: Traits = {
        email: "example@mail.com",
        location: "Morocco",
      };

      const externalIdsByClient: ExternalIds = {
        phone: "0938789032",
      };

      const userIdByClient = "user-id-used-by-client";
      const traitsByClient: Traits = {
        email: "example-15267@maily.net",
        location: "France",
      };

      const userMockFuncs: UserMockFuncs = {
        identify: jest.fn(),
      };

      const user: User = new UserMock(
        initialUserId,
        initialAnonymousId,
        initialTraits,
        externalIdsByClient,
        userMockFuncs
      );

      const initialGroupId = "initial-group-id-example";
      const initialGroupTraits: Traits = {
        email: "example-group@mail.com",
        location: "UK",
      };

      const groupMockFuncs: GroupMockFuncs = {
        identify: jest.fn(),
      };
      const group: Group = new GroupMock(
        initialGroupId,
        initialGroupTraits,
        groupMockFuncs
      );
      const groupFactory: GroupFactory = new GroupFactoryMock(group);

      const event: JournifyEvent = {
        messageId: "message-id-example",
        type: JournifyEventType.IDENTIFY,
        userId: initialUserId,
        anonymousId: initialAnonymousId,
        traits: initialTraits,
        timestamp: new Date(),
      };

      const eventFactoryFuncs: EventFactoryFuncs = {
        newIdentifyEvent: jest.fn(() => event),
      };
      const eventFactory = new EventFactoryMock(eventFactoryFuncs);

      const ctx: Context = new ContextMock("context-id", event);
      const contextFactoryFuncs: ContextFactoryFuncs = {
        newContext: jest.fn((eventParam: JournifyEvent, id?: string) => {
          expect(eventParam).toEqual(event);
          expect(id).toBeUndefined();
          return ctx;
        }),
      };
      const contextFactory = new ContextFactoryMock(contextFactoryFuncs);

      const eventQueueFuncs: EventQueueMockFuncs = {
        deliver: jest.fn(() => Promise.resolve(ctx)),
      };
      const eventQueue: EventQueue = new EventQueueMock(eventQueueFuncs);

      const deps: SdkDependencies = {
        user,
        groupFactory,
        eventFactory,
        contextFactory,
        eventQueue,
      };

      const sdkConfig: SdkSettings = {
        writeKey: "WRITE_KEY_EXAMPLE",
        apiHost: "API_HOST_EXAMPLE",
      };

      const sdk = new Sdk(sdkConfig, deps);
      const deliveredCtx = await sdk.identify(
        userIdByClient,
        traitsByClient,
        externalIdsByClient
      );

      expect(userMockFuncs.identify).toHaveBeenCalledTimes(1);
      expect(userMockFuncs.identify).toHaveBeenCalledWith(
        userIdByClient,
        traitsByClient,
        externalIdsByClient
      );
      expect(eventFactoryFuncs.newIdentifyEvent).toHaveBeenCalledTimes(1);
      expect(eventFactoryFuncs.newIdentifyEvent).toHaveBeenCalledWith(user);
      expect(contextFactoryFuncs.newContext).toHaveBeenCalledTimes(1);
      expect(eventQueueFuncs.deliver).toHaveBeenCalledTimes(1);
      expect(eventQueueFuncs.deliver).toHaveBeenCalledWith(ctx);
      expect(deliveredCtx).toEqual(ctx);
    });
  });
});
