import { useEffect, useRef, useState } from "react";
import api, { API_BASE_URL } from "./api/client";
import ChatWindow from "./components/ChatWindow";
import StartupOptions from "./components/StartupOptions";
import type {
  ChatMessage,
  ConversationMessagesResponse,
  ConversationSummary,
  CostingOption,
  SessionSummary,
  StartupOption,
} from "./types";
import "./style.css";

const HISTORY_LOAD_ERROR =
  "Saved conversations could not be loaded. Check that the backend API is running on https://costing-product-bk.azurewebsites.net.";
const APP_STATE_STORAGE_KEY = "avocarbon-chatbot-state";
const DEFAULT_COSTING_OPTIONS: CostingOption[] = [
  {
    id: "product_costing",
    label: "Product Costing",
  },
];
const DEFAULT_STARTUP_OPTIONS: StartupOption[] = [
  {
    id: "overview",
    label: "Have a general overview",
    description: "Get a broad overview of the costing knowledge base.",
    suggestions: [
      "What are the topics?",
      "What training options are available?",
      "The client is giving a very low target price. How should I interpret it?"
    ],
  },
  {
    id: "topic",
    label: "Engage a discussion about a specific topic",
    description: "Choose a topic and explore it in depth.",
    suggestions: ["My material cost is too high. What should I do?",
      "What are the available topics?"
    ],
  },
  {
    id: "training",
    label: "Get some training",
    description: "Follow a training-oriented conversation.",
    suggestions: ["Should productivity be factored into the project price?",
      "What are the available trainings?",
    ],
  },
];

const mergeStartupOptionDefaults = (
  options: StartupOption[],
): StartupOption[] =>
  options.map((option) => {
    const defaultOption = DEFAULT_STARTUP_OPTIONS.find(
      (defaultItem) => defaultItem.id === option.id,
    );

    if (!defaultOption) {
      return option;
    }

    return {
      ...defaultOption,
      ...option,
      suggestions:
        option.suggestions && option.suggestions.length > 0
          ? option.suggestions
          : defaultOption.suggestions,
    };
  });

type PersistedAppState = {
  view: "selection" | "chat";
  selectedCostingId: string;
  mode: string;
  sessionKey: string;
  conversationId: string;
  conversationTitle: string;
};

