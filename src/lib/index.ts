import { getProductionWriteKey, Loader } from "./api/loader";
import { Sdk } from "./api/sdk";
import { Traits } from "./domain/traits";
import { Context } from "./transport/context";
import { ExternalIds } from "./domain/externalId";
import { WriteKeySettings, SdkSettings } from "./transport/plugins/plugin";
import { SentryWrapperImpl } from "./lib/sentry";
import { removeEmptyStrings } from "./lib/utils";

const DEFAULT_CDN_HOST = "https://static.journify.io";

const callsBeforeLoad = [];
const sentryWrapper = new SentryWrapperImpl();
const loader: Loader = new Loader(sentryWrapper);
let sdk: Sdk = null;
let recordingCallsBeforeLoad = false;

async function load(sdkSettings: SdkSettings) {
  try {
    const wKeySettings = await fetchWriteKeySettings(sdkSettings);
    sdk = await loader.load(sdkSettings, wKeySettings);
    callsBeforeLoad.forEach((call) => call());
  } catch (error) {
    sentryWrapper.captureException(error);
    console.error(error);
  }
}

async function fetchWriteKeySettings(
  sdkSettings: SdkSettings
): Promise<WriteKeySettings> {
  const productionWriteKey = getProductionWriteKey(sdkSettings?.writeKey);
  let settings = await fetchRemoteWriteKeySettings(
    productionWriteKey,
    sdkSettings.cdnHost || DEFAULT_CDN_HOST
  );

  if (!settings) {
    settings = {
      syncs: [],
    };
  }

  return settings;
}

async function fetchRemoteWriteKeySettings(
  writeKey: string,
  cdnHost: string
): Promise<WriteKeySettings> {
  const max_retries = 2;
  const settingsURL = `${cdnHost}/write_keys/${writeKey}.json`;

  for (let i = 0; i < max_retries; i++) {
    try {
      sentryWrapper.setTag("settingsURL", settingsURL);
      const response = await fetch(settingsURL);
      if (200 <= response.status && response.status <= 299) {
        const settings = await response.json();
        return settings;
      } else if (500 <= response.status && response.status <= 599) {
        if (i < max_retries - 1) {
          console.log(`Retrying in 2 seconds...`);
          await sleep(2000);
        }
      } else if (response.status != 404) {
        const error = new Error(
          `write key settings are not found for write key ${writeKey}. Status: ${response.status}`
        );
        await sentryWrapper.setResponse({
          url: settingsURL,
          headers: response.headers,
          status: response.status,
          body: await response.text(),
        });
        sentryWrapper.captureException(error);
        console.error(error);
      }
      return { syncs: [] };
    } catch (error) {
      sentryWrapper.captureException(error);
      console.error(
        `Failed to fetch write key settings from ${settingsURL}. error: ${error}`
      );
    }
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function identify(
  userId: string,
  traits?: Traits,
  externalIds?: ExternalIds
): Promise<Context | null> {
  try {
    if (!sdk) {
      recordCallBeforeLoad(() => identify(userId, traits, externalIds));
      return null;
    }

    if (!userId) {
      throw new Error("the user id is required when calling identify");
    }

    traits = removeEmptyStrings(traits) as Traits;
    loader.startNewSession();
    return sdk.identify(userId, traits, externalIds);
  } catch (error) {
    sentryWrapper.captureException(error);
    console.error(error);
  }
}

async function track(
  eventName: string,
  properties?: object,
  traits?: object
): Promise<Context | null> {
  try {
    if (!sdk) {
      recordCallBeforeLoad(() => track(eventName, properties, traits));
      return null;
    }

    traits = removeEmptyStrings(traits);
    return sdk.track(eventName, properties, traits);
  } catch (error) {
    sentryWrapper.captureException(error);
    console.error(error);
  }
}

async function page(
  param1?: string | object,
  param2?: object,
  param3?: object
): Promise<Context | null> {
  try {
    if (!sdk) {
      recordCallBeforeLoad(() => page(param1, param2, param3));
      return null;
    }

    let pageName: string = null;
    let properties: object = null;
    let traits: object = null;

    if (param1 && typeof param1 === "string") {
      pageName = param1;
      traits = param3 || {};
    } else if (param1 && typeof param1 === "object") {
      properties = param1;
      traits = param2 || {};
    }

    if (param2 && !properties && typeof param2 === "object") {
      properties = param2;
      traits = param3 || {};
    }

    traits = removeEmptyStrings(traits as Traits);
    return sdk.page(pageName, properties, traits);
  } catch (error) {
    sentryWrapper.captureException(error);
    console.error(error);
  }
}

async function group(
  groupId: string,
  traits?: Traits
): Promise<Context | null> {
  try {
    if (!sdk) {
      recordCallBeforeLoad(() => group(groupId, traits));
      return null;
    }

    if (!groupId) {
      throw new Error("the group id is required when calling group");
    }

    traits = removeEmptyStrings(traits) as Traits;
    return sdk.group(groupId, traits);
  } catch (error) {
    sentryWrapper.captureException(error);
    console.error(error);
  }
}

function recordCallBeforeLoad(call) {
  try {
    while (recordingCallsBeforeLoad);

    recordingCallsBeforeLoad = true;
    callsBeforeLoad.push(call);
    recordingCallsBeforeLoad = false;
  } catch (error) {
    sentryWrapper.captureException(error);
    console.error(error);
  }
}

export { load, identify, track, page, group, SdkSettings };
