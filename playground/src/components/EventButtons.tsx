import { useState } from "react";
import { EVENT_DEFINITIONS, EventDefinition } from "../lib/events";

interface Props {
  payloads: Record<string, string>;
  onPayloadChange: (key: string, value: string) => void;
  onSend: (definition: EventDefinition, payload: object) => void;
  onResetPayload: (key: string) => void;
  disabled: boolean;
}

export function EventButtons(props: Props) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Events</h2>
        {props.disabled && <span className="muted">load the SDK first</span>}
      </div>
      {EVENT_DEFINITIONS.map((definition) => (
        <EventRow key={definition.key} definition={definition} {...props} />
      ))}
    </div>
  );
}

function EventRow(props: Props & { definition: EventDefinition }) {
  const { definition } = props;
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const raw =
    props.payloads[definition.key] ??
    JSON.stringify(definition.defaultPayload, null, 2);

  const send = () => {
    try {
      const payload = JSON.parse(raw);
      setError(null);
      props.onSend(definition, payload);
    } catch (e) {
      setError(`Invalid JSON: ${e}`);
    }
  };

  return (
    <div className="event-row">
      <div className="event-row-header">
        <button onClick={send} disabled={props.disabled}>
          {definition.label}
        </button>
        <span className="muted event-kind">{definition.kind}</span>
        <button className="secondary" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide payload" : "Edit payload"}
        </button>
      </div>
      {expanded && (
        <div className="event-payload">
          <textarea
            rows={Math.min(raw.split("\n").length + 1, 20)}
            value={raw}
            onChange={(e) => props.onPayloadChange(definition.key, e.target.value)}
            spellCheck={false}
          />
          <button
            className="secondary"
            onClick={() => {
              props.onResetPayload(definition.key);
              setError(null);
            }}
          >
            Reset to default
          </button>
        </div>
      )}
      {error && <p className="log-error">{error}</p>}
    </div>
  );
}
