import React, { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Wrench, FolderOpen, Keyboard } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import * as tauri from "../tauri";
import type { FileAssociation, HotkeyConfig } from "../types";

interface SettingsModalProps {
  onClose: () => void;
}

// [impl->feat~file-association-tool-mapping~1]
// [impl->req~tool-mapping-config~1]
// [impl->feat~cross-session-command-history~1]
// [impl->req~command-history-configurable-hotkeys~1]
const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [associations, setAssociations] = useState<FileAssociation[]>([]);
  const [newExt, setNewExt] = useState("");
  const [newTool, setNewTool] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hotkey config
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>({
    previousCommand: "Shift+ArrowUp",
    nextCommand: "Shift+ArrowDown",
  });
  const [recording, setRecording] = useState<"previous" | "next" | null>(null);

  const loadAssociations = useCallback(async () => {
    try {
      const list = await tauri.listFileAssociations();
      setAssociations(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("Failed to load associations:", e);
    }
  }, []);

  const loadHotkeys = useCallback(async () => {
    try {
      const cfg = await tauri.getHotkeyConfig();
      if (cfg) setHotkeys(cfg);
    } catch (e) {
      console.error("Failed to load hotkeys:", e);
    }
  }, []);

  useEffect(() => {
    loadAssociations();
    loadHotkeys();
  }, [loadAssociations, loadHotkeys]);

  // Key combination recorder
  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      if (e.metaKey) parts.push("Meta");
      if (e.key && !["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        parts.push(e.key);
      }
      const combo = parts.join("+");
      if (recording === "previous") {
        setHotkeys((prev) => ({ ...prev, previousCommand: combo }));
      } else {
        setHotkeys((prev) => ({ ...prev, nextCommand: combo }));
      }
      setRecording(null);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recording]);

  const handleBrowseTool = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
      });
      if (selected && typeof selected === "string") {
        setNewTool(selected);
      }
    } catch (e) {
      console.error("Browse failed:", e);
    }
  }, []);

  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const ext = newExt.trim().replace(/^\./, "");
      const tool = newTool.trim();
      if (!ext || !tool) return;

      setLoading(true);
      setError(null);
      try {
        await tauri.saveFileAssociation({ extension: ext, toolPath: tool });
        setNewExt("");
        setNewTool("");
        await loadAssociations();
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [newExt, newTool, loadAssociations],
  );

  const handleDelete = useCallback(
    async (ext: string) => {
      try {
        await tauri.deleteFileAssociation(ext);
        await loadAssociations();
      } catch (e) {
        console.error("Failed to delete association:", e);
      }
    },
    [loadAssociations],
  );

  const handleSaveHotkeys = useCallback(async () => {
    try {
      await tauri.saveHotkeyConfig(hotkeys);
    } catch (e) {
      console.error("Failed to save hotkeys:", e);
    }
  }, [hotkeys]);

  const handleClearCommandHistory = useCallback(async () => {
    try {
      await tauri.clearCommandHistory();
    } catch (e) {
      console.error("Failed to clear command history:", e);
    }
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-lg)",
          width: "100%",
          maxWidth: 520,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Wrench size={18} style={{ color: "var(--accent)" }} />
            <span
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Settings
            </span>
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: "20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {/* Keyboard / Hotkeys */}
          <div>
            <h3
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Keyboard size={16} style={{ color: "var(--accent)" }} />
              Keyboard
            </h3>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginBottom: 16,
              }}
            >
              Configure hotkeys for cross-session command history navigation.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: 12,
                backgroundColor: "var(--bg-secondary)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
              }}
            >
              {/* Previous command */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    minWidth: 140,
                  }}
                >
                  Previous Command
                </span>
                <input
                  value={hotkeys.previousCommand}
                  onChange={(e) =>
                    setHotkeys((prev) => ({
                      ...prev,
                      previousCommand: e.target.value,
                    }))
                  }
                  readOnly={recording === "previous"}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    backgroundColor:
                      recording === "previous"
                        ? "var(--bg-active)"
                        : "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontSize: "0.8125rem",
                    outline: "none",
                    fontFamily: "var(--font-mono)",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "var(--accent)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border-color)")
                  }
                />
                <button
                  onClick={() =>
                    setRecording((r) => (r === "previous" ? null : "previous"))
                  }
                  style={{
                    padding: "6px 12px",
                    backgroundColor:
                      recording === "previous"
                        ? "var(--accent)"
                        : "var(--bg-tertiary)",
                    color:
                      recording === "previous"
                        ? "#ffffff"
                        : "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {recording === "previous" ? "Recording..." : "Record"}
                </button>
              </div>

              {/* Next command */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    minWidth: 140,
                  }}
                >
                  Next Command
                </span>
                <input
                  value={hotkeys.nextCommand}
                  onChange={(e) =>
                    setHotkeys((prev) => ({
                      ...prev,
                      nextCommand: e.target.value,
                    }))
                  }
                  readOnly={recording === "next"}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    backgroundColor:
                      recording === "next"
                        ? "var(--bg-active)"
                        : "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontSize: "0.8125rem",
                    outline: "none",
                    fontFamily: "var(--font-mono)",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "var(--accent)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border-color)")
                  }
                />
                <button
                  onClick={() =>
                    setRecording((r) => (r === "next" ? null : "next"))
                  }
                  style={{
                    padding: "6px 12px",
                    backgroundColor:
                      recording === "next"
                        ? "var(--accent)"
                        : "var(--bg-tertiary)",
                    color:
                      recording === "next"
                        ? "#ffffff"
                        : "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {recording === "next" ? "Recording..." : "Record"}
                </button>
              </div>

              {recording && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--accent)",
                    textAlign: "center",
                  }}
                >
                  Press the desired key combination…
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleSaveHotkeys}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    backgroundColor: "var(--accent)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Save Hotkeys
                </button>
                <button
                  onClick={handleClearCommandHistory}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    backgroundColor: "transparent",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--error)";
                    e.currentTarget.style.borderColor = "var(--error)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.borderColor = "var(--border-color)";
                  }}
                >
                  <Trash2 size={14} />
                  Clear History
                </button>
              </div>
            </div>
          </div>

          {/* File Associations */}
          <div>
            <h3
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 12,
              }}
            >
              File Associations
            </h3>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginBottom: 16,
              }}
            >
              Choose which application opens each file type when you select
              &quot;Open&quot; from the remote file browser.
            </p>

            {/* Existing associations */}
            {associations.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                {associations.map((assoc) => (
                  <div
                    key={assoc.extension}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      backgroundColor: "var(--bg-secondary)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "var(--accent)",
                        backgroundColor: "var(--bg-tertiary)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                        textTransform: "uppercase",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      .{assoc.extension}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: "0.8125rem",
                        color: "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={assoc.toolPath}
                    >
                      {assoc.toolPath}
                    </span>
                    <button
                      onClick={() => handleDelete(assoc.extension)}
                      title="Remove association"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        padding: 4,
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--error)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--text-muted)")
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add form */}
            <form
              onSubmit={handleAdd}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: 12,
                backgroundColor: "var(--bg-secondary)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: "0 0 100px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Extension
                  </label>
                  <input
                    value={newExt}
                    onChange={(e) => setNewExt(e.target.value)}
                    placeholder="e.g. txt"
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      fontSize: "0.8125rem",
                      outline: "none",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "var(--accent)")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor =
                        "var(--border-color)")
                    }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Application
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={newTool}
                      onChange={(e) => setNewTool(e.target.value)}
                      placeholder="/usr/local/bin/code"
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text-primary)",
                        fontSize: "0.8125rem",
                        outline: "none",
                      }}
                      onFocus={(e) =>
                        (e.currentTarget.style.borderColor = "var(--accent)")
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor =
                          "var(--border-color)")
                      }
                    />
                    <button
                      type="button"
                      onClick={handleBrowseTool}
                      title="Browse"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px 10px",
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--accent)";
                        e.currentTarget.style.color = "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor =
                          "var(--border-color)";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }}
                    >
                      <FolderOpen size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--error)",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !newExt.trim() || !newTool.trim()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "7px 14px",
                  backgroundColor:
                    loading || !newExt.trim() || !newTool.trim()
                      ? "var(--bg-hover)"
                      : "var(--accent)",
                  color:
                    loading || !newExt.trim() || !newTool.trim()
                      ? "var(--text-muted)"
                      : "#ffffff",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor:
                    loading || !newExt.trim() || !newTool.trim()
                      ? "not-allowed"
                      : "pointer",
                  alignSelf: "flex-start",
                }}
              >
                <Plus size={14} />
                Add Association
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
