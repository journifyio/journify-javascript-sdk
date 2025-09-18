/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Context } from "../context";
import { EventQueueImpl } from "../queue";
import { Plugin } from "../plugins/plugin";
import { ContextMock } from "../../../test/mocks/context";
import { JPluginMock, JPluginMockFuncs } from "../../../test/mocks/plugin";
import { JournifyEventType } from "../../domain/event";
import { BrowserMock } from "../../../test/mocks/browser";
import {
  ON_OPERATION_DELAY_FINISH,
  OperationsPriorityQueueImpl,
} from "../../lib/priorityQueue";

jest.useFakeTimers();
describe("EventQueueImpl class", () => {
  const mockBrowser = new BrowserMock();
  let priorityQueue = new OperationsPriorityQueueImpl<Context>(2);

  afterEach(() => {
    jest.clearAllMocks();
  });
  beforeEach(() => {
    mockBrowser.setOnline(true);
    priorityQueue = new OperationsPriorityQueueImpl<Context>(2);
  });
  describe("deliver method", () => {
    it("Should resolve the context if all plugin ran successfully", async () => {
      const successIdenitfy: JPluginMockFuncs = {
        identify: jest.fn((ctxParam: Context) => Promise.resolve(ctxParam)),
      };
      const pluginMock: Plugin = new JPluginMock(successIdenitfy);
      pluginMock.name = "plugin1";

      const eventId = "event-queue-ctx-id-example-1";
      const eventWithPlugin = `${eventId}/${pluginMock.name}`;

      const subscribeToDelivery = jest.spyOn(
        EventQueueImpl.prototype as any,
        "subscribeToDelivery"
      );
      subscribeToDelivery.mockImplementation(() => Promise.resolve());
      const mockSentry = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const eventQueue = new EventQueueImpl(
        [pluginMock],
        priorityQueue,
        mockBrowser,
        mockSentry
      );

      const eventCtx = new ContextMock(eventId, {
        type: JournifyEventType.IDENTIFY,
      });

      await eventQueue.deliver(eventCtx);
      await jest.runOnlyPendingTimersAsync();

      expect(successIdenitfy.identify).toHaveBeenCalledTimes(1);
      expect(successIdenitfy.identify).toBeCalledWith({
        ...eventCtx,
        id: eventWithPlugin,
      });
    });

    it("Should send to all plugins ", async () => {
      const trackFunc: JPluginMockFuncs = {
        track: jest.fn((ctxParam: Context) => Promise.resolve(ctxParam)),
      };

      const plugin1: Plugin = new JPluginMock(trackFunc);
      plugin1.name = "plugin1";
      const plugin2: Plugin = new JPluginMock(trackFunc);
      plugin2.name = "plugin2";

      const mockSentry = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const eventQueue = new EventQueueImpl(
        [plugin1, plugin2],
        priorityQueue,
        mockBrowser,
        mockSentry
      );

      const eventId = "event-queue-ctx-id-example-1";
      const eventWithPlugin1 = `${eventId}/${plugin1.name}`;
      const eventWithPlugin2 = `${eventId}/${plugin2.name}`;

      const eventCtx = new ContextMock(eventId, {
        type: JournifyEventType.TRACK,
      });

      await eventQueue.deliver(eventCtx);
      await jest.runOnlyPendingTimersAsync();

      expect(trackFunc.track).toBeCalledTimes(2);
      expect(trackFunc.track).nthCalledWith(1, {
        ...eventCtx,
        id: eventWithPlugin1,
      });
      expect(trackFunc.track).nthCalledWith(2, {
        ...eventCtx,
        id: eventWithPlugin2,
      });
    });

    it("Should send to all plugins even if one fails ", async () => {
      const successtrackFunc: JPluginMockFuncs = {
        track: jest.fn((ctxParam: Context) => Promise.resolve(ctxParam)),
      };
      const failuretrackFunc: JPluginMockFuncs = {
        track: jest.fn((ctxParam: Context) => Promise.reject(ctxParam)),
      };

      const subscribeToDelivery = jest.spyOn(
        EventQueueImpl.prototype as any,
        "subscribeToDelivery"
      );
      subscribeToDelivery.mockImplementation(() => Promise.resolve());

      const plugin1: Plugin = new JPluginMock(successtrackFunc);
      plugin1.name = "plugin1";
      const plugin2: Plugin = new JPluginMock(failuretrackFunc);
      plugin2.name = "plugin2";

      const mockSentry = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const eventQueue = new EventQueueImpl(
        [plugin1, plugin2],
        priorityQueue,
        mockBrowser,
        mockSentry
      );

      const eventId = "event-queue-ctx-id-example-1";
      const eventWithPlugin1 = `${eventId}/${plugin1.name}`;
      const eventWithPlugin2 = `${eventId}/${plugin2.name}`;

      const eventCtx = new ContextMock(eventId, {
        type: JournifyEventType.TRACK,
      });

      await eventQueue.deliver(eventCtx);
      await jest.advanceTimersByTimeAsync(6000);

      expect(successtrackFunc.track).toHaveBeenCalledTimes(1);
      expect(successtrackFunc.track).toHaveBeenCalledWith({
        ...eventCtx,
        id: eventWithPlugin1,
      });
      expect(failuretrackFunc.track).toHaveBeenCalledTimes(2);
      expect(failuretrackFunc.track).toHaveBeenCalledWith(
        expect.objectContaining({
          id: eventWithPlugin2,
        })
      );
    });

    it("Should not send to any plugin if the browser is offline ", async () => {
      const trackFunc: JPluginMockFuncs = {
        track: jest.fn((ctxParam: Context) => Promise.resolve(ctxParam)),
      };

      mockBrowser.setOnline(false);

      const subscribeToDelivery = jest.spyOn(
        EventQueueImpl.prototype as any,
        "subscribeToDelivery"
      );
      subscribeToDelivery.mockImplementation(() => Promise.resolve());

      const plugin1: Plugin = new JPluginMock(trackFunc);
      const plugin2: Plugin = new JPluginMock(trackFunc);

      const mockSentry = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };

      const eventQueue = new EventQueueImpl(
        [plugin1, plugin2],
        priorityQueue,
        mockBrowser,
        mockSentry
      );

      const eventCtx = new ContextMock("event-queue-ctx-id-example-1", {
        type: JournifyEventType.TRACK,
      });

      await eventQueue.deliver(eventCtx);
      await jest.advanceTimersByTimeAsync(6000);

      expect(trackFunc.track).toBeCalledTimes(0);
    });

    it("Should process event on the queue, when an ON_OPERATION_DELAY_FINISH event is sent from the priority queue", async () => {
      const trackFunc: JPluginMockFuncs = {
        track: jest.fn((ctxParam: Context) => Promise.reject(ctxParam)),
      };

      const subscribeToDelivery = jest.spyOn(
        EventQueueImpl.prototype as any,
        "subscribeToDelivery"
      );
      subscribeToDelivery.mockImplementation((ctx) => Promise.resolve(ctx));

      const backoffDelayInMs = jest.spyOn(
        OperationsPriorityQueueImpl.prototype as any,
        "backoffDelayInMs"
      );
      backoffDelayInMs.mockImplementation(() => 0);
      const emit = jest.spyOn(
        OperationsPriorityQueueImpl.prototype as any,
        "emit"
      );

      const pQueueMock = new OperationsPriorityQueueImpl<Context>(2);
      const eventId = "event-queue-ctx-id-example-2";
      const plugin1: Plugin = new JPluginMock(trackFunc);
      plugin1.name = "plugin1";
      const eventWithPlugin = `${eventId}/${plugin1.name}`;

      const mockSentry = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };

      const eventQueue = new EventQueueImpl(
        [plugin1],
        pQueueMock,
        mockBrowser,
        mockSentry
      );

      const eventCtx = new ContextMock(eventId, {
        type: JournifyEventType.TRACK,
      });

      await eventQueue.deliver(eventCtx);
      await jest.advanceTimersByTimeAsync(6000);

      expect(trackFunc.track).toBeCalledTimes(2);
      expect(trackFunc.track).toHaveBeenCalledWith(
        expect.objectContaining({ id: eventWithPlugin })
      );
      expect(subscribeToDelivery).toBeCalledTimes(1);
      expect(emit).nthCalledWith(1, ON_OPERATION_DELAY_FINISH);
    });
    it("Should process same event if all plugins failed", async () => {
      const trackFunc: JPluginMockFuncs = {
        track: jest.fn((ctxParam: Context) => Promise.reject(ctxParam)),
      };

      const subscribeToDelivery = jest.spyOn(
        EventQueueImpl.prototype as any,
        "subscribeToDelivery"
      );
      subscribeToDelivery.mockImplementation((ctx) => {
        Promise.resolve(ctx);
      });

      const backoffDelayInMs = jest.spyOn(
        OperationsPriorityQueueImpl.prototype as any,
        "backoffDelayInMs"
      );
      backoffDelayInMs.mockImplementation(() => 0);

      const plugin1: Plugin = new JPluginMock(trackFunc);
      plugin1.name = "plugin1";
      const plugin2: Plugin = new JPluginMock(trackFunc);
      plugin2.name = "plugin2";

      const mockSentry = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };

      const eventQueue = new EventQueueImpl(
        [plugin1, plugin2],
        priorityQueue,
        mockBrowser,
        mockSentry
      );

      const eventCtx = new ContextMock("event1", {
        type: JournifyEventType.TRACK,
      });

      await eventQueue.deliver(eventCtx);
      await jest.advanceTimersByTimeAsync(6000);

      expect(trackFunc.track).toBeCalledTimes(4);
      expect(subscribeToDelivery).toBeCalledTimes(2);
    });
  });
});
