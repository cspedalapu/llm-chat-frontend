import { appName } from "@/lib/appConfig.ts";
import { Message } from "@/types.ts";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

  return (
    <article className={`message-row ${message.role}`}>
      {isAssistant ? (
        <div className="message-meta assistant">
          <strong>{appName}</strong>
          <span>{message.timestamp}</span>
        </div>
      ) : null}

      <div className={`message-bubble ${message.role}${message.state === "error" ? " error" : ""}`}>
        <p>{message.text}</p>
      </div>
    </article>
  );
}
