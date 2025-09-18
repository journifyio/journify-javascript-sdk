import { BrowserMock } from "../../../../../test/mocks/browser";
import { CleverTapWrapperImpl, ProfileData } from "../cleverTapWrapper";

describe("CleverTapWrapperImpl", () => {
  it("should inject script from cloudfront when init is called and the page uses https", () => {
    testScriptInjection(
      "https://d2r1yp2w7bby2u.cloudfront.net/js/clevertap.min.js",
      true
    );
  });

  it("should inject script from cloudfront when init is called and the page uses https", () => {
    testScriptInjection(
      "http://static.clevertap.com/js/clevertap.min.js",
      false
    );
  });

  it("should initialize window.clevertap with the right data when init is called", () => {
    const browser = new BrowserMock();
    const localWindow = { ...window };
    browser.setWindow(localWindow);
    browser.setInjectScriptFn(jest.fn());

    const accountId = "clevertap-account-id 12345";
    const region = "us1";
    const logger = { log: jest.fn() };
    const cleverTapWrapper = new CleverTapWrapperImpl(browser, logger, false);
    cleverTapWrapper.init(accountId, region);

    expect(localWindow["clevertap"]).toEqual({
      account: [{ id: accountId }, region],
      event: [],
      profile: [],
      onUserLogin: [],
      notifications: [],
      privacy: [],
    });
  });

  it("should push profile data to clevertap when pushProfileData is called", () => {
    const browser = new BrowserMock();
    const localWindow = { ...window };
    browser.setWindow(localWindow);
    browser.setInjectScriptFn(jest.fn());

    const profileData1: ProfileData = {
      Site: {
        Name: "Jack Montana",
        Identity: 61026032,
        Email: "jack@gmail.com",
        Phone: "+14155551234",
        Gender: "M",
        DOB: new Date(),
        "MSG-email": false,
        "MSG-push": true,
        "MSG-sms": true,
        "MSG-whatsapp": true,
      },
    };

    const profileData2: ProfileData = {
      Site: {
        Name: "Jane Doe",
        Identity: 61026033,
        Email: "jane@yahoo.com",
        Phone: "+151556651234",
        Gender: "F",
        DOB: new Date(),
        "MSG-email": true,
        "MSG-whatsapp": false,
      },
    };

    const logger = { log: jest.fn() };
    const cleverTapWrapper = new CleverTapWrapperImpl(browser, logger, false);
    cleverTapWrapper.pushProfileData(profileData1);
    cleverTapWrapper.pushProfileData(profileData2);
    expect(localWindow["clevertap"]["onUserLogin"]).toEqual([
      profileData1,
      profileData2,
    ]);
  });

  it("should push event data to clevertap when pushEvent is called", () => {
    const browser = new BrowserMock();
    const localWindow = { ...window };
    browser.setWindow(localWindow);
    browser.setInjectScriptFn(jest.fn());

    const event1Name = "Product Viewed";
    const event1Props = {
      "Product name": "Casio Chronograph Watch",
      Category: "Mens Accessories",
      Price: 59.99,
      Date: new Date(),
    };

    const event2Name = "Web page viewed";

    const logger = { log: jest.fn() };
    const cleverTapWrapper = new CleverTapWrapperImpl(browser, logger, false);
    cleverTapWrapper.pushEvent(event1Name, event1Props);
    cleverTapWrapper.pushEvent(event2Name);
    expect(localWindow["clevertap"]["event"]).toEqual([
      event1Name,
      event1Props,
      event2Name,
    ]);
  });

  it("should log a message and not inject the cleverTap script on init if a testing write key is used", () => {
    const logger = { log: jest.fn() };
    const cleverTapWrapper = new CleverTapWrapperImpl(null, logger, true);
    expect(cleverTapWrapper).toBeDefined();
    const accountId = "clevertap-account-id";
    const region = "aps3";
    cleverTapWrapper.init(accountId, region);

    expect(logger.log).toHaveBeenCalledTimes(2);
    const expectedFirstLogMessage =
      "CleverTap is detected but script is not injected because you are using a testing write key.";
    expect(logger.log).toHaveBeenNthCalledWith(1, expectedFirstLogMessage);
    const expectedSecondMessage = `clevertap.account.push is called with: accountID: ${accountId}, region: ${region}`;
    expect(logger.log).toHaveBeenNthCalledWith(2, expectedSecondMessage);
  });

  it("should log a message and not call the cleverTap script on pushProfileData if a testing write key is used", () => {
    const logger = { log: jest.fn() };
    const cleverTapWrapper = new CleverTapWrapperImpl(null, logger, true);
    expect(cleverTapWrapper).toBeDefined();
    cleverTapWrapper.init("clevertap-account-id", "aps3");
    logger.log.mockClear();

    const profileData: ProfileData = {
      Site: {
        Name: "Jack Montana",
        Identity: 61026032,
        Email: "jack@gmail.com",
        Phone: "+14155551234",
        Gender: "M",
        DOB: new Date(),
        "MSG-email": false,
        "MSG-push": true,
        "MSG-sms": true,
        "MSG-whatsapp": true,
      },
    };
    cleverTapWrapper.pushProfileData(profileData);

    expect(logger.log).toHaveBeenCalledTimes(1);
    const expectedMessagePrefix =
      "Will call clevertap.onUserLogin.push with the following param:";
    expect(logger.log).toHaveBeenCalledWith(expectedMessagePrefix, profileData);
  });

  it("should log a message and not call the cleverTap script on pushEvent if a testing write key is used", () => {
    const logger = { log: jest.fn() };
    const cleverTapWrapper = new CleverTapWrapperImpl(null, logger, true);
    cleverTapWrapper.init("clevertap-account-id-2", "us1");
    logger.log.mockClear();

    const eventName = "add_to_cart";
    const eventProps = {
      "Product name": "Casio Chronograph Watch",
      Category: "Mens Accessories",
      Price: 59.99,
      Date: new Date(),
    };

    cleverTapWrapper.pushEvent(eventName, eventProps);

    expect(logger.log).toHaveBeenCalledTimes(1);
    const expectedMessagePrefix =
      "Will call clevertap.event.push with the following params in order:";
    expect(logger.log).toHaveBeenCalledWith(expectedMessagePrefix, [
      eventName,
      eventProps,
    ]);
  });
});

function testScriptInjection(expectedURL: string, isHttps: boolean) {
  const browser = new BrowserMock();
  browser.setWindow({ ...window });
  browser.setIsCurrentPageHttps(isHttps);

  const injectScriptFn = jest.fn();
  browser.setInjectScriptFn(injectScriptFn);

  const logger = { log: jest.fn() };
  const cleverTapWrapper = new CleverTapWrapperImpl(browser, logger, false);
  cleverTapWrapper.init("clevertap-account-id", "aps3");

  expect(injectScriptFn).toHaveBeenCalledTimes(1);
  expect(injectScriptFn).toHaveBeenCalledWith(expectedURL, { async: true });
}
