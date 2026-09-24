import { FormEvent, useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { Composer } from "@/components/Composer";
import { Modal } from "@/components/Modal";
import { ProjectEditor } from "@/components/ProjectEditor";
import { ProviderEditor, ProviderSettings } from "@/components/ProviderSettings";
import { SearchChats } from "@/components/SearchChats";
import { Library } from "@/components/Library";
import { WorkspaceTools } from "@/components/WorkspaceTools";
import { useWorkspace } from "@/hooks/useWorkspace";
import { api, download } from "@/lib/chatClient";
import { Conversation, DocumentRecord, Message, Preset, ProjectSummary, Provider } from "@/types";
import { emptyStatePrompts, emptyStateTitle } from "@/lib/appConfig";
import { useTypewriterPrompt } from "@/hooks/useTypewriterPrompt";

type View = "new_chat" | "project" | "search_chats" | "library" | "workspace" | "llms" | "images" | "apps" | "deep_research";
type Editor = { type: "project"; project?: ProjectSummary; memory?: string } | { type: "provider"; provider?: Provider } | { type: "rename" | "move" | "summary"; conversation: Conversation } | null;

function ConversationEditor({ type, conversation, projects, onSave, onClose }: {
  type: "rename" | "move" | "summary"; conversation: Conversation; projects: ProjectSummary[];
  onSave: (body: Partial<Conversation>) => Promise<void>; onClose: () => void;
}) {
  const [value, setValue] = useState(type === "rename" ? conversation.title : type === "summary" ? conversation.summary || "" : conversation.projectId || "");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <Modal title={type === "rename" ? "Rename chat" : type === "move" ? "Move to project" : "Conversation context"} onClose={onClose}>
    <form className="workspace-modal-form" onSubmit={async e => { e.preventDefault(); setBusy(true); try {
      await onSave(type === "rename" ? { title: value } : type === "move" ? { projectId: value || null } : { summary: value }); onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
      <label className="workspace-modal-field"><span>{type === "summary" ? "Summary to include in future turns" : type === "rename" ? "Chat name" : "Project"}</span>
        {type === "move" ? <select value={value} onChange={e => setValue(e.target.value)}><option value="">No project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          : type === "summary" ? <textarea rows={10} maxLength={12000} value={value} onChange={e => setValue(e.target.value)} />
          : <input required maxLength={150} value={value} onChange={e => setValue(e.target.value)} />}
      </label>
      {type === "summary" && <p className="muted">Keep key facts and decisions here. This editable summary is included even when older messages no longer fit the model context.</p>}
      {error && <p role="alert">{error}</p>}<button className="workspace-modal-primary" disabled={busy}>Save</button>
    </form>
  </Modal>;
}

export default function App() {
  const workspace = useWorkspace();
  const { data, ready, error, setError, running, refresh, mutate, send, stop, upsertConversation } = workspace;
  const rotatingPrompt = useTypewriterPrompt(emptyStatePrompts);
  const [view, setView] = useState<View>("new_chat");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [modelId, setModelId] = useState("");
  const [presetId, setPresetId] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [editor, setEditor] = useState<Editor>(null);
  const [projectTab, setProjectTab] = useState<"chats" | "sources">("chats");
  const [initialDraft, setInitialDraft] = useState("");
  const [confirm, setConfirm] = useState<{ text: string; action: () => Promise<void> } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const thread = useRef<HTMLElement>(null);
  const stickToBottom = useRef(true);
  const creating = useRef(false);
  const conversation = data.conversations.find(c => c.id === conversationId);
  const project = data.projects.find(p => p.id === (conversation?.projectId || projectId));
  const busy = Boolean(conversation && (running[conversation.id] || conversation.messages.some(m => m.state === "streaming")));
  const model = data.models.find(m => m.id === modelId);
  const availableDocuments = data.documents.filter(d => !d.projectId || d.projectId === project?.id);
  const lastMessage = conversation?.messages[conversation.messages.length - 1];

  useEffect(() => {
    if (data.models.length && !data.models.some(m => m.id === modelId)) setModelId(data.models[0].id);
  }, [data.models, modelId]);
  useEffect(() => {
    if (stickToBottom.current && thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [lastMessage?.text, conversation?.messages.length, busy]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); newChat(); } };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  });
  function run(action: () => Promise<unknown>) { action().catch(e => setError(e instanceof Error ? e.message : "Action failed.")); }
  function newChat(nextProjectId: string | null = null) {
    setView("new_chat"); setConversationId(null); setProjectId(nextProjectId); setSelectedDocuments([]); setInitialDraft(""); stickToBottom.current = true;
  }
  function openChat(id: string) {
    const item = data.conversations.find(c => c.id === id);
    setConversationId(id); setProjectId(item?.projectId || null); setView("new_chat"); setSelectedDocuments([]); setInitialDraft("");
    if (item?.model && data.models.some(m => m.id === item.model)) setModelId(item.model);
    stickToBottom.current = true;
    run(async () => upsertConversation(await api<Conversation>("/conversations/" + id)));
  }
  function openProject(id: string) {
    setView("project"); setProjectId(id); setConversationId(null); setSelectedDocuments([]); setProjectTab("chats"); setInitialDraft("");
  }
  function navigate(next: View) { if (next === "new_chat") newChat(); else { setView(next); setConversationId(null); setProjectId(null); } }
  async function updateChat(id: string, body: Partial<Conversation>) {
    const item = await api<Conversation>("/conversations/" + id, "PATCH", body); upsertConversation(item);
  }
  async function upload(files: File[], scope = project?.id || "") {
    for (const file of files) {
      const form = new FormData(); form.append("file", file); if (scope) form.append("project_id", scope);
      const document = await api<DocumentRecord>("/documents", "POST", form);
      setSelectedDocuments(ids => [...ids, document.id]);
    }
    await refresh();
  }
  async function sendMessage(text: string, accepted: () => void) {
    if (!model || creating.current) return;
    let target = conversation;
    if (!target) {
      creating.current = true;
      try {
        target = await api<Conversation>("/conversations", "POST", { model: modelId, projectId: project?.id || null });
        upsertConversation(target);
      } finally { creating.current = false; }
    }
    const targetId = target.id;
    await send(target, text, modelId, selectedDocuments, presetId, reasoning, () => {
      accepted(); setConversationId(targetId); setView("new_chat"); setInitialDraft(""); stickToBottom.current = true;
    });
  }
  function exportChat(item: Conversation) {
    const markdown = "# " + item.title + "\n\n" + item.messages.map(m => {
      const citations = m.result?.sources.map(s => "[" + s.number + "] " + s.title + ", page " + s.page + "\n> " + s.excerpt.replace(/\n/g, "\n> ")).join("\n\n");
      return "## " + (m.role === "user" ? "You" : m.result?.generationLabel || "Assistant") + "\n\n" + m.text + (citations ? "\n\n" + citations : "");
    }).join("\n\n");
    download(item.title.replace(/[^\w -]/g, "").slice(0, 70) + ".md", markdown);
  }
  async function branchAt(message: Message, regenerate = false) {
    if (!conversation || busy) return;
    let point = message;
    let text = "";
    if (regenerate) {
      const index = conversation.messages.findIndex(m => m.id === message.id);
      const previous = conversation.messages.slice(0, index).reverse().find(m => m.role === "user");
      if (!previous) return;
      point = previous; text = previous.text;
    } else if (message.role === "user") text = message.text;
    const branch = await api<Conversation>("/conversations/" + conversation.id + "/branch", "POST", { message_id: point.id, include_message: point.role === "assistant" });
    upsertConversation(branch); setConversationId(branch.id); setInitialDraft(text); setView("new_chat"); stickToBottom.current = true;
    const documents = (point.documentIds || []).filter(id => availableDocuments.some(d => d.id === id));
    setSelectedDocuments(documents);
    if (regenerate && model) await send(branch, text, modelId, documents, point.presetId || "", reasoning, () => setInitialDraft(""));
  }
  function usePreset(preset: Preset) {
    setPresetId(preset.id);
    if (data.models.some(m => m.id === preset.model)) setModelId(preset.model);
  }
  function chatAction(action: string, id: string) {
    const item = data.conversations.find(c => c.id === id); if (!item) return;
    if (action === "Export chat") exportChat(item);
    else if (action === "Pin chat") run(() => updateChat(id, { pinned: !item.pinned }));
    else if (action === "Archive") run(async () => { await updateChat(id, { archived: true }); if (id === conversationId) newChat(); });
    else if (action === "Move to project") setEditor({ type: "move", conversation: item });
  }
  const composer = (empty: boolean) => <Composer key={(conversation?.id || "new:" + (project?.id || "root")) + ":" + initialDraft}
    draftKey={conversation?.id || "new:" + (project?.id || "root")} initialText={initialDraft}
    busy={busy} disabled={!ready || !model || Boolean(conversation?.archived)}
    documents={availableDocuments} presets={data.presets} selectedDocuments={selectedDocuments} onDocuments={setSelectedDocuments}
    reasoning={reasoning} onReasoning={setReasoning}
    presetId={presetId} onPreset={id => { setPresetId(id); const preset = data.presets.find(p => p.id === id); if (preset) usePreset(preset); }}
    onSend={sendMessage} onStop={() => conversation && run(() => stop(conversation.id, lastMessage?.result?.request_id))}
    onUpload={files => upload(files)} placeholder={!model ? "Add a model connection to start chatting" : project ? "Ask in " + project.title : "Ask anything"} empty={empty} />;

  return <div className={"app-shell" + (collapsed ? " sidebar-collapsed" : "")}>
    <Sidebar activeNavKey={view} projects={data.projects}
      conversations={data.conversations.filter(c => !c.projectId && !c.archived).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))}
      activeConversationId={conversationId} activeProjectId={project?.id} accountName="Personal" isCollapsed={collapsed}
      onCreateProject={() => setEditor({ type: "project" })} onNewConversation={() => newChat()}
      onDeleteProject={id => setConfirm({ text: "Delete this project? Its chats and documents will be kept in your library without a project.", action: async () => { await mutate("/projects/" + id, "DELETE"); if (projectId === id) newChat(); } })}
      onDeleteConversation={id => setConfirm({ text: "Permanently delete this conversation?", action: async () => { await mutate("/conversations/" + id, "DELETE"); if (conversationId === id) newChat(); } })}
      onMoveConversationToProject={(id, projectId) => run(() => updateChat(id, { projectId }))}
      onRenameConversation={id => { const c = data.conversations.find(c => c.id === id); if (c) setEditor({ type: "rename", conversation: c }); }}
      onRenameProject={id => setEditor({ type: "project", project: data.projects.find(p => p.id === id) })}
      onSelectProject={openProject} onSelectConversation={openChat} onSelectNav={key => navigate(key as View)} onToggleSidebar={() => setCollapsed(v => !v)}
      onChatAction={chatAction} onAccount={() => navigate("workspace")} />
    <main className="workspace">
      <header className="workspace-topbar">
        <div className="workspace-title-row"><label className="model-control llm-model-control"><select aria-label="Model" value={modelId} onChange={e => e.target.value === "__add" ? setEditor({ type: "provider" }) : setModelId(e.target.value)}>
          {!data.models.length && <option value="">Choose a model</option>}{data.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}<option value="__add">+ Add your model</option>
        </select></label>{project && <button className="subtle-button" onClick={() => openProject(project.id)}>{project.title}</button>}</div>
        <div className="workspace-actions"><span className="local-badge">Local workspace</span><button className="subtle-button" onClick={() => run(async () => { await refresh(); setError(""); })}>Reload</button>
          {conversation && <details className="chat-options"><summary aria-label="Chat options">•••</summary><div className="chat-options-menu">
            <button onClick={() => exportChat(conversation)}>Export Markdown</button><button disabled={busy} onClick={() => setEditor({ type: "summary", conversation })}>Conversation context</button>
            <button disabled={busy} onClick={() => chatAction("Pin chat", conversation.id)}>{conversation.pinned ? "Unpin" : "Pin"} chat</button>
            <button disabled={busy} onClick={() => run(() => updateChat(conversation.id, { archived: !conversation.archived }))}>{conversation.archived ? "Restore" : "Archive"} chat</button>
            <button disabled={busy} onClick={() => setEditor({ type: "move", conversation })}>Move to project</button>
          </div></details>}
        </div>
      </header>
      {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
      {!ready ? <section className="empty-state"><h2>Opening your workspace…</h2><button onClick={() => run(refresh)}>Retry connection</button></section>
        : view === "llms" ? <ProviderSettings models={data.models} onAdd={() => setEditor({ type: "provider" })} onEdit={provider => setEditor({ type: "provider", provider })}
          onDelete={id => setConfirm({ text: "Remove this model connection and its saved key? Existing chats will be kept.", action: async () => { await mutate("/models/" + id, "DELETE"); } })} />
        : view === "search_chats" ? <SearchChats onOpen={openChat} onRestore={id => updateChat(id, { archived: false })} />
        : view === "workspace" ? <WorkspaceTools data={data} onRefresh={refresh} onUse={preset => { newChat(); usePreset(preset); }} />
        : view === "library" ? <Library documents={data.documents} conversations={data.conversations} onUpload={files => upload(files, "")} onOpen={openChat}
          onDelete={id => setConfirm({ text: "Delete this document's extracted text? Previously saved citation excerpts remain in chats.", action: async () => { await mutate("/documents/" + id, "DELETE"); setSelectedDocuments(ids => ids.filter(d => d !== id)); } })} />
        : ["images", "apps", "deep_research"].includes(view) ? <section className="feature-page"><p className="eyebrow">Not connected</p><h1>{view === "images" ? "Images" : view === "apps" ? "Apps" : "Deep Research"}</h1><p className="muted">This capability is not available in the local chat release. No tools or external app connections are running behind this page.</p><button onClick={() => navigate("llms")}>Manage model connections</button></section>
        : view === "project" && project ? <section className="project-workspace feature-page">
          <div className="project-hero"><div className="project-title-row-main"><h1 className="project-title">{project.title}</h1><button onClick={() => setEditor({ type: "project", project })}>Project settings</button></div>
            <p className="project-subtitle">{project.instructions || "Keep related conversations, instructions and documents together."}</p>
            <div className="project-composer-wrap">{composer(true)}</div></div>
          <div className="project-tabs"><button className={"project-tab-button" + (projectTab === "chats" ? " active" : "")} onClick={() => setProjectTab("chats")}>Chats</button><button className={"project-tab-button" + (projectTab === "sources" ? " active" : "")} onClick={() => setProjectTab("sources")}>Sources & memory</button></div>
          {projectTab === "chats" ? <div className="project-chat-grid">{data.conversations.filter(c => c.projectId === project.id && !c.archived).map(c => <button className="project-chat-card" key={c.id} onClick={() => openChat(c.id)}><div className="project-chat-card-top"><strong>{c.title}</strong><span>{new Date(c.updatedAt).toLocaleDateString()}</span></div><p>{c.preview}</p></button>)}
            {!data.conversations.some(c => c.projectId === project.id && !c.archived) && <div className="empty-card">Start a project chat above or move an existing chat here.</div>}</div>
            : <><div className="feature-card"><h2>Project memory</h2><p className="user-text">{project.memory || "No saved memory yet."}</p><button onClick={() => setEditor({ type: "project", project })}>Edit instructions & memory</button></div>
              <Library documents={data.documents.filter(d => d.projectId === project.id)} conversations={[]} onUpload={files => upload(files, project.id)} onOpen={openChat} onDelete={id => setConfirm({ text: "Delete this project document?", action: async () => { await mutate("/documents/" + id, "DELETE"); } })} /></>}
        </section>
        : !conversation?.messages.length ? <section className="empty-state"><h2 className="empty-title">{emptyStateTitle}</h2>
          <p className="empty-prompt" aria-label={`Ideas: ${emptyStatePrompts.join(", ")}`}><span>{rotatingPrompt || " "}</span><span className="empty-prompt-caret" aria-hidden="true" /></p>
          {composer(true)}</section>
        : <><section className="thread-panel functional-thread" ref={thread} onScroll={() => { const e = thread.current; if (e) stickToBottom.current = e.scrollHeight - e.scrollTop - e.clientHeight < 100; }}>
          <div className="thread-panel-inner">
            {conversation.parentId && <p className="muted">Branched conversation · <button className="subtle-button" onClick={() => openChat(conversation.parentId!)}>Open original</button></p>}
            {conversation.archived && <p className="muted">This chat is archived. Restore it from the chat options to continue.</p>}
            {conversation.messages.map(message => <ChatMessage key={message.id} message={message} busy={busy}
              onBranch={() => run(() => branchAt(message))} onRetry={message.role === "assistant" ? () => run(() => branchAt(message, true)) : undefined}
              onSave={message.role === "assistant" ? () => run(async () => upsertConversation(await api<Conversation>("/conversations/" + conversation.id + "/messages/" + message.id, "PATCH", { saved: !message.saved }))) : undefined}
              onMemory={message.role === "assistant" && project ? () => setEditor({ type: "project", project, memory: message.text }) : undefined} />)}
          </div>
        </section>{composer(false)}</>}
    </main>
    {editor?.type === "provider" && <ProviderEditor provider={editor.provider} onClose={() => setEditor(null)} onSaved={refresh} />}
    {editor?.type === "project" && <ProjectEditor project={editor.project} appendedMemory={editor.memory} onClose={() => setEditor(null)} onSave={async body => {
      const saved = await mutate<ProjectSummary>(editor.project ? "/projects/" + editor.project.id : "/projects", editor.project ? "PATCH" : "POST", body);
      if (!editor.project) openProject(saved.id);
    }} />}
    {editor && (editor.type === "rename" || editor.type === "move" || editor.type === "summary") && <ConversationEditor type={editor.type} conversation={editor.conversation} projects={data.projects} onClose={() => setEditor(null)} onSave={body => updateChat(editor.conversation.id, body)} />}
    {confirm && <Modal title="Confirm deletion" onClose={() => !confirmBusy && setConfirm(null)}><p>{confirm.text}</p><div className="workspace-modal-actions"><button disabled={confirmBusy} onClick={() => setConfirm(null)}>Cancel</button><button className="danger-button" disabled={confirmBusy} onClick={async () => { setConfirmBusy(true); try { await confirm.action(); setConfirm(null); } catch (e) { setError((e as Error).message); setConfirm(null); } finally { setConfirmBusy(false); } }}>Delete</button></div></Modal>}
  </div>;
}
