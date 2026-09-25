import type { ComponentType, ReactNode } from "react";
import type { Has } from "@/lib/capabilities";
import type { Message, WorkspaceData } from "@/types";

/** Props every extension page receives. Use `api()` from lib/chatClient for your own routes. */
export interface ExtensionPageProps {
  data: WorkspaceData;
  has: Has;
  refresh: () => Promise<void>;
  /** Switch to another view by nav key. */
  navigate: (key: string) => void;
  openChat: (conversationId: string) => void;
}
export type ExtensionPage = ComponentType<ExtensionPageProps>;

/**
 * Extra UI rendered inside a message bubble, after the built-in sources. Return null
 * to render nothing. Backends put their own data under `message.result.extensions`.
 */
export interface MessageAddon {
  id: string;
  render: (message: Message) => ReactNode;
}

export interface ComposerToolContext {
  draft: string;
  setDraft: (text: string) => void;
}

/** An entry in the composer "+" menu. */
export interface ComposerTool {
  id: string;
  label: string;
  /** false renders the entry disabled (and only when features.placeholderTools is on). */
  available?: boolean;
  run?: (context: ComposerToolContext) => void;
}
