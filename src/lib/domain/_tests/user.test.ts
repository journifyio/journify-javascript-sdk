import { v4 as uuid } from "uuid";
import { UserImpl } from "../user";
import {
  assertValueOnStores,
  createStoresForTest,
  TestStores,
} from "../../../test/helpers/stores";
import { StoresGroup } from "../../store/store";

describe("UserImpl class", () => {
  describe("newUser method", () => {
    it("Should create a user and persist its data if the stores are empty", async () => {
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };

      const user = new UserImpl(stores, sentryMock);
      await user.load();

      expect(user).toBeDefined();
      expect(user.getUserId()).toBeNull();
      expect(user.getTraits()).toEqual({});

      const anonymousId = user.getAnonymousId();
      expect(anonymousId).toBeDefined();
      expect(anonymousId.length).toBeGreaterThan(0);

      assertValueOnStores(testStores, "journifyio_anonymous_id", anonymousId);
      assertValueOnStores(testStores, "journifyio_user_traits", {});
    });

    it("Should get the user data from the local storage when it exists", async () => {
      await testFetchUserDataFromStore("local");
    });

    it("Should get the user data from the cookies when it exists", async () => {
      await testFetchUserDataFromStore("cookies");
    });

    it("Should get the user data from the memory store when it exists", async () => {
      await testFetchUserDataFromStore("memory");
    });
  });
});

describe("User interface", () => {
  describe("identify method", () => {
    it("Should update the user id and traits on the stores", async () => {
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };

      const oldUserId = "1567893";
      const oldTraits = { email: "user-1@gmail.com" };
      testStores.local.set("journifyio_user_id", oldUserId);
      testStores.cookies.set("journifyio_user_traits", oldTraits);
      const user = new UserImpl(stores, sentryMock, null, "966");
      const newUserId = "138738937";
      const newTraits = {
        email: "user-2@mail.com",
        clicks: 337,
        location: "Morocco",
        unique: uuid(),
        phone: "0551234567",
      };
      expect(newUserId).not.toEqual(oldUserId);
      expect(newTraits).not.toEqual(oldTraits);
      await user.identify(newUserId, newTraits);
      assertValueOnStores(testStores, "journifyio_user_id", newUserId);
      const expectedTraits = {
        ...newTraits,
        phone: "966551234567",
      };
      assertValueOnStores(testStores, "journifyio_user_traits", expectedTraits);
    });
    it("Should merge the previous traits with the new ones on the stores", async () => {
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const oldTraits = { email: "user-10@gmail.com" };
      testStores.local.set("journifyio_user_traits", oldTraits);
      const user = new UserImpl(stores, sentryMock);
      const newTraits = {
        clicks: 337,
        location: "Morocco",
        email: "new-user-email@gmail.com",
      };
      await user.identify(null, newTraits);
      const expectedStoredTraits = {
        ...newTraits,
      };
      assertValueOnStores(
        testStores,
        "journifyio_user_traits",
        expectedStoredTraits
      );
    });
  });

  describe("getUserId method", () => {
    it("Should return null when there is no user id on different stores", async () => {
      const { local, cookies, memory } = createStoresForTest();
      const stores = new StoresGroup(local, cookies, memory);
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const user = new UserImpl(stores, sentryMock);
      await user.load();
      expect(user.getUserId()).toBeNull();
    });
  });

  describe("getAnonymousId method", () => {
    it("Should not return null for anonymous id", async () => {
      const { local, cookies, memory } = createStoresForTest();
      const stores = new StoresGroup(local, cookies, memory);
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const user = new UserImpl(stores, sentryMock);
      await user.load();
      const anonymousId = user.getAnonymousId();
      expect(anonymousId).toBeDefined();
      expect(anonymousId.length).toBeGreaterThan(0);
    });
  });

  describe("getTraits method", () => {
    it("Should return an empty object when there is no traits on different stores", () => {
      const { local, cookies, memory } = createStoresForTest();
      const stores = new StoresGroup(local, cookies, memory);
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const user = new UserImpl(stores, sentryMock);
      expect(user.getTraits()).toEqual({});
    });
  });
});

async function testFetchUserDataFromStore(storeKey: keyof TestStores) {
  const testStores = createStoresForTest();
  const userId = "user_id_example_store";
  const anonymousId = uuid();
  const traits = {
    email: "user@mail.com",
    clicks: 337,
    location: "Morocco",
    unique: uuid(),
  };

  testStores[storeKey].set("journifyio_user_id", userId);
  testStores[storeKey].set("journifyio_anonymous_id", anonymousId);
  testStores[storeKey].set("journifyio_user_traits", traits);

  const stores = new StoresGroup(
    testStores.local,
    testStores.cookies,
    testStores.memory
  );

  const sentryMock = {
    setTag: jest.fn(),
    setResponse: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
  };
  const user = new UserImpl(stores, sentryMock);
  await user.load();
  expect(user.getUserId()).toEqual(userId);
  expect(user.getAnonymousId()).toEqual(anonymousId);
  expect(user.getTraits()).toEqual(traits);

  assertValueOnStores(testStores, "journifyio_user_id", userId);
  assertValueOnStores(testStores, "journifyio_anonymous_id", anonymousId);
  assertValueOnStores(testStores, "journifyio_user_traits", traits);
}
