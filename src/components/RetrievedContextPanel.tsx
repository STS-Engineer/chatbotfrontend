import type { RetrievedContext } from "../types";

type Props = {
  items: RetrievedContext[];
  loading: boolean;
  emptyMessage: string;
  note?: string;
};

export default function RetrievedContextPanel({
  items,
  loading,
  emptyMessage,
  note,
}: Props) {
  return (
    <section className="retrieval-panel">
      <div className="section-heading retrieval-heading">
        <span className="section-kicker">RAG Preview</span>
        <h2>Retrieved context for the current selection</h2>
        <p>
          These are the knowledge cards matched to the option you selected.
        </p>
      </div>

      {note && <p className="retrieval-note">{note}</p>}

      {loading && (
        <div className="retrieval-empty">
          <strong>Loading knowledge sources...</strong>
          <p>The retrieval panel will update as soon as the API data arrives.</p>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="retrieval-empty">
          <strong>No retrieved context yet</strong>
          <p>{emptyMessage}</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="retrieval-grid">
          {items.map((item) => (
            <article key={item.id} className="retrieval-card">
              <div className="retrieval-meta">
                <span className="retrieval-source">{item.source}</span>
                <span className="retrieval-score">Match {item.score}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
