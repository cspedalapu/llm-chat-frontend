import { ChangeEvent, FormEvent, KeyboardEvent, SVGProps, useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/components/ChatMessage.tsx";
import { Sidebar } from "@/components/Sidebar.tsx";
import { seededConversations, seededProjects } from "@/data/mockData.ts";
import { appName, composerPlaceholder, emptyStatePrompts, emptyStateTitle } from "@/lib/appConfig.ts";
import { fetchAvailableModels, requestAssistantReply } from "@/lib/chatClient.ts";
import { defaultModelOptions } from "@/lib/models.ts";
import { Conversation, Message, ModelId, ModelOption, ProjectSummary } from "@/types.ts";

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function OrbitIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2.8v2.1M19.2 12h2M12 19.1v2.1M2.8 12h2" />
    </svg>
  );
}

function CaretDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function MicrophoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="9" y="4" width="6" height="10" rx="3" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0" />
      <path d="M12 17v3" />
    </svg>
  );
}

function WaveformIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" {...props}>
      <path d="M4 12h1.5" />
      <path d="M8 9v6" />
      <path d="M12 6.5v11" />
      <path d="M16 9v6" />
      <path d="M18.5 12H20" />
    </svg>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatUpdatedAt(date: Date): string {
  return `Today | ${formatTime(date)}`;
}

function toConversationTitle(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return "New chat";
  }

  return trimmed.length <= 28 ? trimmed : `${trimmed.slice(0, 28)}...`;
}

function toProjectTitle(existingProjects: ProjectSummary[]): string {
  const baseTitle = "New project";
  const existingTitles = new Set(existingProjects.map((project) => project.title));

  if (!existingTitles.has(baseTitle)) {
    return baseTitle;
  }

  let index = 2;
  while (existingTitles.has(`${baseTitle} ${index}`)) {
    index += 1;
  }

  return `${baseTitle} ${index}`;
}

function useTypewriterPrompt(phrases: string[]): string {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [visibleLength, setVisibleLength] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (phrases.length === 0) {
      return;
    }

    const currentPhrase = phrases[phraseIndex] ?? "";
    const isPhraseComplete = visibleLength === currentPhrase.length;
    const isPhraseCleared = visibleLength === 0;
    const delay = isDeleting ? (isPhraseCleared ? 240 : 55) : isPhraseComplete ? 1100 : 95;

    const timeoutId = window.setTimeout(() => {
      if (!isDeleting && !isPhraseComplete) {
        setVisibleLength((current) => current + 1);
        return;
      }

      if (!isDeleting) {
        setIsDeleting(true);
        return;
      }

      if (!isPhraseCleared) {
        setVisibleLength((current) => current - 1);
        return;
      }

      setIsDeleting(false);
      setPhraseIndex((current) => (current + 1) % phrases.length);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isDeleting, phraseIndex, phrases, visibleLength]);

  const currentPhrase = phrases[phraseIndex] ?? "";
  return currentPhrase.slice(0, visibleLength);
}

type WorkspaceView = "new_chat" | "search_chats" | "images" | "library" | "apps" | "deep_research" | "workspace" | "llms";

interface ManagedModelOption {
  id: string;
  label: string;
  provider: string;
}

const workspaceLabels: Record<WorkspaceView, string> = {
  new_chat: "New chat",
  search_chats: "Search chats",
  images: "Images",
  library: "Library",
  apps: "Apps",
  deep_research: "Deep research",
  workspace: "Workspace",
  llms: "LLMs"
};

const addModelOptionValue = "__add_model__";

