/**
 * The one file a fork edits to rebrand and reshape the shell.
 *
 * Plain data only (type imports are fine): vite.config.ts reads it at build time to
 * fill in index.html, so it must not import components, CSS or `import.meta.env`.
 * Behaviour that needs code — new pages, message add-ons, composer tools, auth
 * headers — is registered in src/extensions/ instead.
 */
import type { NavIconName } from "./components/icons";
import type { Capability } from "./lib/capabilities";

export interface NavItemConfig {
  /** View key. Built-in keys are listed in App.tsx; any other key renders extensions.pages[key]. */
  key: string;
  label: string;
  icon: NavIconName;
  shortcut?: string;
  /** Hide the item unless the backend advertises this capability (an array means any of them). */
  requires?: Capability | Capability[];
  /** Roadmap signal with nothing behind it. Shown only when features.placeholderPages is on. */
  placeholder?: boolean;
  /** Set false to remove an item without deleting its entry. */
  enabled?: boolean;
  /** Always shown; users cannot hide it in the Customize window. */
  fixed?: boolean;
  /** "header" renders the entry as an icon next to the brand name instead of in the list. */
  placement?: "list" | "header";
  /** Shown under the toggle in the Customize window. */
  description?: string;
  /** Starting state in the Customize window for users who have not chosen (default true). */
  defaultOn?: boolean;
}

/** A composer control users can show or hide in the Customize window. */
export interface CustomizeOption {
  id: "tools" | "sources" | "thinking" | "assistant";
  label: string;
  description: string;
  defaultOn?: boolean;
}

export const appConfig = {
  brand: {
    name: "LLM Workspace",
    description: "Reusable AI chat workspace with a React frontend and a swappable backend.",
    /** Small badge in the top bar and the account button subtitle. Empty string hides the badge. */
    workspaceLabel: "Local workspace",
    /** Account button label until a fork wires real sign-in (see extensions/auth.ts). */
    accountName: "Personal",
  },
  copy: {
    emptyStateTitle: "What's on your mind?",
    /** Typed out one after another under the empty-state title. */
    emptyStatePrompts: ["New Project", "Research Planning", "New Case Study", "Building Prototype"],
    composerPlaceholder: "Ask anything",
    noModelPlaceholder: "Add a model connection to start chatting",
    /** Shown instead when the backend does not let users add models themselves. */
    noModelManagedPlaceholder: "No model is available from the backend yet",
    /** Clickable starters under the home composer; clicking one fills the message box. */
    suggestions: [
      { icon: "research", text: "Plan a research project and list the first three steps" },
      { icon: "edit", text: "Draft a clear, friendly project update for my team" },
      { icon: "library", text: "Summarize a document and pull out the key decisions" },
    ] satisfies { icon: NavIconName; text: string }[] as { icon: NavIconName; text: string }[],
  },
  features: {
    /** Nav items marked `placeholder` (Images, Apps, Deep Research). Off in the base: nothing is behind them. */
    placeholderPages: false,
    /** Composer "+" menu entries registered with `available: false`, shown disabled. */
    placeholderTools: true,
  },
  /**
   * Nav entries. Anything not `fixed` gets a toggle in the Customize window (account
   * menu). Hiding only removes it from the sidebar: the feature and its data stay.
   */
  nav: [
    { key: "new_chat", label: "New chat", icon: "edit", shortcut: "Ctrl + Shift + O", fixed: true },
    { key: "search_chats", label: "Search chats", icon: "search", requires: "search", fixed: true, placement: "header" },
    { key: "images", label: "Images", icon: "images", placeholder: true },
    { key: "library", label: "Library", icon: "library", requires: ["documents", "bookmarks"],
      description: "Uploaded documents and saved answers." },
    { key: "apps", label: "Apps", icon: "apps", placeholder: true },
    { key: "deep_research", label: "Deep Research", icon: "research", placeholder: true },
    { key: "workspace", label: "Workspace", icon: "workspace", requires: ["presets", "usage", "settings"],
      description: "Saved assistants, usage and limits. Still reachable from the account menu." },
    { key: "llms", label: "LLMs", icon: "models", requires: "models.manage",
      description: "Model connections. You can still add a model from the model selector." },
  ] satisfies NavItemConfig[] as NavItemConfig[],
  customize: {
    /** Listed as "Always on" alongside the fixed nav entries. Informational only. */
    alwaysOn: ["Projects", "Chat history", "Model selector"],
    composer: [
      { id: "tools", label: "Tools menu (+)", description: "Attach documents and other tools." },
      { id: "sources", label: "Sources", description: "Pick library files for a chat (in the + menu). Project files are still searched when hidden." },
      { id: "thinking", label: "Thinking effort", description: "Per-message reasoning level." },
      { id: "assistant", label: "Assistant picker", description: "Apply a saved assistant to a chat (in the + menu)." },
    ] satisfies CustomizeOption[] as CustomizeOption[],
  },
};

export type AppConfig = typeof appConfig;
