import { EmitterImpl } from "../emitter";
import { createAndBindCallbacks } from "../../../test/helpers/emitter";

describe("EmitterImpl class", () => {
  describe("on method", () => {
    it("Should call multiple callbacks every time an event is emitted", function () {
      const NUMBER_OF_CALLBACKS = 5;
      const emitter = new EmitterImpl();
      const event_name = "event-name-example-1";
      const callbacks = createAndBindCallbacks(
        emitter,
        event_name,
        NUMBER_OF_CALLBACKS
      );

      const arg1 = "argument-1";
      const arg2 = 136;
      const arg3 = true;

      emitter.emit(event_name, arg1, arg2, arg3);
      callbacks.forEach((c) => {
        expect(c).toHaveBeenCalledWith(arg1, arg2, arg3);
        expect(c).toHaveBeenCalledTimes(1);
      });

      const arg4 = { exampleKey: "example value" };
      emitter.emit(event_name, arg4);

      callbacks.forEach((c) => {
        expect(c).toHaveBeenCalledWith(arg4);
        expect(c).toHaveBeenCalledTimes(2);
      });
    });

    it("Should not call any callback when an non-related event is emitted", function () {
      const NUMBER_OF_CALLBACKS = 6;
      const emitter = new EmitterImpl();
      const event_name = "event-name-example-2";
      const callbacks = createAndBindCallbacks(
        emitter,
        event_name,
        NUMBER_OF_CALLBACKS
      );

      emitter.emit("other-event");
      emitter.emit("other-event-2");
      callbacks.forEach((c) => {
        expect(c).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe("once method", () => {
    it("Should call multiple callbacks once when the targeted event is emitted for the first time", function () {
      const NUMBER_OF_CALLBACKS = 4;
      const emitter = new EmitterImpl();
      const callbacks: jest.Func[] = [];
      const event_name = "event-name-example-3";

      for (let i = 0; i < NUMBER_OF_CALLBACKS; i++) {
        const c = jest.fn();
        callbacks.push(c);
        emitter.once(event_name, c);
      }

      const arg1 = "argument-0";
      const arg2 = 13993;
      emitter.emit(event_name, arg1, arg2);

      const arg4 = { exampleKey: "example value" };
      emitter.emit(event_name, arg4);

      callbacks.forEach((c) => {
        expect(c).toHaveBeenCalledWith(arg1, arg2);
        expect(c).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("off method", () => {
    it("Should stop calling the callbacks when an event is emitted once the off method is invoked", function () {
      const NUMBER_OF_CALLBACKS = 8;
      const emitter = new EmitterImpl();
      const event_name = "event-name-example-4";
      const callbacks = createAndBindCallbacks(
        emitter,
        event_name,
        NUMBER_OF_CALLBACKS
      );
      const arg1 = "argument-1";

      emitter.emit(event_name, arg1);
      callbacks.forEach((c) => {
        expect(c).toHaveBeenCalledWith(arg1);
        expect(c).toHaveBeenCalledTimes(1);
      });

      callbacks.forEach((c) => emitter.off(event_name, c));
      const arg2 = "argument-2";
      emitter.emit(event_name, arg2);

      callbacks.forEach((c) => expect(c).toHaveBeenCalledTimes(1));
    });

    it("Should stop calling one callback when an event is emitted once the off method is invoked", function () {
      const NUMBER_OF_CALLBACKS = 8;
      const emitter = new EmitterImpl();
      const event_name = "event-name-example-6";
      const callbacks = createAndBindCallbacks(
        emitter,
        event_name,
        NUMBER_OF_CALLBACKS
      );
      const arg1 = "argument-1";

      emitter.emit(event_name, arg1);
      callbacks.forEach((c) => {
        expect(c).toHaveBeenCalledWith(arg1);
        expect(c).toHaveBeenCalledTimes(1);
      });

      const targetedIdx = 0;
      emitter.off(event_name, callbacks[targetedIdx]);
      const arg2 = "argument-2";
      emitter.emit(event_name, arg2);

      callbacks.forEach((c, idx) => {
        if (idx === targetedIdx) {
          expect(c).toHaveBeenCalledWith(arg1);
          expect(c).toHaveBeenCalledTimes(1);
        } else {
          expect(c).toHaveBeenCalledWith(arg2);
          expect(c).toHaveBeenCalledTimes(2);
        }
      });
    });
  });
});
