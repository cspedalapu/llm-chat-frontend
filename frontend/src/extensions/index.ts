/**
 * Registration point for fork-specific UI. Core components read these lists and
 * never need editing to add a page, a message add-on or a composer tool; keeping
 * fork code here (and in files next to this one) keeps upstream merges clean.
 *
 * Example — a research fork:
 *
 *   import { ResearchPage } from "./research/ResearchPage";
 *   import { SourcesAddon } from "./research/SourcesAddon";
 *   export const pages = { deep_research: ResearchPage };          // nav key from app.config.ts
 *   export const messageAddons = [{ id: "sources", render: SourcesAddon }];
 *
 * See docs/FORKING.md.
 */
import type { ComposerTool, ExtensionPage, MessageAddon } from "./types";

export type * from "./types";

/** Keyed by nav key. A page here replaces the placeholder or built-in view with the same key. */
export const pages: Record<string, ExtensionPage> = {};

export const messageAddons: MessageAddon[] = [];

export const composerTools: ComposerTool[] = [
  // Shown so the toolbar reads as the full product does, marked unavailable rather
  // than faked: nothing behind these exists in the base.
  { id: "create_image", label: "Create image", available: false },
  { id: "deep_research", label: "Deep research", available: false },
  { id: "web_search", label: "Web search", available: false },
];