const readPersistedAppState = (): PersistedAppState | null => {
  try {
    const rawValue = window.localStorage.getItem(APP_STATE_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as PersistedAppState;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const buildEmptySession = (
  sessionKey: string,
  selectedCosting: string,
  mode: string,
): SessionSummary => ({
  session_key: sessionKey,
  selected_costing: selectedCosting,
  mode,
  topic_code: null,
  training_code: null,
  created_at: new Date().toISOString(),
  last_message: null,
});

export default function App() {
  const persistedAppStateRef = useRef<PersistedAppState | null>(
    readPersistedAppState(),
  );
  const [costingOptions, setCostingOptions] = useState<CostingOption[]>([]);
  const [startupOptions, setStartupOptions] = useState<StartupOption[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedCostingId, setSelectedCostingId] = useState(
    persistedAppStateRef.current?.selectedCostingId ?? "",
  );
  const [mode, setMode] = useState(persistedAppStateRef.current?.mode ?? "");
  const [sessionKey, setSessionKey] = useState(
    persistedAppStateRef.current?.sessionKey ?? "",
  );
  const [conversationId, setConversationId] = useState(
    persistedAppStateRef.current?.conversationId ?? "",
  );
  const [conversationTitle, setConversationTitle] = useState(
    persistedAppStateRef.current?.conversationTitle ?? "",
  );
  const [editingConversationId, setEditingConversationId] = useState("");
  const [editingConversationTitle, setEditingConversationTitle] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingBaseData, setIsLoadingBaseData] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isUpdatingConversation, setIsUpdatingConversation] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeConversationActionId, setActiveConversationActionId] = useState("");
  const [baseLoadError, setBaseLoadError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [hasRestoredState, setHasRestoredState] = useState(false);

  const availableCostingOptions =
    costingOptions.length > 0 ? costingOptions : DEFAULT_COSTING_OPTIONS;
  const availableStartupOptions =
    startupOptions.length > 0
      ? mergeStartupOptionDefaults(startupOptions)
      : DEFAULT_STARTUP_OPTIONS;
  const selectedCosting =
    availableCostingOptions.find((option) => option.id === selectedCostingId) ??
    availableCostingOptions.find((option) => option.id === "product_costing") ??
    availableCostingOptions[0];
  const selectedMode = availableStartupOptions.find((option) => option.id === mode);
  const activeConversation = conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  const isSelectionView = !sessionKey;
  const isNavigatingConversation =
    isSending ||
    isLoadingMessages ||
    isStartingSession ||
    isCreatingConversation ||
    isUpdatingConversation;

  useEffect(() => {
    if (!hasRestoredState) {
      return;
    }

    const nextState: PersistedAppState = {
      view: sessionKey ? "chat" : "selection",
      selectedCostingId,
      mode,
      sessionKey,
      conversationId,
      conversationTitle,
    };

    window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(nextState));
  }, [
    conversationId,
    conversationTitle,
    hasRestoredState,
    mode,
    selectedCostingId,
    sessionKey,
  ]);

  const refreshConversations = async (silent = false) => {
    if (!silent) {
      setIsLoadingHistory(true);
    }

    setHistoryError("");

    try {
      const res = await api.get<ConversationSummary[]>("/conversations");
      setConversations(res.data);
      return res.data;
    } catch (error) {
      console.error(error);
      setHistoryError(HISTORY_LOAD_ERROR);
      return [] as ConversationSummary[];
    } finally {
      if (!silent) {
        setIsLoadingHistory(false);
      }
    }
  };

  const loadConversation = async (nextConversation: ConversationSummary, force = false) => {
    if (!force && nextConversation.id === conversationId && !isSelectionView) {
      return;
    }

    setSessionError("");
    setSessionKey(nextConversation.session_key);
    setConversationId(nextConversation.id);
    setConversationTitle(nextConversation.title);
    setMode(nextConversation.mode);
    if (nextConversation.selected_costing) {
      setSelectedCostingId(nextConversation.selected_costing);
    }
    setMessages([]);
    setIsLoadingMessages(true);

    try {
      const res = await api.get<ConversationMessagesResponse>(
        `/conversations/${nextConversation.id}/messages`,
      );

      setConversationTitle(res.data.title);
      setMessages(
        res.data.messages.map((item) => ({
          role: item.role,
          message: item.message,
          sources: item.sources ?? [],
        })),
      );
    } catch (error) {
      console.error(error);
      setSessionError(
        "The selected conversation could not be loaded. Please try again.",
      );
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const getConversationTitle = (session: SessionSummary) => {
    const modeLabel =
      availableStartupOptions.find((option) => option.id === session.mode)?.label ??
      session.mode;
    const count =
      conversations.filter(
        (conversation) => conversation.session_key === session.session_key,
      ).length + 1;

    return count === 1 ? modeLabel : `${modeLabel} ${count}`;
  };

  const createConversationForSession = async (session: SessionSummary) => {
    setSessionError("");
    setSessionKey(session.session_key);
    setMode(session.mode);
    setSelectedCostingId(session.selected_costing);
    setConversationId("");
    setConversationTitle("");
    setMessages([]);
    setIsCreatingConversation(true);

    try {
      const res = await api.post<ConversationSummary>("/conversations", {
        session_key: session.session_key,
        title: getConversationTitle(session),
      });

      setConversationId(res.data.id);
      setConversationTitle(res.data.title);
      setConversations((prev) => [
        res.data,
        ...prev.filter((conversation) => conversation.id !== res.data.id),
      ]);
    } catch (error) {
      console.error(error);
      setSessionError(
        "A new conversation could not be created for this option. Please try again.",
      );
    } finally {
      setIsCreatingConversation(false);
      void refreshConversations(true);
    }
  };

  useEffect(() => {
    const load = async () => {
      const persistedState = persistedAppStateRef.current;
      try {
        setIsLoadingBaseData(true);
        setBaseLoadError("");

        try {
          const [costingRes, optionsRes] = await Promise.all([
            api.get<CostingOption[]>("/costing-options"),
            api.get<StartupOption[]>("/startup-options"),
          ]);

          const nextCostingOptions =
            costingRes.data.length > 0 ? costingRes.data : DEFAULT_COSTING_OPTIONS;
          const nextStartupOptions =
            optionsRes.data.length > 0
              ? mergeStartupOptionDefaults(optionsRes.data)
              : DEFAULT_STARTUP_OPTIONS;

          setCostingOptions(nextCostingOptions);
          setStartupOptions(nextStartupOptions);

          const persistedCostingId = nextCostingOptions.find(
            (option) => option.id === persistedState?.selectedCostingId,
          )?.id;

          if (persistedCostingId) {
            setSelectedCostingId(persistedCostingId);
          } else if (nextCostingOptions.length > 0) {
            setSelectedCostingId(nextCostingOptions[0].id);
          }
        } catch (error) {
          console.error(error);
          setCostingOptions(DEFAULT_COSTING_OPTIONS);
          setStartupOptions(DEFAULT_STARTUP_OPTIONS);
          setSelectedCostingId(DEFAULT_COSTING_OPTIONS[0].id);
          setBaseLoadError(
            "The chatbot could not load the costing and startup options. Check that the backend API is running on https://costing-product-bk.azurewebsites.net.",
          );
        } finally {
          setIsLoadingBaseData(false);
        }

        const existingConversations = await refreshConversations();

        if (persistedState?.view === "chat" && persistedState.conversationId) {
          const persistedConversation = existingConversations.find(
            (conversation) => conversation.id === persistedState.conversationId,
          );

          if (persistedConversation) {
            await loadConversation(persistedConversation, true);
            return;
          }
        }
      } finally {
        setHasRestoredState(true);
      }
    };

    void load();
  }, []);

  const ensureSessionForMode = async (nextMode: string) => {
    if (!selectedCosting) {
      return null;
    }

    const existingConversation = conversations.find(
      (conversation) =>
        conversation.selected_costing === selectedCosting.id &&
        conversation.mode === nextMode &&
        !conversation.topic_code &&
        !conversation.training_code,
    );

    if (existingConversation) {
      return buildEmptySession(
        existingConversation.session_key,
        existingConversation.selected_costing ?? selectedCosting.id,
        existingConversation.mode,
      );
    }

    const res = await api.post<{
      session_key: string;
      mode: string;
    }>("/sessions", {
      selected_costing: selectedCosting.id,
      mode: nextMode,
      topic_code: null,
      training_code: null,
    });

    const createdSession = buildEmptySession(
      res.data.session_key,
      selectedCosting.id,
      nextMode,
    );

    return createdSession;
  };

  const openChatForMode = async (nextMode: string) => {
    if (!selectedCosting) {
      setSessionError("Please select a costing option first.");
      return;
    }

    setMode(nextMode);
    setSessionError("");
    setIsStartingSession(true);

    try {
      const session = await ensureSessionForMode(nextMode);

      if (!session) {
        return;
      }

      setSessionKey(session.session_key);
      setSelectedCostingId(session.selected_costing);

      const existingConversation = conversations.find(
        (conversation) => conversation.session_key === session.session_key,
      );

      if (existingConversation) {
        await loadConversation(existingConversation);
      } else {
        await createConversationForSession(session);
      }
    } catch (error) {
      console.error(error);
      setSessionError(
        "The chatbot session could not be opened. Please make sure the backend is available, then try again.",
      );
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleModeSelect = (nextMode: string) => {
    void openChatForMode(nextMode);
  };

  const sendMessage = async (message: string) => {
    if (!sessionKey || !conversationId) {
      return;
    }

    setSessionError("");
    setMessages((prev) => [...prev, { role: "user", message }]);
    setIsSending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_key: sessionKey,
          conversation_id: conversationId,
          message,
          mode,
          topic_code: null,
          training_code: null,
        }),
      });

      if (!response.ok) {
        throw new Error("Assistant connection failed.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Stream reader not available.");
      }

      setMessages((prev) => [...prev, { role: "assistant", message: "" }]);

      const decoder = new TextDecoder();
      let assistantMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantMessage += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = { ...last, message: assistantMessage };
          }
          return updated;
        });
      }

      void refreshConversations(true);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          message:
            "The chatbot could not generate an answer right now. Please check the backend and try again.",
        },
      ]);
      setSessionError(
        "The backend returned an error while generating the chat response.",
      );
    } finally {
      setIsSending(false);
    }
  };


  const handleBackToOptions = () => {
    if (isNavigatingConversation) {
      return;
    }

    setSessionKey("");
    setConversationId("");
    setConversationTitle("");
    setMessages([]);
    setMode("");
    setSessionError("");
    setEditingConversationId("");
    setEditingConversationTitle("");
    setActiveConversationActionId("");
  };

  const handleNewChat = () => {
    if (isNavigatingConversation) {
      return;
    }

    if (!sessionKey) {
      setSessionError("Open an option first, then click New Chat.");
      return;
    }

    const currentSession = buildEmptySession(
      sessionKey,
      selectedCosting?.id ?? selectedCostingId,
      mode,
    );

    void createConversationForSession(currentSession);
  };

  const handleConversationSelect = (nextConversation: ConversationSummary) => {
    if (isNavigatingConversation) {
      return;
    }

    void loadConversation(nextConversation);
  };

  const handleRenameConversation = (conversation: ConversationSummary) => {
    if (isNavigatingConversation) {
      return;
    }

    setSessionError("");
    setEditingConversationId(conversation.id);
    setEditingConversationTitle(conversation.title);
  };

  const handleCancelConversationRename = () => {
    setEditingConversationId("");
    setEditingConversationTitle("");
  };

  const handleSaveConversationRename = async (
    conversation: ConversationSummary,
  ) => {
    const nextTitle = editingConversationTitle.trim();

    if (!nextTitle) {
      setSessionError("Conversation title cannot be empty.");
      return;
    }

    if (nextTitle === conversation.title) {
      handleCancelConversationRename();
      return;
    }

    setSessionError("");
    setActiveConversationActionId(conversation.id);
    setIsUpdatingConversation(true);

    try {
      const res = await api.patch<{ id: string; title: string }>(
        `/conversations/${conversation.id}/title`,
        { title: nextTitle },
      );

      setConversations((prev) =>
        prev.map((item) =>
          item.id === conversation.id ? { ...item, title: res.data.title } : item,
        ),
      );

      if (conversation.id === conversationId) {
        setConversationTitle(res.data.title);
      }

      handleCancelConversationRename();
    } catch (error) {
      console.error(error);
      setSessionError(
        "The conversation title could not be updated. Please try again.",
      );
    } finally {
      setActiveConversationActionId("");
      setIsUpdatingConversation(false);
    }
  };

  const handleDeleteConversation = async (conversation: ConversationSummary) => {
    if (isNavigatingConversation) {
      return;
    }

    setSessionError("");
    if (editingConversationId === conversation.id) {
      handleCancelConversationRename();
    }
    setActiveConversationActionId(conversation.id);
    setIsUpdatingConversation(true);

    try {
      await api.delete(`/conversations/${conversation.id}`);

      const remainingConversations = conversations.filter(
        (item) => item.id !== conversation.id,
      );

      setConversations(remainingConversations);

      if (conversation.id === conversationId) {
        const nextConversation = remainingConversations.find(
          (item) => item.session_key === conversation.session_key,
        );

        if (nextConversation) {
          await loadConversation(nextConversation);
        } else {
          setConversationId("");
          setConversationTitle("");
          setMessages([]);
        }
      }
    } catch (error) {
      console.error(error);
      setSessionError(
        "The conversation could not be deleted. Please try again.",
      );
    } finally {
      setActiveConversationActionId("");
      setIsUpdatingConversation(false);
    }
  };

  let visibleConversations = sessionKey
    ? conversations.filter((conversation) => conversation.session_key === sessionKey)
    : conversations;

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    visibleConversations = visibleConversations.filter((conversation) => {
      const conversationMode =
        availableStartupOptions.find((option) => option.id === conversation.mode)?.label ??
        conversation.mode;
      const title = conversation.title || conversationMode;
      const preview = conversation.last_message ?? `Ready in ${conversationMode}`;

      return (
        title.toLowerCase().includes(query) ||
        preview.toLowerCase().includes(query)
      );
    });
  }

  const historyEntries = visibleConversations.map((conversation) => {
    const conversationMode =
      availableStartupOptions.find((option) => option.id === conversation.mode)?.label ??
      conversation.mode;

    return {
      id: conversation.id,
      title: conversation.title || conversationMode,
      preview:
        conversation.last_message ?? `Ready in ${conversationMode}`,
      active: conversation.id === conversationId,
      conversation,
    };
  });

  return (
    <div className="app">
      <div className={`workspace-shell${isSelectionView ? " selection-workspace" : ""}`}>
        {!isSelectionView && (
          <aside className="workspace-sidebar">
            <div className="sidebar-brand">
              <div className="brand-mark">AC</div>
              <div className="brand-copy">
                <strong>AVOCarbon</strong>
                <span>Costing AI Workspace</span>
              </div>
            </div>

            <button
              className="sidebar-primary"
              onClick={handleNewChat}
              type="button"
              disabled={isNavigatingConversation}
            >
              <span className="sidebar-primary-icon">+</span>
              <span>New Chat</span>
            </button>

            <label className="sidebar-search">
              <span className="sidebar-search-icon" aria-hidden="true">
                o
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats"
                aria-label="Search chats"
              />
            </label>

            <div className="sidebar-section">
              <span className="sidebar-label">Workspace</span>
              <div className="sidebar-panel">
                <span className="sidebar-panel-title">Current costing</span>
                <strong>{selectedCosting?.label ?? "Select costing"}</strong>
                <p>
                  New Chat creates another conversation inside this option.
                </p>
              </div>
            </div>

            <div className="sidebar-section">
              <span className="sidebar-label">
                {sessionKey ? "Conversations" : "All Conversations"}
              </span>
              <div className="sidebar-list">
                {isLoadingHistory && historyEntries.length === 0 && (
                  <div className="sidebar-list-empty">
                    <strong>Loading history...</strong>
                    <p>Saved conversations will appear here.</p>
                  </div>
                )}

                {!isLoadingHistory && historyError && historyEntries.length === 0 && (
                  <div className="sidebar-list-empty">
                    <strong>History unavailable</strong>
                    <p>{historyError}</p>
                  </div>
                )}

                {!isLoadingHistory &&
                  !historyError &&
                  historyEntries.length === 0 && (
                    <div className="sidebar-list-empty">
                      <strong>No conversations yet</strong>
                      <p>Click New Chat to add another conversation for this option.</p>
                    </div>
                  )}

                {historyEntries.map((entry) => {
                  const isActionPending =
                    activeConversationActionId === entry.id && isUpdatingConversation;
                  const isEditing = editingConversationId === entry.id;

                  return (
                    <div
                      key={entry.id}
                      className={`sidebar-list-row${entry.active ? " active" : ""}`}
                    >
                      {isEditing ? (
                        <div
                          className={`sidebar-list-item editing${entry.active ? " active" : ""
                            }`}
                        >
                          <span className="sidebar-list-icon" aria-hidden="true">
                            []
                          </span>
                          <span className="sidebar-list-copy">
                            <input
                              className="sidebar-title-input"
                              value={editingConversationTitle}
                              onChange={(event) =>
                                setEditingConversationTitle(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleSaveConversationRename(entry.conversation);
                                }

                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  handleCancelConversationRename();
                                }
                              }}
                              autoFocus
                            />
                            <span className="sidebar-list-preview">{entry.preview}</span>
                          </span>
                        </div>
                      ) : (
                        <button
                          className={`sidebar-list-item${entry.active ? " active" : ""}`}
                          onClick={() => handleConversationSelect(entry.conversation)}
                          type="button"
                          disabled={isNavigatingConversation}
                        >
                          <span className="sidebar-list-icon" aria-hidden="true">
                            []
                          </span>
                          <span className="sidebar-list-copy">
                            <span className="sidebar-list-title">{entry.title}</span>
                            <span className="sidebar-list-preview">{entry.preview}</span>
                          </span>
                        </button>
                      )}

                      <div className="sidebar-list-actions">
                        {isEditing ? (
                          <>
                            <button
                              className="sidebar-action-btn success"
                              onClick={() =>
                                void handleSaveConversationRename(entry.conversation)
                              }
                              type="button"
                              disabled={isNavigatingConversation}
                              aria-label={`Save ${entry.title}`}
                              title="Save title"
                            >
                              <svg
                                className="sidebar-action-icon"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  d="M5 12l4 4L19 6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.8"
                                />
                              </svg>
                            </button>
                            <button
                              className="sidebar-action-btn"
                              onClick={handleCancelConversationRename}
                              type="button"
                              disabled={isNavigatingConversation}
                              aria-label={`Cancel editing ${entry.title}`}
                              title="Cancel"
                            >
                              <svg
                                className="sidebar-action-icon"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  d="M7 7l10 10"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.8"
                                />
                                <path
                                  d="M17 7L7 17"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.8"
                                />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="sidebar-action-btn"
                              onClick={() => handleRenameConversation(entry.conversation)}
                              type="button"
                              disabled={isNavigatingConversation}
                              aria-label={`Rename ${entry.title}`}
                              title="Rename conversation"
                            >
                              <svg
                                className="sidebar-action-icon"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  d="M4 20h4l10-10-4-4L4 16v4Z"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.8"
                                />
                                <path
                                  d="M12.5 7.5l4 4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.8"
                                />
                              </svg>
                            </button>
                            <button
                              className="sidebar-action-btn danger"
                              onClick={() => void handleDeleteConversation(entry.conversation)}
                              type="button"
                              disabled={isNavigatingConversation}
                              aria-label={`Delete ${entry.title}`}
                              title="Delete conversation"
                            >
                              {isActionPending ? (
                                <span
                                  className="sidebar-action-loader"
                                  aria-hidden="true"
                                />
                              ) : (
                                <svg
                                  className="sidebar-action-icon"
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M5 7h14"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.8"
                                  />
                                  <path
                                    d="M9 7V5h6v2"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.8"
                                  />
                                  <path
                                    d="M8 7l1 12h6l1-12"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.8"
                                  />
                                  <path
                                    d="M10.5 10.5v5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.8"
                                  />
                                  <path
                                    d="M13.5 10.5v5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.8"
                                  />
                                </svg>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sidebar-footer">
              <button
                className="sidebar-secondary"
                onClick={handleBackToOptions}
                type="button"
                disabled={isNavigatingConversation}
              >
                Back To Options
              </button>
            </div>

          </aside>
        )}

        <main
          className={`workspace-main${isSelectionView ? " selection-main" : " chat-main"}`}
        >
          {baseLoadError && <div className="status-banner error">{baseLoadError}</div>}
          {sessionError && <div className="status-banner warning">{sessionError}</div>}

          {!sessionKey && (
            <>
              <header className="selection-navbar">
                <div className="selection-navbar-brand">
                  <div className="brand-mark">AC</div>
                  <div className="brand-copy">
                    <strong>AVOCarbon</strong>
                    <span>Costing AI Workspace</span>
                  </div>
                </div>
              </header>

              <section className="selection-stage coaching-stage selection-content-shell" style={{ flex: 'none' }}>
                <div className="coaching-hero">
                  <div className="coaching-copy-block">
                    <span className="coaching-kicker">AVOCarbon AI Workspace</span>
                    <h1>Chatbot for  Product Costing</h1>
                    <p className="coaching-copy">
                      An integrated costing platform for overview,
                      problem-solving, learning, and guided support across your
                      AVOCarbon knowledge base.
                    </p>
                    <p className="coaching-subcopy">
                      Choose a chatbot assistant to open that option and manage
                      multiple conversations inside it.
                    </p>
                  </div>
                </div>

                <div className="selection-grid-shell">
                  <StartupOptions
                    options={availableStartupOptions}
                    selected={mode}
                    onSelect={handleModeSelect}
                    disabled={isStartingSession || isLoadingBaseData}
                  />
                </div>
              </section>

              <footer className="modern-footer">
                <div className="footer-top-accent" />
                <div className="footer-container">
                  <div className="footer-glow footer-glow-tl" />
                  <div className="footer-glow footer-glow-br" />

                  <div className="footer-main-grid">
                    <div className="footer-col brand-col">
                      <div className="footer-brand-header">
                        <div className="footer-brand-logo">AC</div>
                        <div>
                          <strong>AVOCarbon</strong>
                          <span>Costing AI Workspace</span>
                        </div>
                      </div>
                      <p className="footer-description">
                        An advanced AI-powered costing workspace built for speed, precision,
                        and intelligent decision-making across your knowledge base.
                      </p>
                      <div className="footer-socials">
                        <a href="#" aria-label="LinkedIn">LN</a>
                        <a href="#" aria-label="Twitter">TW</a>
                        <a href="#" aria-label="GitHub">GH</a>
                      </div>
                    </div>

                    <div className="footer-col">
                      <h4 className="footer-title">Product</h4>
                      <nav className="footer-nav">
                        <a href="#">Overview</a>
                        <a href="#">Methodology</a>
                        <a href="#">Knowledge Base</a>
                        <a href="#">Changelog</a>
                      </nav>
                    </div>

                    <div className="footer-col">
                      <h4 className="footer-title">Resources</h4>
                      <nav className="footer-nav">
                        <a href="#">Help Center</a>
                        <a href="#">API Docs</a>
                        <a href="#">Community</a>
                        <a href="#">Case Studies</a>
                      </nav>
                    </div>

                    <div className="footer-col">
                      <h4 className="footer-title">Legal</h4>
                      <nav className="footer-nav">
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                        <a href="#">Security</a>
                        <a href="#">Ethics</a>
                      </nav>
                    </div>
                  </div>

                  <div className="footer-bottom">
                    <div className="footer-bottom-content">
                      <span className="copyright">&copy; 2026 AVOCarbon AI. All rights reserved.</span>
                      <div className="footer-badges">
                        <span className="badge-item">Powered by <strong>AI Engineering</strong></span>
                        <span className="badge-item status-badge"><strong>System Online</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              </footer>
            </>
          )}


          {sessionKey && (
            <section className="chat-layout">
              <ChatWindow
                messages={messages}
                onSend={sendMessage}
                isSending={isSending}
                isLoadingHistory={isLoadingMessages || isCreatingConversation}
                canSend={Boolean(conversationId)}
                suggestions={selectedMode?.suggestions}
                title={
                  conversationTitle ||
                  activeConversation?.title ||
                  selectedMode?.label ||
                  "Costing Assistant"
                }
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
