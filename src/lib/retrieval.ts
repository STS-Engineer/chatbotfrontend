import type {
  CostingOption,
  RetrievedContext,
  StartupOption,
  Topic,
  TrainingModule,
} from "../types";

type RetrievalParams = {
  costingOptions: CostingOption[];
  startupOptions: StartupOption[];
  topics: Topic[];
  trainingModules: TrainingModule[];
  mode: string;
  topicCode: string;
  trainingCode: string;
  selectedCostingId: string;
};

type CandidateDocument = {
  id: string;
  kind: RetrievedContext["kind"];
  source: string;
  title: string;
  summary: string;
  text: string;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "for",
  "from",
  "get",
  "have",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "you",
  "your",
]);

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function getDocumentScore(
  document: CandidateDocument,
  queryTerms: string[],
  mode: string,
  topicCode: string,
  trainingCode: string,
  selectedCostingId: string,
) {
  const documentTerms = new Set(tokenize(document.text));
  let score = 0;

  for (const term of queryTerms) {
    if (documentTerms.has(term)) {
      score += 2;
    }
  }

  if (document.id === `costing:${selectedCostingId}`) {
    score += 10;
  }

  if (document.id === `mode:${mode}`) {
    score += 14;
  }

  if (topicCode && document.id === `topic:${topicCode}`) {
    score += 18;
  }

  if (trainingCode && document.id === `training:${trainingCode}`) {
    score += 18;
  }

  if (mode === "topic" && document.kind === "topic") {
    score += 20;
  }

  if (mode === "training" && document.kind === "training") {
    score += 20;
  }

  if (mode === "overview" && document.kind === "costing") {
    score += 8;
  }

  return score;
}

export function retrieveRelevantContext({
  costingOptions,
  startupOptions,
  topics,
  trainingModules,
  mode,
  topicCode,
  trainingCode,
  selectedCostingId,
}: RetrievalParams): RetrievedContext[] {
  if (!mode) {
    return [];
  }

  const selectedCosting =
    costingOptions.find((option) => option.id === selectedCostingId) ??
    costingOptions[0];
  const selectedMode = startupOptions.find((option) => option.id === mode);
  const selectedTopic = topics.find((topic) => topic.code === topicCode);
  const selectedTraining = trainingModules.find(
    (item) => item.code === trainingCode,
  );

  const queryTerms = tokenize(
    [
      selectedCosting?.label,
      selectedMode?.label,
      selectedMode?.description,
      selectedTopic?.code,
      selectedTopic?.title,
      selectedTopic?.summary,
      selectedTraining?.code,
      selectedTraining?.title,
      selectedTraining?.objective,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const documents: CandidateDocument[] = [
    ...costingOptions.map((option) => ({
      id: `costing:${option.id}`,
      kind: "costing" as const,
      source: "Costing option",
      title: option.label,
      summary: `Core costing scope available for this chatbot session.`,
      text: `${option.label} costing scope chatbot session`,
    })),
    ...startupOptions.map((option) => ({
      id: `mode:${option.id}`,
      kind: "mode" as const,
      source: "Conversation mode",
      title: option.label,
      summary: option.description,
      text: `${option.label} ${option.description}`,
    })),
    ...topics.map((topic) => ({
      id: `topic:${topic.code}`,
      kind: "topic" as const,
      source: "Knowledge topic",
      title: `${topic.code} - ${topic.title}`,
      summary: topic.summary,
      text: `${topic.code} ${topic.title} ${topic.summary}`,
    })),
    ...trainingModules.map((module) => ({
      id: `training:${module.code}`,
      kind: "training" as const,
      source: "Training module",
      title: `${module.code} - ${module.title}`,
      summary: module.objective,
      text: `${module.code} ${module.title} ${module.objective}`,
    })),
  ];

  return documents
    .map((document) => ({
      id: document.id,
      kind: document.kind,
      source: document.source,
      title: document.title,
      summary: document.summary,
      score: getDocumentScore(
        document,
        queryTerms,
        mode,
        topicCode,
        trainingCode,
        selectedCostingId,
      ),
    }))
    .filter((document) => document.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}
