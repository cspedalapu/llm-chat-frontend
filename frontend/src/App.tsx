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
    return (
      <form className={`composer-panel${empty ? " empty" : ""}`} onSubmit={handleSubmit}>
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
