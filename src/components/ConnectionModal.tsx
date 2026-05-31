import React, { useState, useCallback, useEffect } from "react";
import { X, Server, User, Key, Lock, Pencil } from "lucide-react";
import type { ConnectionProfile } from "../types";

interface ConnectionModalProps {
  onConnect: (profile: ConnectionProfile) => void;
  onClose: () => void;
  initialProfile?: ConnectionProfile;
}

const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

// [impl->feat~connection-profiles~1]
const ConnectionModal: React.FC<ConnectionModalProps> = ({
  onConnect,
  onClose,
  initialProfile,
}) => {
  const isEditing = !!initialProfile;

  // [impl->req~profile-fields~1]
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [host, setHost] = useState(initialProfile?.host ?? "");
  const [port, setPort] = useState(initialProfile?.port ?? 22);
  const [username, setUsername] = useState(initialProfile?.username ?? "");
  const [authType, setAuthType] = useState<"password" | "key" | "agent">(
    initialProfile?.authType ?? "password",
  );
  const [password, setPassword] = useState(initialProfile?.password ?? "");
  const [keyPath, setKeyPath] = useState(initialProfile?.privateKeyPath ?? "");
  const [color, setColor] = useState(initialProfile?.color ?? COLORS[0]);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset form when initialProfile changes (e.g. opening modal with different profile)
  useEffect(() => {
    if (initialProfile) {
      setName(initialProfile.name);
      setHost(initialProfile.host);
      setPort(initialProfile.port);
      setUsername(initialProfile.username);
      setAuthType(initialProfile.authType);
      setPassword(initialProfile.password ?? "");
      setKeyPath(initialProfile.privateKeyPath ?? "");
      setColor(initialProfile.color);
      setSaveError(null);
    } else {
      setName("");
      setHost("");
      setPort(22);
      setUsername("");
      setAuthType("password");
      setPassword("");
      setKeyPath("");
      setColor(COLORS[0]);
      setSaveError(null);
    }
  }, [initialProfile]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !host.trim() || !username.trim()) return;
      setSaveError(null);

      // [impl->req~profile-fields~1]
      const profile: ConnectionProfile = {
        id: initialProfile?.id ?? crypto.randomUUID(),
        name: name.trim(),
        host: host.trim(),
        port: Number(port) || 22,
        username: username.trim(),
        authType,
        privateKeyPath: authType === "key" ? keyPath.trim() : undefined,
        password: authType === "password" ? password : undefined,
        color,
      };

      try {
        // [impl->feat~connection-profiles~1]
        await import("../tauri").then((m) => m.saveProfile(profile));
        window.dispatchEvent(new CustomEvent("aether-profiles-changed"));
      } catch (err) {
        setSaveError(String(err));
        return;
      }
      onConnect(profile);
    },
    [
      name,
      host,
      port,
      username,
      authType,
      password,
      keyPath,
      color,
      onConnect,
      initialProfile,
    ],
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          backgroundColor: "var(--bg-tertiary)",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          border: "1px solid var(--border-color)",
          overflow: "hidden",
        }}
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
          <h2
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isEditing ? <Pencil size={16} /> : <Server size={16} />}
            {isEditing ? "Edit Connection" : "New Connection"}
          </h2>
          <button
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              backgroundColor: "transparent",
              color: "var(--text-muted)",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Name */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                Name
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  transition: "border-color 0.2s ease",
                }}
              >
                <Server size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Server"
                  required
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
            </div>

            {/* Host & Port */}
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <label
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                  }}
                >
                  Host
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                  }}
                >
                  <GlobeIcon />
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="192.168.1.1"
                    required
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "var(--text-primary)",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  width: 80,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <label
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                  }}
                >
                  Port
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  min={1}
                  max={65535}
                  style={{
                    padding: "8px 10px",
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Username */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                Username
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                }}
              >
                <User size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="root"
                  required
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
            </div>

            {/* Auth type */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                Authentication
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {/* [impl->req~windows-ssh-agent~1] */}
                <button
                  type="button"
                  onClick={() => setAuthType("password")}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px",
                    backgroundColor:
                      authType === "password"
                        ? "var(--bg-active)"
                        : "var(--bg-secondary)",
                    color:
                      authType === "password"
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "background-color 0.2s ease, color 0.2s ease",
                  }}
                >
                  <Lock size={13} />
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setAuthType("key")}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px",
                    backgroundColor:
                      authType === "key"
                        ? "var(--bg-active)"
                        : "var(--bg-secondary)",
                    color:
                      authType === "key"
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "background-color 0.2s ease, color 0.2s ease",
                  }}
                >
                  <Key size={13} />
                  SSH Key
                </button>
                <button
                  type="button"
                  onClick={() => setAuthType("agent")}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px",
                    backgroundColor:
                      authType === "agent"
                        ? "var(--bg-active)"
                        : "var(--bg-secondary)",
                    color:
                      authType === "agent"
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "background-color 0.2s ease, color 0.2s ease",
                  }}
                >
                  <Key size={13} />
                  Agent
                </button>
              </div>
            </div>

            {/* Password */}
            {authType === "password" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                  }}
                >
                  Password
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                  }}
                >
                  <Lock size={14} color="var(--text-muted)" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "var(--text-primary)",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Key path */}
            {authType === "key" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                  }}
                >
                  Private Key Path
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 6,
                    }}
                  >
                    <Key size={14} color="var(--text-muted)" />
                    <input
                      type="text"
                      value={keyPath}
                      onChange={(e) => setKeyPath(e.target.value)}
                      placeholder="~/.ssh/id_rsa (optional — auto-detected if empty)"
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: "var(--text-primary)",
                        fontSize: "0.875rem",
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "8px 12px", fontSize: "0.8125rem" }}
                    onClick={() => {
                      // TODO: Open Tauri file dialog for key selection
                    }}
                  >
                    Browse
                  </button>
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  {/* [impl->req~windows-openssh-detection~1] */}
                  Leave empty to auto-detect default keys (~/.ssh/id_ed25519,
                  id_rsa, etc.)
                </span>
              </div>
            )}

            {/* Color picker */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                Label Color
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      backgroundColor: c,
                      border:
                        color === c
                          ? "2px solid var(--text-primary)"
                          : "2px solid transparent",
                      cursor: "pointer",
                      transition:
                        "transform 0.15s ease, border-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Save error */}
          {saveError && (
            <div
              style={{
                padding: "10px 12px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid var(--error)",
                borderRadius: 6,
                color: "var(--error)",
                fontSize: "0.8125rem",
                marginTop: 8,
              }}
            >
              <strong>Failed to save profile:</strong> {saveError}
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 24,
            }}
          >
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {isEditing ? "Save Changes" : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function GlobeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--text-muted)", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export default ConnectionModal;
