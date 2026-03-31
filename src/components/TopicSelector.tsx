import type { Topic } from "../types";

type Props = {
  topics: Topic[];
  selected: string;
  onSelect: (code: string) => void;
};

export default function TopicSelector({ topics, selected, onSelect }: Props) {
  const hasTopics = topics.length > 0;

  return (
    <label className="field-panel">
      <span className="field-label">Choose a topic</span>
      <span className="field-help">
        Focus the assistant on a specific topic for more targeted answers.
      </span>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        disabled={!hasTopics}
      >
        <option value="">
          {hasTopics ? "Select a topic" : "No topics available yet"}
        </option>
        {topics.map((topic) => (
          <option key={topic.code} value={topic.code}>
            {topic.code} - {topic.title}
          </option>
        ))}
      </select>
    </label>
  );
}
