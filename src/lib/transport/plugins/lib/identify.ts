import { JournifyEvent, JournifyEventType } from "../../../domain/event";
import { User } from "../../../domain/user";

export function getStoredIdentify(user: User): JournifyEvent {
  if (user) {
    return {
      type: JournifyEventType.IDENTIFY,
      userId: user?.getUserId() || null,
      anonymousId: user?.getAnonymousId(),
      traits: user?.getTraits(),
    };
  }

  return {
    type: JournifyEventType.IDENTIFY,
  };
}
