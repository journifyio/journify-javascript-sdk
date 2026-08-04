import { useEffect, useRef, useState } from "react";
import * as journify from "@journifyio/js-sdk";
import { ConfigForm } from "./components/ConfigForm";
import { EventButtons } from "./components/EventButtons";
import { ConsentPanel, ConsentFormState, DEFAULT_CONSENT } from "./components/ConsentPanel";
import { LogPanel } from "./components/LogPanel";
import { usePersistedState } from "./lib/usePersistedState";
import { DEFAULT_CONFIG, PlaygroundConfig, toSdkSettings } from "./lib/config";
import { EventDefinition, randomTransactionId } from "./lib/events";
import { LogEntry, makeEntry } from "./lib/log";

export function App() {
  const [config, setConfig] = usePersistedState<PlaygroundConfig>("config", DEFAULT_CONFIG);
  const [autoLoad, setAutoLoad] = usePersistedState<boolean>("auto-load", true);
  const [payloads, setPayloads] = usePersistedState<Record<string, string>>("payloads", {});
  const [consent, setConsent] = usePersistedState<ConsentFormState>("consent", DEFAULT_CONSENT);

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  const log = (level: LogEntry["level"], title: string, detail?: object | string) =>
    setEntries((prev) => [makeEntry(level, title, detail), ...prev]);

  const load = async (cfg: PlaygroundConfig) => {
    let settings: journify.SdkSettings;
    try {
      settings = toSdkSettings(cfg);
    } catch (e) {
      log("error", "Invalid settings", String(e));
      return;
    }
    if (!settings.writeKey) {
      log("error", "Write key is required");
      return;
    }

    setLoading(true);
    log("info", "load()", settings);
    try {
      // The SDK swallows load errors internally, so a resolved load() does NOT
      // mean success — only log what we can verify ourselves.
      await journify.load(settings);
      setSdkLoaded(true);
      log("info", "load() finished (SDK does not report load failures — check the browser console)");
      await logLoadedSyncs(settings);
    } catch (e) {
      log("error", "load() threw", String(e));
    } finally {
      setLoading(false);
    }
  };

  const logLoadedSyncs = async (settings: journify.SdkSettings) => {
    try {
      const writeKey = settings.writeKey.replace("wk_test_", "wk_");
      const response = await fetch(`${settings.cdnHost}/write_keys/${writeKey}.json`);
      if (!response.ok) {
        log("error", `Write-key settings fetch returned ${response.status}`);
        return;
      }
      const writeKeySettings = await response.json();
      const apps = (writeKeySettings.syncs ?? []).map(
        (sync: { destination_app: string }) => sync.destination_app
      );
      log("info", `Syncs in write-key settings: journifyio (always) + ${apps.length}`, apps);
    } catch (e) {
      log("error", "Could not read write-key settings for sync list", String(e));
    }
  };

  // Auto-load once on mount when enabled and a write key is saved.
  const autoLoadDone = useRef(false);
  useEffect(() => {
    if (autoLoadDone.current || !autoLoad || !config.writeKey.trim()) return;
    autoLoadDone.current = true;
    log("info", "Auto-load enabled, loading SDK with saved settings");
    load(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendEvent = async (definition: EventDefinition, payload: object) => {
    try {
      let ctx: unknown;
      if (definition.kind === "identify") {
        const { userId, traits } = payload as {
          userId: string;
          traits?: Parameters<typeof journify.identify>[1];
        };
        log("info", `identify(${userId})`, payload);
        ctx = await journify.identify(userId, traits);
      } else if (definition.kind === "page") {
        const { name, properties } = payload as { name?: string; properties?: object };
        log("info", `page(${name ?? ""})`, payload);
        ctx = await journify.page(name, properties);
      } else {
        const properties = { ...payload } as Record<string, unknown>;
        if ("transaction_id" in properties) {
          properties.transaction_id = randomTransactionId();
        }
        log("info", `track(${definition.key})`, properties);
        ctx = await journify.track(definition.key, properties);
      }

      // The SDK returns a Context when the event went through the plugins, and
      // null/undefined when it was only queued (SDK not loaded) or errored.
      if (ctx) {
        log("success", `${definition.label} dispatched to plugins`);
      } else {
        log(
          "error",
          `${definition.label} was NOT dispatched — SDK is not loaded (the call was queued by the SDK)`
        );
      }
    } catch (e) {
      log("error", `${definition.label} failed`, String(e));
    }
  };

  const applyConsent = () => {
    log("info", "updateConsent()", consent);
    journify.updateConsent(consent as unknown as journify.ConsentCategoryPreferences);
    log("success", "Consent updated");
  };

  return (
    <div className="layout">
      <header>
        <h1>Journify SDK Playground</h1>
        <span className={`sdk-status ${sdkLoaded ? "loaded" : ""}`}>
          {sdkLoaded ? "load() called" : "load() not called"}
        </span>
      </header>
      <div className="columns">
        <div className="column">
          <ConfigForm
            config={config}
            autoLoad={autoLoad}
            loading={loading}
            onChange={setConfig}
            onAutoLoadChange={setAutoLoad}
            onLoad={() => load(config)}
          />
          <ConsentPanel
            consent={consent}
            onChange={setConsent}
            onApply={applyConsent}
            disabled={!sdkLoaded}
          />
        </div>
        <div className="column">
          <EventButtons
            payloads={payloads}
            onPayloadChange={(key, value) =>
              setPayloads((prev) => ({ ...prev, [key]: value }))
            }
            onResetPayload={(key) =>
              setPayloads((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              })
            }
            onSend={sendEvent}
            disabled={!sdkLoaded}
          />
          <LogPanel entries={entries} onClear={() => setEntries([])} />
        </div>
      </div>
    </div>
  );
}
