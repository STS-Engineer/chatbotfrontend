import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import MessageContent from "./MessageContent";
import type { ChatMessage } from "../types";

type Props = {
  messages: ChatMessage[];
  onSend: (message: string) => Promise<void>;
  isSending?: boolean;
  isLoadingHistory?: boolean;
  canSend?: boolean;
  suggestions?: string[];
  title?: string;
};

export default function ChatWindow({
  messages,
  onSend,
  isSending = false,
  isLoadingHistory = false,
  canSend = true,
  suggestions = [],
  title = "Costing Assistant",
}: Props) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages, isLoadingHistory]);


  const submit = async () => {
    if (!input.trim() || isSending || isLoadingHistory || !canSend) return;
    const message = input;
    setInput("");
    await onSend(message);
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    await submit();
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (isSending || isLoadingHistory || !canSend) {
      return;
    }

    void onSend(suggestion);
  };

  return (
    <div className="chat-shell">
      <div className="chat-header">
        <div>
          <span className="section-kicker">Conversation</span>
          <h2>{title}</h2>
        </div>
        <div className="chat-header-actions">
          <div className="status-pill">
            <span className="status-dot" />
            Active
          </div>
        </div>
      </div>

      <div className="messages">
        {isLoadingHistory && (
          <div className="messages-empty">
            <strong>Loading conversation...</strong>
            <p>Saved messages will appear here in a moment.</p>
          </div>
        )}

        {!isLoadingHistory && messages.length === 0 && (
          <div className="messages-empty">
            <div className="messages-empty-card">
              <div className="messages-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation">
                  <rect
                    x="7"
                    y="9"
                    width="10"
                    height="8"
                    rx="2.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M10 7V5.8A2.2 2.2 0 0 1 12.2 3.6h-.4A2.2 2.2 0 0 1 14 5.8V7"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M4.8 10.5H7M17 10.5h2.2M12 12.2v1.8M10.2 14h3.6"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </div>
              <strong>
                {canSend ? "Start a conversation" : "No active conversation"}
              </strong>
              <p>
                {canSend
                  ? `Send the first message to begin chatting with ${title}.`
                  : "Click New Chat to create another conversation for this option."}
              </p>
              {canSend && suggestions.length > 0 && (
                <div className="messages-empty-suggestions">
                  <span className="messages-empty-suggestions-label">
                    Suggested question
                  </span>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="messages-empty-suggestion"
                      onClick={() => handleSuggestionClick(suggestion)}
                      type="button"
                      disabled={isSending || isLoadingHistory || !canSend}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!isLoadingHistory &&
          messages.map((msg, index) => (
            <article
              key={index}
              className={`bubble ${msg.role}${
                index === messages.length - 1 && isSending && msg.role === "assistant"
                  ? " streaming"
                  : ""
              }`}
            >

              <span className="bubble-role">
                {msg.role === "assistant" ? "Assistant" : "You"}
              </span>
              <div className="bubble-text">
                {msg.role === "assistant" ? (
                  <MessageContent content={msg.message} />
                ) : (
                  msg.message
                )}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="bubble-sources">
                  {msg.sources.map((source, sourceIndex) => (
                    <span className="source-chip" key={`${source}-${sourceIndex}`}>
                      {source}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="composer-shell">
        <span className="attach-icon" aria-hidden="true">
          +
        </span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message your costing assistant..."
          autoComplete="off"
          disabled={isSending || isLoadingHistory || !canSend}
        />
        <button
          className="send-btn"
          onClick={submit}
          type="button"
          disabled={isSending || isLoadingHistory || !canSend}
        >
          {isSending ? "..." : ">"}
        </button>
      </div>

      <p className="chat-note">
        Costing AI can make mistakes. Check important information.
      </p>
    </div>
  );
}
