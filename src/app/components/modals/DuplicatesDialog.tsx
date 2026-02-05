type Report = {
  count: number;
  groups: { hash: string; items: { idx: number; name: string }[] }[];
};

type Props = {
  report: Report;
  onClose: () => void;
  onDelete: (report: Report) => Promise<void> | void;
};

export function DuplicatesDialog({ report, onClose, onDelete }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
        <div className="modal-header mb-12">
          <h3>Duplicates</h3>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mb-12">Found {report.count} duplicate sprite(s).</div>
        <div className="scroll mb-12" style={{ maxHeight: 240 }}>
          {report.groups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 8 }}>
              <div className="help">Group {gi + 1}</div>
              {g.items.map((it) => (
                <div key={it.idx}>{it.name}</div>
              ))}
            </div>
          ))}
        </div>
        <div className="toolbar" style={{ justifyContent: "flex-end" }}>
          <button className="secondary" onClick={onClose}>
            Ignore
          </button>
          <button
            onClick={async () => {
              await onDelete(report);
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
