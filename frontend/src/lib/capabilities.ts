// Optional backend features, advertised in GET /workspace -> capabilities.
// See docs/API-CONTRACT.md. Anything not listed is hidden in the UI, so a
// replacement backend can implement the core tier first and grow from there.
export const CAPABILITIES = [
  "models.manage", // add / edit / test / remove model connections
  "projects",      // projects with instructions and memory
  "documents",     // upload, library and cited retrieval
  "presets",       // saved assistants
  "search",        // full-text chat search
  "usage",         // token and cost reporting
  "settings",      // workspace settings (daily limit)
  "branching",     // branch, edit-in-branch and regenerate
  "bookmarks",     // "Save answer" on assistant messages
  "cancel",        // server-side stop of a running generation
  "reasoning",     // per-message thinking effort
  "research",      // the Research tab: planned, tool-using research runs
  "research.connectors", // tools directory: web search setup, OAuth drives, custom MCP
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export type Has = (capability: Capability | Capability[]) => boolean;

/** An array argument means "any of these". */
export function capabilityCheck(advertised: readonly string[]): Has {
  const set = new Set(advertised);
  return capability => (Array.isArray(capability) ? capability : [capability]).some(c => set.has(c));
}
