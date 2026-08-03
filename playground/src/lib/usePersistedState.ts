import { useEffect, useRef, useState } from "react";

const PREFIX = "journify-playground:";
const DEBOUNCE_MS = 300;

export function usePersistedState<T>(key: string, defaultValue: T) {
  const storageKey = PREFIX + key;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // corrupted entry, fall back to default
    }
    return defaultValue;
  });

  const timer = useRef<number>();
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(value));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer.current);
  }, [storageKey, value]);

  return [value, setValue] as const;
}