const seededManagedModels: ManagedModelOption[] = [
  { id: "openai-gpt-5-mini", label: "OpenAI GPT-5 mini", provider: "OpenAI" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4", provider: "Anthropic" },
  { id: "gemini-2-5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
  { id: "moonshot-kimi-k2-5", label: "Moonshot Kimi K2.5", provider: "Moonshot" },
  { id: "deepseek-v3-2-exp", label: "DeepSeek V3.2-Exp", provider: "DeepSeek" }
];

const workspacePageDetails: Partial<
  Record<
    Exclude<WorkspaceView, "new_chat">,
    {
      kicker: string;
      description: string;
      aboutTitle?: string;
      aboutCopy?: string;
      featured?: boolean;
    }
  >
> = {
  search_chats: {
    kicker: "Search",
    description: "This page is under construction and is being designed as the fastest way to find past conversations, decisions, prompts, and outputs across projects.",
    aboutTitle: "About this Page",
    aboutCopy:
      "Search Chats is intended to help users revisit previous work without starting from scratch. It should make it easier to recover earlier discussions, trace decisions, reuse strong prompts, and connect past insights to current tasks across projects and teams.",
    featured: true
  },
  images: {
    kicker: "Visuals",
    description: "This page is under construction and is being shaped as a visual workspace for generating, organizing, and reusing image-based assets.",
    aboutTitle: "About this Page",
    aboutCopy:
      "Images is meant for tasks that need visual output, such as concept sketches, product graphics, UI references, diagrams, branded assets, and research visuals. It should help users keep image workflows organized and separate from writing, coding, and research-heavy tasks.",
    featured: true
  },
  library: {
    kicker: "Knowledge",
    description: "This page is under construction and is being designed as a structured knowledge space for storing references, documents, reusable materials, and project context.",
    aboutTitle: "About this Page",
    aboutCopy:
      "Library is where users should keep the information that supports long-term work, including documents, notes, references, templates, datasets, and source material. It is intended to become the knowledge layer of the platform, helping teams build continuity across projects instead of losing context in scattered files and chats.",
    featured: true
  },
  apps: {
    kicker: "Apps",
    description: "This page is under construction and is being shaped as a connection layer for tools, services, and workflows that extend the platform.",
    aboutTitle: "About this Page",
    aboutCopy:
      "Apps is intended to help users, developers, and employers connect the right tools to the right tasks. It should make it easier to bring external services, utilities, automations, and task-specific applications into one workflow without jumping across disconnected platforms.",
    featured: true
  },
  deep_research: {
    kicker: "Research",
    description: "This page is under construction and is being shaped as a deeper research workspace.",
    aboutTitle: "About this Page",
    aboutCopy:
      "Deep Research is designed to help researchers investigate topics more thoroughly, organize evidence, compare findings, and move from raw questions to clearer insights in one focused workflow.",
    featured: true
  },
  workspace: {
    kicker: "Workspace",
    description: "This page is under construction and is being shaped as an all-in-one workspace for building and research.",
    aboutTitle: "About this Page",
    aboutCopy:
      "Workspace brings together UI, UX, coding agents, research tools, and useful free applications from different organizations so researchers and teams can work directly in one place with less friction.",
    featured: true
  },
  llms: {
    kicker: "Models",
    description: "This page is under construction and is being designed as the model layer for selecting, comparing, and connecting large language models to the right use cases.",
    aboutTitle: "About this Page",
    aboutCopy:
      "LLMs should help users understand which models are best suited for different tasks, whether that is research, writing, coding, reasoning, summarization, or workflow automation. It is intended to become the place where teams connect the right model to the right application with more clarity and control.",
    featured: true
  }
};

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>(seededProjects);
  const [conversations, setConversations] = useState<Conversation[]>(seededConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(seededConversations[0]?.id ?? null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceView>("new_chat");
  const [managedModels, setManagedModels] = useState<ManagedModelOption[]>(seededManagedModels);
  const [selectedManagedModelId, setSelectedManagedModelId] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelId>(seededConversations[0]?.model ?? defaultModelOptions[0].id);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>(defaultModelOptions);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAddModelModalOpen, setIsAddModelModalOpen] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newModelApiKey, setNewModelApiKey] = useState("");
  const [newModelInstructions, setNewModelInstructions] = useState("");
  const [uploadedModelFile, setUploadedModelFile] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const modelFileInputRef = useRef<HTMLInputElement | null>(null);
  const accountName: string | null = null;
  const rotatingPrompt = useTypewriterPrompt(emptyStatePrompts);

  const activeConversation = activeConversationId
    ? conversations.find((conversation) => conversation.id === activeConversationId) ?? null
    : null;
  const activeMessages = activeConversation?.messages ?? [];
  const isEmpty = activeMessages.length === 0;

  useEffect(() => {
    if (!activeConversation) {
      return;
    }

    setSelectedModel(activeConversation.model);
  }, [activeConversation]);

  useEffect(() => {
    let isCancelled = false;

    fetchAvailableModels().then((models) => {
      if (isCancelled || models.length === 0) {
        return;
      }

      setAvailableModels(models);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (availableModels.some((option) => option.id === selectedModel)) {
      return;
    }

    setSelectedModel(availableModels[0]?.id ?? defaultModelOptions[0].id);
  }, [availableModels, selectedModel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, isLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = draft.trim();
    if (!query || isLoading) {
      return;
    }

    const now = new Date();
    const userMessage: Message = {
      id: `user-${now.getTime()}`,
      role: "user",
      text: query,
      timestamp: formatTime(now)
    };
    const targetConversationId = activeConversationId ?? `conv-${now.getTime()}`;
    const priorMessages = activeConversation?.messages ?? [];

    setDraft("");
    setIsLoading(true);

    setConversations((currentConversations) => {
      const existingConversation = currentConversations.find((conversation) => conversation.id === targetConversationId);

      if (!existingConversation) {
        const nextConversation: Conversation = {
          id: targetConversationId,
          title: toConversationTitle(query),
          preview: "Thinking...",
          updatedAt: formatUpdatedAt(now),
          model: selectedModel,
          messages: [userMessage]
        };

        return [nextConversation, ...currentConversations];
      }

      return currentConversations.map((conversation) =>
        conversation.id === targetConversationId
          ? {
              ...conversation,
              title: conversation.messages.length === 0 ? toConversationTitle(query) : conversation.title,
              preview: "Thinking...",
              updatedAt: formatUpdatedAt(now),
              model: selectedModel,
              messages: [...conversation.messages, userMessage]
            }
          : conversation
      );
    });
    setActiveConversationId(targetConversationId);

    try {
      const result = await requestAssistantReply({
        query,
        model: selectedModel,
        history: priorMessages
      });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: result.answer,
        timestamp: formatTime(new Date()),
        result
      };

      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          conversation.id === targetConversationId
            ? {
                ...conversation,
                preview: result.diagnosticLabel,
                updatedAt: "Just now",
                model: selectedModel,
                messages: [...conversation.messages, assistantMessage]
              }
            : conversation
        )
      );
    } catch (error) {
      const fallbackMessage: Message = {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        text:
          error instanceof Error
            ? `The frontend could not complete the request: ${error.message}`
            : "The frontend could not complete the request.",
        timestamp: formatTime(new Date()),
        state: "error"
      };

      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          conversation.id === targetConversationId
            ? {
                ...conversation,
                preview: "Request needs attention",
                updatedAt: "Just now",
                messages: [...conversation.messages, fallbackMessage]
              }
            : conversation
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleNewConversation() {
    setActiveWorkspace("new_chat");
    setActiveConversationId(null);
    setSelectedModel(availableModels[0]?.id ?? defaultModelOptions[0].id);
    setDraft("");
  }

  function handleCreateProject() {
    const projectId = `project-${Date.now()}`;

    setProjects((currentProjects) => [
      {
        id: projectId,
        title: toProjectTitle(currentProjects),
        kind: "folder"
      },
      ...currentProjects
    ]);
  }

  function resetAddModelForm() {
    setNewModelName("");
    setNewModelApiKey("");
    setNewModelInstructions("");
    setUploadedModelFile(null);

    if (modelFileInputRef.current) {
      modelFileInputRef.current.value = "";
    }
  }

  function closeAddModelModal() {
    setIsAddModelModalOpen(false);
    resetAddModelForm();
  }

  function handleManagedModelChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextValue = event.target.value;

    if (nextValue === addModelOptionValue) {
      setIsAddModelModalOpen(true);
      return;
    }

    setSelectedManagedModelId(nextValue);
  }

  function handleModelFileChange(event: ChangeEvent<HTMLInputElement>) {
    setUploadedModelFile(event.target.files?.[0] ?? null);
  }

  function handleAddModelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = newModelName.trim();
    if (!trimmedName) {
      return;
    }

    const nextModel: ManagedModelOption = {
      id: `custom-model-${Date.now()}`,
      label: trimmedName,
      provider: "Custom"
    };

    setManagedModels((currentModels) => [nextModel, ...currentModels]);
    setSelectedManagedModelId(nextModel.id);
    closeAddModelModal();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const form = event.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  }

  function renderComposer(empty: boolean) {
    if (empty) {
      return (
        <form className="composer-panel empty composer-panel-hero" onSubmit={handleSubmit}>
          <textarea
            className="composer-hero-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={composerPlaceholder}
            rows={1}
          />

          <div className="composer-hero-toolbar">
            <div className="composer-hero-actions">
              <button className="composer-icon-button composer-icon-button-hero" type="button" aria-label="Add context">
                <PlusIcon />
              </button>

              <button className="composer-mode-button" type="button" aria-label="Reasoning mode: Thinking">
                <OrbitIcon className="composer-mode-icon" />
                <span>Thinking</span>
                <CaretDownIcon className="composer-mode-caret" />
              </button>
            </div>

            <div className="composer-hero-actions composer-hero-actions-right">
              <button className="composer-icon-button composer-mic-button" type="button" aria-label="Voice input">
                <MicrophoneIcon />
              </button>

              <button
                className="composer-voice-submit"
                type="submit"
                aria-label={isLoading ? "Working" : "Send message"}
                disabled={isLoading || !draft.trim()}
              >
                <WaveformIcon />
              </button>
            </div>
          </div>
        </form>
      );
    }

    return (
      <form className="composer-panel" onSubmit={handleSubmit}>
        <button className="composer-icon-button" type="button" aria-label="Add context">
          <PlusIcon />
        </button>

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder={composerPlaceholder}
          rows={1}
        />

        <button className="composer-submit" type="submit" disabled={isLoading || !draft.trim()}>
          {isLoading ? "Working" : "Send"}
        </button>
      </form>
    );
  }

  function renderPlaceholderPage(view: Exclude<WorkspaceView, "new_chat">) {
    const pageDetails = workspacePageDetails[view];

    return (
      <section className="workspace-placeholder">
        <div className={`workspace-placeholder-card${pageDetails?.featured ? " featured" : ""}`}>
          <p className="workspace-placeholder-kicker">{pageDetails?.kicker ?? "Workspace"}</p>
          <h2 className="workspace-placeholder-title">{workspaceLabels[view]}</h2>
          <p className="workspace-placeholder-copy">{pageDetails?.description ?? "This page is under construction."}</p>

          {pageDetails?.aboutTitle && pageDetails.aboutCopy ? (
            <div className="workspace-placeholder-highlight">
              <p className="workspace-placeholder-about-title">{pageDetails.aboutTitle}</p>
              <p className="workspace-placeholder-about-copy">{pageDetails.aboutCopy}</p>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderWorkspaceHeader() {
    if (activeWorkspace === "new_chat") {
      return (
        <header className="workspace-topbar">
          <div className="workspace-title-row">
            <label className="model-control llm-model-control">
              <select value={selectedManagedModelId} onChange={handleManagedModelChange}>
                <option value="">Models</option>
                <option value={addModelOptionValue}>Add your Model</option>
                {managedModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="workspace-actions llm-workspace-actions-empty" aria-hidden="true" />
        </header>
      );
    }

    if (activeWorkspace === "llms") {
      return (
        <header className="workspace-topbar llm-workspace-topbar">
          <div className="workspace-title-row">
            <label className="model-control llm-model-control">
              <select value={selectedManagedModelId} onChange={handleManagedModelChange}>
                <option value="">Models</option>
                <option value={addModelOptionValue}>Add your Model</option>
                {managedModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="workspace-actions llm-workspace-actions-empty" aria-hidden="true" />
        </header>
      );
    }

    return null;
  }

  return (
    <div className={`app-shell${isSidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <Sidebar
        activeNavKey={activeWorkspace}
        projects={projects}
        conversations={conversations}
        activeConversationId={activeConversationId}
        accountName={accountName}
        isCollapsed={isSidebarCollapsed}
        onCreateProject={handleCreateProject}
        onNewConversation={handleNewConversation}
        onSelectConversation={(conversationId) => {
          setActiveWorkspace("new_chat");
          setActiveConversationId(conversationId);
        }}
        onSelectNav={(itemKey) => setActiveWorkspace(itemKey as WorkspaceView)}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
      />

      <main className="workspace">
        {renderWorkspaceHeader()}
        {false ? (
        <header className="workspace-topbar">
          <div className="workspace-title-row">
            <button className="chat-title-button" type="button">
              <span>{appName}</span>
              <span className="title-caret">⌄</span>
            </button>
          </div>

          <div className="workspace-actions">
            <label className="model-control">
              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value as ModelId)}
              >
                {availableModels.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        ) : null}

        {activeWorkspace !== "new_chat" ? (
          renderPlaceholderPage(activeWorkspace)
        ) : isEmpty ? (
          <section className="empty-state">
            <h2 className="empty-title">{emptyStateTitle}</h2>
            <p className="empty-prompt" aria-label={`Ideas: ${emptyStatePrompts.join(", ")}`}>
              <span>{rotatingPrompt || "\u00A0"}</span>
              <span className="empty-prompt-caret" aria-hidden="true" />
            </p>
            {renderComposer(true)}
          </section>
        ) : (
          <>
            <section className="thread-panel">
              {activeMessages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {isLoading ? (
                <article className="message-row assistant">
                  <div className="message-meta assistant">
                    <strong>{appName}</strong>
                    <span>Working</span>
                  </div>
                  <div className="message-bubble assistant loading">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </article>
              ) : null}
              <div ref={bottomRef} />
            </section>

            {renderComposer(false)}
          </>
        )}

        {activeWorkspace === "llms" && isAddModelModalOpen ? (
          <div className="workspace-modal-backdrop" role="presentation" onClick={closeAddModelModal}>
            <div
              className="workspace-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-model-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="workspace-modal-header">
                <div>
                  <p className="workspace-modal-kicker">Models</p>
                  <h3 id="add-model-title" className="workspace-modal-title">
                    Add your Model
                  </h3>
                </div>

                <button className="workspace-modal-close" type="button" aria-label="Close add model modal" onClick={closeAddModelModal}>
                  x
                </button>
              </div>

              <form className="workspace-modal-form" onSubmit={handleAddModelSubmit}>
                <label className="workspace-modal-field">
                  <span>Model name</span>
                  <input
                    type="text"
                    value={newModelName}
                    onChange={(event) => setNewModelName(event.target.value)}
                    placeholder="Enter your model name"
                    required
                  />
                </label>

                <label className="workspace-modal-field">
                  <span>API key</span>
                  <input
                    type="password"
                    value={newModelApiKey}
                    onChange={(event) => setNewModelApiKey(event.target.value)}
                    placeholder="Paste your API key"
                  />
                </label>

                <div className="workspace-modal-field">
                  <span>Upload document</span>
                  <div className="workspace-modal-upload-row">
                    <input
                      ref={modelFileInputRef}
                      className="workspace-modal-file-input"
                      type="file"
                      accept=".pdf,.json,.doc,.docx"
                      onChange={handleModelFileChange}
                    />

                    <button
                      className="workspace-modal-upload-button"
                      type="button"
                      onClick={() => modelFileInputRef.current?.click()}
                    >
                      Upload file
                    </button>

                    <span className="workspace-modal-file-name">{uploadedModelFile?.name ?? "PDF, Word, or JSON"}</span>
                  </div>
                </div>

                <label className="workspace-modal-field">
                  <span>Prompt instructions, guardrails, and configuration</span>
                  <textarea
                    value={newModelInstructions}
                    onChange={(event) => setNewModelInstructions(event.target.value)}
                    placeholder="Add prompt instructions, guardrails, safety notes, or configuration details"
                    rows={7}
                  />
                </label>

                <div className="workspace-modal-actions">
                  <button className="workspace-modal-secondary" type="button" onClick={closeAddModelModal}>
                    Cancel
                  </button>

                  <button className="workspace-modal-primary" type="submit">
                    Save model
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
