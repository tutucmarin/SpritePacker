import { useState } from "react";

type Props = {
  onClose: () => void;
  theme: "light" | "dark";
  onTheme: (v: "light" | "dark") => void;
};

export function SettingsDialog({ onClose, theme, onTheme }: Props) {
  const [tab, setTab] = useState<"general" | "docs" | "privacy">("general");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-large"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modal-header with-grid">
          <div />
          <h3>Menu</h3>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body settings-layout">
          <div className="settings-nav">
            <button
              className={`settings-nav-item ${tab === "general" ? "active" : ""}`}
              onClick={() => setTab("general")}
            >
              General
            </button>
            <button
              className={`settings-nav-item ${tab === "docs" ? "active" : ""}`}
              onClick={() => setTab("docs")}
            >
              Documentation
            </button>
            <button
              className={`settings-nav-item ${tab === "privacy" ? "active" : ""}`}
              onClick={() => setTab("privacy")}
            >
              Privacy
            </button>
          </div>
          <div className="settings-content">
            {tab === "general" && (
              <div className="setting-column">
                <div className="setting-row">
                  <span className="label">Theme</span>
                  <div className="control">
                    <select value={theme} onChange={(e) => onTheme(e.target.value as "light" | "dark")}>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>
                <div className="help" style={{ marginTop: 12 }}>
                  Version 1.0.0
                </div>
              </div>
            )}
            {tab === "docs" && <div className="help">Documentation coming soon.</div>}
            {tab === "privacy" && (
              <div className="help">
                No data is collected. All images and operations stay on the client side.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
