import type { TrainingModule } from "../types";

type Props = {
  items: TrainingModule[];
  selected: string;
  onSelect: (code: string) => void;
};

export default function TrainingSelector({ items, selected, onSelect }: Props) {
  const hasTrainingModules = items.length > 0;

  return (
    <label className="field-panel">
      <span className="field-label">Choose a training module</span>
      <span className="field-help">
        Use a training module when you want the assistant to follow a learning
        path.
      </span>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        disabled={!hasTrainingModules}
      >
        <option value="">
          {hasTrainingModules
            ? "Select a training module"
            : "No training modules available yet"}
        </option>
        {items.map((item) => (
          <option key={item.code} value={item.code}>
            {item.code} - {item.title}
          </option>
        ))}
      </select>
    </label>
  );
}
