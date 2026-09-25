import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, streamReply } from "@/lib/chatClient";
import { capabilityCheck } from "@/lib/capabilities";
import { Conversation, WorkspaceData } from "@/types";

const empty: WorkspaceData = { capabilities: [], conversations: [], projects: [], models: [], documents: [], presets: [], settings: { daily_request_limit: 200 } };
// A core-tier backend may omit everything but models and conversations.
function normalize(next: Partial<WorkspaceData>): WorkspaceData {
  return { ...empty, ...next, settings: { ...empty.settings, ...next.settings } };
}
export function useWorkspace() {
  const [data, setData] = useState<WorkspaceData>(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [running, setRunning] = useState<Record<string, string>>({});
  const controllers = useRef(new Map<string, AbortController>());
  const loading = useRef(0);
  const upsertConversation = useCallback((conversation: Conversation) => {
    setData(current => ({ ...current, conversations: [conversation, ...current.conversations.filter(c => c.id !== conversation.id)] }));
  }, []);
  const refresh = useCallback(async () => {
    const sequence = ++loading.current;
    const next = normalize(await api<Partial<WorkspaceData>>("/workspace"));
    if (sequence === loading.current) {
      setData(current => ({ ...next, conversations: next.conversations.map(c =>
        controllers.current.has(c.id) ? current.conversations.find(item => item.id === c.id) ?? c : c) }));
      setReady(true);
    }
  }, []);
  useEffect(() => { refresh().catch(e => setError(e.message)); }, [refresh]);
  useEffect(() => () => { controllers.current.forEach(c => c.abort()); }, []);
  async function mutate<T>(path: string, method: string, body?: unknown): Promise<T> {
    const result = await api<T>(path, method, body);
    await refresh();
    return result;
  }
  async function send(conversation: Conversation, query: string, model: string, documentIds: string[], presetId: string, reasoning: string, onAccepted?: () => void) {
    if (controllers.current.has(conversation.id)) return;
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    controllers.current.set(conversation.id, controller);
    setRunning(current => ({ ...current, [conversation.id]: requestId }));
    setError("");
    let messageId = "";
    const timeout = window.setTimeout(() => controller.abort(), 330000);
    try {
      await streamReply(`/conversations/${conversation.id}/generate`, {
        query, model, request_id: requestId, expected_message_count: conversation.messages.length,
        document_ids: documentIds, preset_id: presetId || null, reasoning,
      }, controller.signal, (event, payload) => {
        if (event === "start") {
          onAccepted?.();
          messageId = payload.message_id;
          upsertConversation(payload.conversation);
        } else if (event === "delta") {
          setData(current => ({ ...current, conversations: current.conversations.map(c => c.id !== conversation.id ? c : {
            ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, text: m.text + payload.text } : m),
          }) }));
        } else if (event === "done") {
          setData(current => ({ ...current, conversations: current.conversations.map(c => c.id !== conversation.id ? c : {
            ...c, messages: c.messages.map(m => m.id === payload.message_id ? { ...m, ...payload } : m),
          }) }));
        }
      });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      clearTimeout(timeout);
      controllers.current.delete(conversation.id);
      setRunning(current => { const next = { ...current }; delete next[conversation.id]; return next; });
      try { upsertConversation(await api<Conversation>(`/conversations/${conversation.id}`)); } catch (e) { setError((e as Error).message); }
    }
  }
  const has = useMemo(() => capabilityCheck(data.capabilities), [data.capabilities]);
  async function stop(conversationId: string, requestId?: string) {
    const id = requestId || running[conversationId];
    // Without server-side cancel, dropping the stream is the stop signal.
    if (id && has("cancel")) await api(`/generations/${id}/cancel`, "POST");
    controllers.current.get(conversationId)?.abort();
    upsertConversation(await api<Conversation>(`/conversations/${conversationId}`));
  }
  return { data, has, ready, error, setError, running, refresh, mutate, send, stop, upsertConversation };
}
