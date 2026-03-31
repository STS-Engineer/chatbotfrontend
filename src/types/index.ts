export type StartupOption = {
  id: string;
  label: string;
  description: string;
  suggestions?: string[];
};

export type CostingOption = {
  id: string;
  label: string;
};

export type Topic = {
  code: string;
  title: string;
  summary: string;
};

export type TrainingModule = {
  code: string;
  title: string;
  objective: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  message: string;
  sources?: string[];
};

export type SessionSummary = {
  session_key: string;
  selected_costing: string;
  mode: string;
  topic_code: string | null;
  training_code: string | null;
  created_at: string;
  last_message: string | null;
};

export type ConversationSummary = {
  id: string;
  session_key: string;
  title: string;
  mode: string;
  selected_costing: string | null;
  topic_code: string | null;
  training_code: string | null;
  created_at: string;
  updated_at: string;
  last_message: string | null;
};

export type ConversationMessage = {
  role: "user" | "assistant";
  message: string;
  sources?: string[];
  created_at: string;
};

export type ConversationMessagesResponse = {
  conversation_id: string;
  title: string;
  messages: ConversationMessage[];
};

export type RetrievedContext = {
  id: string;
  kind: "costing" | "mode" | "topic" | "training";
  source: string;
  title: string;
  summary: string;
  score: number;
};
