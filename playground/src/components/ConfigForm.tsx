import {
  API_HOSTS,
  CDN_HOSTS,
  PlaygroundConfig,
} from "../lib/config";

interface Props {
  config: PlaygroundConfig;
  autoLoad: boolean;
  loading: boolean;
  onChange: (config: PlaygroundConfig) => void;
  onAutoLoadChange: (value: boolean) => void;
  onLoad: () => void;
}

export function ConfigForm(props: Props) {
  const { config, onChange } = props;
  const set = <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => onChange({ ...config, [key]: value });

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>SDK settings</h2>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={props.autoLoad}
            onChange={(e) => props.onAutoLoadChange(e.target.checked)}
          />
          Auto-load on refresh
        </label>
      </div>

      <div className="form-grid">
        <label>
          Write key
          <input
            value={config.writeKey}
            onChange={(e) => set("writeKey", e.target.value)}
            placeholder="wk_..."
          />
        </label>

        <label>
          API host
          <select
            value={config.apiHost}
            onChange={(e) => set("apiHost", e.target.value)}
          >
            {API_HOSTS.map((host) => (
              <option key={host}>{host}</option>
            ))}
          </select>
        </label>

        <label>
          CDN host
          <select
            value={config.cdnHost}
            onChange={(e) => set("cdnHost", e.target.value)}
          >
            {CDN_HOSTS.map((host) => (
              <option key={host}>{host}</option>
            ))}
          </select>
        </label>

        <label>
          Session duration (min)
          <input
            type="number"
            value={config.sessionDurationMin}
            onChange={(e) => set("sessionDurationMin", e.target.value)}
            placeholder="30"
          />
        </label>

        <label>
          Cookie domain
          <input
            value={config.cookieDomain}
            onChange={(e) => set("cookieDomain", e.target.value)}
            placeholder="localhost"
          />
        </label>

        <label>
          Phone country code
          <input
            value={config.phoneCountryCode}
            onChange={(e) => set("phoneCountryCode", e.target.value)}
            placeholder="MA"
          />
        </label>

        <label>
          Auto-capture phone regex
          <input
            value={config.autoCapturePhoneRegex}
            onChange={(e) => set("autoCapturePhoneRegex", e.target.value)}
            placeholder="^\+?[0-9]{8,15}$"
          />
        </label>

        <label>
          Additional PII keys (comma-separated)
          <input
            value={config.additionalPIIKeys}
            onChange={(e) => set("additionalPIIKeys", e.target.value)}
            placeholder="national_id, passport_number"
          />
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.enableHashing}
            onChange={(e) => set("enableHashing", e.target.checked)}
          />
          Enable PII hashing
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.autoCapturePII}
            onChange={(e) => set("autoCapturePII", e.target.checked)}
          />
          Auto-capture PII
        </label>

        <label className="full-width">
          httpCookieServiceOptions (JSON, empty = unset)
          <textarea
            rows={3}
            value={config.httpCookieServiceOptions}
            onChange={(e) => set("httpCookieServiceOptions", e.target.value)}
            placeholder='{ "url": "https://cookies.example.com" }'
          />
        </label>

        <label className="full-width">
          initialConsent (JSON, empty = unset)
          <textarea
            rows={3}
            value={config.initialConsent}
            onChange={(e) => set("initialConsent", e.target.value)}
            placeholder='{ "advertising": "GRANTED", "analytics": "GRANTED", "functional": "GRANTED", "marketing": "GRANTED", "personalization": "GRANTED" }'
          />
        </label>
      </div>

      <button onClick={props.onLoad} disabled={props.loading}>
        {props.loading ? "Loading..." : "Load SDK"}
      </button>
    </div>
  );
}
