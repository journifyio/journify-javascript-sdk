/* eslint-disable  @typescript-eslint/no-explicit-any */
import { BrowserMock } from "../../../test/mocks/browser";
import { CookiesStore } from "../../store/cookiesStore";
import { HttpCookieServiceImpl, HttpCookieOptions } from "../httpCookieService";

describe("HttpCookieServiceImpl", () => {
  const mockBrowser = new BrowserMock();
  const mockOrigin = "https://example.com";
  const mockFetch = jest.fn();
  mockBrowser.setLocation(new URL(mockOrigin) as any);

  beforeEach(() => {
    (global as any).fetch = mockFetch;
  });
  afterEach(() => {
    mockFetch.mockReset();
  });

  describe("constructor", () => {
    it("should throw an error if required options are missing", () => {
      const options: HttpCookieOptions = {
        renewUrl: "",
      };
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const cookieStoreMock = {
        get: jest.fn(),
        set: jest.fn(),
      };
      expect(() => {
        new HttpCookieServiceImpl(
          options,
          mockBrowser,
          sentryMock,
          cookieStoreMock as unknown as CookiesStore
        );
      }).toThrowError("Missing required renewUrl option for HttpCookieService");
    });

    it("should initialize the service with correct URLs and options", () => {
      const options: HttpCookieOptions = {
        renewUrl: "/renew",
        backoff: 500,
        retries: 3,
        timeout: 2000,
      };

      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const cookieStoreMock = {
        get: jest.fn(),
        set: jest.fn(),
      };
      const service = new HttpCookieServiceImpl(
        options,
        mockBrowser,
        sentryMock,
        cookieStoreMock as unknown as CookiesStore
      );

      expect(service["renewUrl"]).toBe(`${mockOrigin}/renew`);
      expect(service["backoff"]).toBe(500);
      expect(service["retries"]).toBe(3);
      expect(service["timeout"]).toBe(2000);
    });
  });

  describe("dispatchRenew", () => {
    it("should issue a request to renew url", async () => {
      const options: HttpCookieOptions = {
        renewUrl: "/renew",
      };
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const cookieStoreMock = {
        get: jest.fn(),
        set: jest.fn(),
      };
      const service = new HttpCookieServiceImpl(
        options,
        mockBrowser,
        sentryMock,
        cookieStoreMock as unknown as CookiesStore
      );

      mockFetch
        .mockResolvedValueOnce({ ok: false, json: jest.fn() })
        .mockResolvedValueOnce({ ok: true, json: jest.fn() });

      await service.dispatchRenew();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything()
      );
    });

    it("should throw an error if the request fails after all retries", async () => {
      const options: HttpCookieOptions = {
        renewUrl: "/renew",
      };
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const cookieStoreMock = {
        get: jest.fn(),
        set: jest.fn(),
      };
      const service = new HttpCookieServiceImpl(
        options,
        mockBrowser,
        sentryMock,
        cookieStoreMock as unknown as CookiesStore
      );
      const resp = {
        ok: false,
        json: jest.fn(),
      };
      mockFetch.mockResolvedValue(resp);
      await expect(service.dispatchRenew()).rejects.toThrowError();
      expect(mockFetch).toHaveBeenCalledTimes(service["retries"] + 1);
    });

    it("should send a POST request to the renew URL", async () => {
      const options: HttpCookieOptions = {
        renewUrl: "/renew",
      };
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const cookieStoreMock = {
        get: jest.fn(),
        set: jest.fn(),
      };
      const service = new HttpCookieServiceImpl(
        options,
        mockBrowser,
        sentryMock,
        cookieStoreMock as unknown as CookiesStore
      );

      const resp = {
        ok: true,
        json: jest.fn(),
      };
      mockFetch.mockResolvedValue(resp);

      await service.dispatchRenew();
      const controller = new AbortController();
      controller.abort();
      expect(mockFetch).toHaveBeenCalledWith(`${mockOrigin}/renew`, {
        signal: controller.signal,
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    });
  });
  describe("Cookie Keeper Polling", () => {
    it("should poll cookies ", async () => {
      const options: HttpCookieOptions = {
        enablePolling: true,
        pollingInterval: 10,
        renewUrl: "/renew",
      };
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const cookieStoreMock = {
        get: jest.fn(),
        set: jest.fn(),
      };
      cookieStoreMock.get.mockReturnValue("value");
      const service = new HttpCookieServiceImpl(
        options,
        mockBrowser,
        sentryMock,
        cookieStoreMock as unknown as CookiesStore
      );
      const dispatchRenewSpy = jest.spyOn(service as any, "dispatchRenew");
      const pollingCookieKeeperSpy = jest.spyOn(
        service as any,
        "pollingCookieKeeper"
      );
      const timeout = 10;
      await new Promise((resolve) => setTimeout(resolve, timeout));
      expect(pollingCookieKeeperSpy).toHaveBeenCalledTimes(1);
      expect(dispatchRenewSpy).toHaveBeenCalledTimes(0);
    });
    it("should execute dispatchRenew when supported cookies are set @only", async () => {
      const options: HttpCookieOptions = {
        enablePolling: true,
        pollingInterval: 10,
        renewUrl: "/renew",
      };
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const cookieStoreMock = {
        get: jest.fn(),
        set: jest.fn(),
      };
      const service = new HttpCookieServiceImpl(
        options,
        mockBrowser,
        sentryMock,
        cookieStoreMock as unknown as CookiesStore
      );
      const dispatchRenewSpy = jest.spyOn(service as any, "dispatchRenew");
      const revertInitialCookiesSpy = jest.spyOn(
        service as any,
        "revertInitialCookies"
      );
      const pollingCookieKeeperSpy = jest.spyOn(
        service as any,
        "pollingCookieKeeper"
      );
      mockFetch.mockResolvedValue({ ok: true, json: jest.fn() });
      const timeout = 10;
      await new Promise((resolve) => setTimeout(resolve, timeout));
      cookieStoreMock.get.mockReturnValue("value222");
      await new Promise((resolve) => setTimeout(resolve, timeout * 2));

      expect(pollingCookieKeeperSpy).toHaveBeenCalledTimes(2);
      expect(dispatchRenewSpy).toHaveBeenCalledTimes(1);
      expect(revertInitialCookiesSpy).toHaveBeenCalledTimes(0);
    });
    it("should revert to initial cookies when supported cookies changed", async () => {
      const options: HttpCookieOptions = {
        enablePolling: true,
        pollingInterval: 10,
        renewUrl: "/renew",
      };
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const cookieStoreMock = {
        get: jest.fn(),
        set: jest.fn(),
      };
      cookieStoreMock.get.mockReturnValue("value");
      const service = new HttpCookieServiceImpl(
        options,
        mockBrowser,
        sentryMock,
        cookieStoreMock as unknown as CookiesStore
      );
      const dispatchRenewSpy = jest.spyOn(service as any, "dispatchRenew");
      const revertInitialCookiesSpy = jest.spyOn(
        service as any,
        "revertInitialCookies"
      );
      const pollingCookieKeeperSpy = jest.spyOn(
        service as any,
        "pollingCookieKeeper"
      );
      mockFetch.mockResolvedValue({ ok: true, json: jest.fn() });
      const timeout = 10;
      await new Promise((resolve) => setTimeout(resolve, timeout));
      cookieStoreMock.get.mockReturnValue("value222");
      await new Promise((resolve) => setTimeout(resolve, timeout * 2));

      expect(pollingCookieKeeperSpy).toHaveBeenCalledTimes(2);
      expect(dispatchRenewSpy).toHaveBeenCalledTimes(0);
      expect(revertInitialCookiesSpy).toHaveBeenCalledTimes(1);
    });
  });
});
