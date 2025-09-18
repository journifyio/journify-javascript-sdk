import { Emitter } from "../../lib/transport/emitter";

export function createAndBindCallbacks(
  emitter: Emitter,
  event_name: string,
  size: number,
): jest.Func[] {
  const callbacks: jest.Func[] = [];

  for (let i = 0; i < size; i++) {
    const c = jest.fn();
    callbacks.push(c);
    emitter.on(event_name, c);
  }

  return callbacks;
}
