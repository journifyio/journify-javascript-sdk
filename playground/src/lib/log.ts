export interface LogEntry {
  id: number;
  time: string;
  level: "info" | "success" | "error";
  title: string;
  detail?: object | string;
}

let nextId = 1;

export function makeEntry(
  level: LogEntry["level"],
  title: string,
  detail?: object | string
): LogEntry {
  return {
    id: nextId++,
    time: new Date().toLocaleTimeString(),
    level,
    title,
    detail,
  };
}
