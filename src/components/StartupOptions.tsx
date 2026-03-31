import type { StartupOption } from "../types";

type Props = {
  options: StartupOption[];
  selected: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
};

export default function StartupOptions({
  options,
  selected,
  onSelect,
  disabled = false,
}: Props) {
  const getDescription = (option: StartupOption) => {
    if (option.id === "overview") {
      return "A guided assistant for exploring the costing knowledge base, understanding the big picture, and finding the right starting point quickly.";
    }

    if (option.id === "topic") {
      return "A focused chatbot mode for deeper questions, detailed explanations, and discussion around a specific costing topic.";
    }

    if (option.id === "training") {
      return "An interactive training assistant that helps you learn concepts step by step and build confidence while you practice.";
    }

    return option.description;
  };

  const getBadge = (id: string) => {
    if (id === "overview") return "OV";
    if (id === "topic") return "TP";
    if (id === "training") return "TR";
    return "AI";
  };

  return (
    <div className="card-grid">
      {options.map((option) => (
        <button
          key={option.id}
          className={`option-card option-card-${option.id}${
            selected === option.id ? " selected" : ""
          }`}
          onClick={() => onSelect(option.id)}
          type="button"
          aria-pressed={selected === option.id}
          disabled={disabled}
        >
          <div className="option-card-header">
            <span className="option-icon">{getBadge(option.id)}</span>
            <span className="option-arrow">-&gt;</span>
          </div>
          <h3>{option.label}</h3>
          <p>{getDescription(option)}</p>
          <span className="option-divider" />
          <span className="option-action">Start Chatting -&gt;</span>
        </button>
      ))}
    </div>
  );
}
