import { FormEvent, KeyboardEvent, SVGProps, useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/components/ChatMessage.tsx";
import { Sidebar } from "@/components/Sidebar.tsx";
import { seededConversations } from "@/data/mockData.ts";
import { appName, composerPlaceholder, emptyStatePrompts, emptyStateTitle } from "@/lib/appConfig.ts";
import { fetchAvailableModels, requestAssistantReply } from "@/lib/chatClient.ts";
import { defaultModelOptions } from "@/lib/models.ts";
import { Conversation, Message, ModelId, ModelOption } from "@/types.ts";

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

function buildFreshConversation(): Conversation {
  const now = new Date();

  return {
    id: `conv-${now.getTime()}`,
    title: "New chat",
    preview: "Let's Build...",
    updatedAt: "Ready",
    model: defaultModelOptions[0].id,
    messages: []
  };
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

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(seededConversations);
  const [activeConversationId, setActiveConversationId] = useState<string>(seededConversations[0].id);
  const [selectedModel, setSelectedModel] = useState<ModelId>(seededConversations[0].model);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>(defaultModelOptions);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const accountName: string | null = null;
  const rotatingPrompt = useTypewriterPrompt(emptyStatePrompts);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const isEmpty = activeConversation.messages.length === 0;

  useEffect(() => {
    setSelectedModel(activeConversation.model);
  }, [activeConversation.id, activeConversation.model]);

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
  }, [activeConversation.messages.length, isLoading]);

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

    setDraft("");
    setIsLoading(true);

    setConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              title: conversation.messages.length === 0 ? toConversationTitle(query) : conversation.title,
              preview: "Thinking...",
              updatedAt: formatUpdatedAt(now),
              model: selectedModel,
              messages: [...conversation.messages, userMessage]
            }
          : conversation
      )
    );

    try {
      const result = await requestAssistantReply({
        query,
        model: selectedModel,
        history: activeConversation.messages
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
          conversation.id === activeConversationId
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
          conversation.id === activeConversationId
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
    const nextConversation = buildFreshConversation();
    setConversations((currentConversations) => [nextConversation, ...currentConversations]);
    setActiveConversationId(nextConversation.id);
    setSelectedModel(nextConversation.model);
    setDraft("");
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
            rows={2}
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

  return (
    <div className={`app-shell${isSidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        accountName={accountName}
        isCollapsed={isSidebarCollapsed}
        onNewConversation={handleNewConversation}
        onSelectConversation={setActiveConversationId}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
      />

      <main className="workspace">
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

        {isEmpty ? (
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
              {activeConversation.messages.map((message) => (
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
      </main>
    </div>
  );
}
