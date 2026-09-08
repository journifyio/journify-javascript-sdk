import { LogEntry } from "../lib/log";

export function LogPanel(props: { entries: LogEntry[]; onClear: () => void }) {
  return (
    <div className="panel log-panel">
      <div className="panel-header">
        <h2>Log</h2>
        <button className="secondary" onClick={props.onClear}>
          Clear
        </button>
      </div>
      {props.entries.length === 0 && <p className="muted">No activity yet.</p>}
      <ul className="log-list">
        {props.entries.map((entry) => (
          <li key={entry.id} className={`log-entry log-${entry.level}`}>
            <span className="log-time">{entry.time}</span>
            <span className="log-title">{entry.title}</span>
            {entry.detail !== undefined && (
              <pre className="log-detail">
                {typeof entry.detail === "string"
                  ? entry.detail
                  : JSON.stringify(entry.detail, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
