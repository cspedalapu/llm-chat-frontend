import { useCallback, useState } from "react";

// Per-browser display choices from the Customize window. Hiding a feature only
// removes it from view; its data and backend behaviour are untouched.
// Keys: "nav.<key>" for sidebar entries, "composer.<id>" for composer controls.
const STORAGE_KEY = "local-chat:customize";

type Choices = Record<string, boolean>;

function load(): Choices {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Choices; } catch { return {}; }
}
function save(choices: Choices) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choices)); } catch { /* storage blocked: choices last for this session */ }
}

export function usePreferences() {
  // Only explicit choices are stored, so changing a config default reaches users who never chose.
  const [choices, setChoices] = useState<Choices>(load);
  const isVisible = useCallback((id: string, defaultOn = true) => choices[id] ?? defaultOn, [choices]);
  const setVisible = useCallback((id: string, visible: boolean) => {
    setChoices(current => { const next = { ...current, [id]: visible }; save(next); return next; });
  }, []);
  const reset = useCallback(() => { setChoices({}); save({}); }, []);
  return { isVisible, setVisible, reset };
}
export type Preferences = ReturnType<typeof usePreferences>;
