import { JournifyEventType } from "../../../../domain/event";
import { getStoredIdentify } from "../identify";
import { UserMock } from "../../../../../test/mocks/user";

describe("getStoredIdentify", () => {
  it("should return an identify event with user details", () => {
    const mockUser = {
      getUserId: jest.fn(() => "user-123"),
      getAnonymousId: jest.fn(() => "anon-456"),
      getTraits: jest.fn(() => {
        return { name: "John Doe", email: "john@example.com" };
      }),
    };

    const user = new UserMock(
      mockUser.getUserId(),
      mockUser.getAnonymousId(),
      mockUser.getTraits(),
      {}
    );

    const identifyEvent = getStoredIdentify(user);

    expect(identifyEvent).toEqual({
      type: JournifyEventType.IDENTIFY,
      userId: "user-123",
      anonymousId: "anon-456",
      traits: { name: "John Doe", email: "john@example.com" },
    });
    expect(mockUser.getUserId).toHaveBeenCalledTimes(1);
    expect(mockUser.getAnonymousId).toHaveBeenCalledTimes(1);
    expect(mockUser.getTraits).toHaveBeenCalledTimes(1);
  });

  it("should return an identify event without user details", () => {
    const mockedUser = new UserMock();
    const identifyEvent = getStoredIdentify(mockedUser);

    expect(identifyEvent).toEqual({
      type: JournifyEventType.IDENTIFY,
      userId: null,
      anonymousId: null,
      traits: null,
    });
  });
});
