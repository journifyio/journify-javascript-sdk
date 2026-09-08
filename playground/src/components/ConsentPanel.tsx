const CATEGORIES = [
  "advertising",
  "analytics",
  "functional",
  "marketing",
  "personalization",
] as const;

const PREFERENCES = ["GRANTED", "DENIED", "CONSENT_PREFERENCE_UNSPECIFIED"] as const;

export type ConsentFormState = Record<(typeof CATEGORIES)[number], string>;

export const DEFAULT_CONSENT: ConsentFormState = {
  advertising: "GRANTED",
  analytics: "GRANTED",
  functional: "GRANTED",
  marketing: "GRANTED",
  personalization: "GRANTED",
};

interface Props {
  consent: ConsentFormState;
  onChange: (consent: ConsentFormState) => void;
  onApply: () => void;
  disabled: boolean;
}

export function ConsentPanel(props: Props) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Consent</h2>
      </div>
      <div className="consent-grid">
        {CATEGORIES.map((category) => (
          <label key={category}>
            {category}
            <select
              value={props.consent[category]}
              onChange={(e) =>
                props.onChange({ ...props.consent, [category]: e.target.value })
              }
            >
              {PREFERENCES.map((pref) => (
                <option key={pref} value={pref}>
                  {pref === "CONSENT_PREFERENCE_UNSPECIFIED" ? "UNSPECIFIED" : pref}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button onClick={props.onApply} disabled={props.disabled}>
        updateConsent
      </button>
    </div>
  );
}
